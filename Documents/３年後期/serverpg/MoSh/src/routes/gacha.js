const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');

const { validate } = require('../middleware/validate');
const { gachaSpinSchema } = require('../schemas');
let gachaLimiter;
try { ({ gachaLimiter } = require('../middleware/rateLimit')); } catch (e) { /* optional */ }
let publicListLimiter;
try { ({ publicListLimiter } = require('../middleware/rateLimit')); } catch (e) { /* optional */ }
// simple spin: random select an item weighted by rarity, cost is deducted from user points
const spinHandlers = [auth, validate(gachaSpinSchema)];
if (gachaLimiter) spinHandlers.unshift(gachaLimiter);
router.post('/spin', spinHandlers, async (req, res) => {
  try {
    const items = await prisma.item.findMany();
    if (!items || !items.length) return res.status(400).json({ error: 'no items in gacha' });

    const GACHA_COST = Number(process.env.GACHA_COST) || 10;

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'user not found' });
    if (user.points < GACHA_COST) return res.status(402).json({ error: 'insufficient points' });

    // weight by rarity: common=60, rare=30, epic=9, legendary=1
    const weights = { common: 60, rare: 30, epic: 9, legendary: 1 };

    // efficient weighted random: compute cumulative weights
    let total = 0;
    const cumulative = items.map(it => {
      const w = Number(weights[it.rarity]) || 1;
      total += w;
      return { id: it.id, weight: w, cumulative: total };
    });
    if (total <= 0) return res.status(500).json({ error: 'invalid gacha weights' });
    const rnd = Math.floor(Math.random() * total) + 1; // 1..total
    const chosen = cumulative.find(c => rnd <= c.cumulative);
    if (!chosen) return res.status(500).json({ error: 'could not choose item' });
    const item = await prisma.item.findUnique({ where: { id: chosen.id } });
    if (!item) return res.status(500).json({ error: 'selected item not found' });

    // Use an interactive transaction to avoid races: only decrement if user still has enough points
    const result = await prisma.$transaction(async (tx) => {
      // updateMany with where points >= cost ensures we don't go negative
      const updated = await tx.user.updateMany({
        where: { id: req.userId, points: { gte: GACHA_COST } },
        data: { points: { decrement: GACHA_COST } }
      });
      if (!updated || updated.count === 0) {
        // no rows updated -> insufficient points (race or other)
        throw new Error('insufficient_points_during_transaction');
      }

      const rec = await tx.gachaRecord.create({ data: { userId: req.userId, itemId: item.id } });
      // also add to owned items (inventory)
      const owned = await tx.ownedItem.create({ data: { userId: req.userId, itemId: item.id } });
      const userAfter = await tx.user.findUnique({ where: { id: req.userId } });
      // 通知・履歴を自動記録
      await tx.notification.create({ data: { userId: req.userId, type: 'item_gacha', message: `ガチャで「${item.name}」(${item.rarity})を獲得しました！` } });
      await tx.activityLog.create({ data: { userId: req.userId, action: 'item_gacha', detail: `ガチャで「${item.name}」を獲得` } });
      // 実績: 初めてのガチャ
      try {
        const ach = await tx.achievement.findUnique({ where: { code: 'first_gacha' } });
        if (ach) {
          const has = await tx.userAchievement.findFirst({ where: { userId: req.userId, achievementId: ach.id } });
          if (!has) {
            await tx.userAchievement.create({ data: { userId: req.userId, achievementId: ach.id } });
            await tx.notification.create({ data: { userId: req.userId, type: 'achievement', message: `実績「${ach.title}」を獲得！` } });
            await tx.activityLog.create({ data: { userId: req.userId, action: 'achievement_unlocked', detail: `「${ach.title}」` } });
          }
        }
      } catch (e) { /* ignore */ }
      return { rec, owned, userAfter };
    });

    return res.json({ item, record: result.rec, owned: result.owned, remainingPoints: result.userAfter.points });
  } catch (e) {
    console.error('gacha spin error:', e && e.message ? e.message : e);
    if (e && e.message === 'insufficient_points_during_transaction') {
      return res.status(402).json({ error: 'insufficient points' });
    }
    return res.status(500).json({ error: 'server error' });
  }
});

// batch spin (e.g., 10連) - perform in one transaction: deduct points once and create multiple records
router.post('/spin/batch', spinHandlers, async (req, res) => {
  try {
    const count = Math.max(1, Math.min(100, Number(req.body.count) || 10));
    const items = await prisma.item.findMany();
    if (!items || !items.length) return res.status(400).json({ error: 'no items in gacha' });
    const GACHA_COST = Number(process.env.GACHA_COST) || 10;
    const totalCost = GACHA_COST * count;
    const weights = { common: 60, rare: 30, epic: 9, legendary: 1 };

    // build cumulative array once
    let total = 0;
    const cumulative = items.map(it => {
      const w = Number(weights[it.rarity]) || 1;
      total += w;
      return { id: it.id, weight: w, cumulative: total };
    });
    if (total <= 0) return res.status(500).json({ error: 'invalid gacha weights' });

    const results = await prisma.$transaction(async (tx) => {
      // decrement points atomically if enough
      const updated = await tx.user.updateMany({ where: { id: req.userId, points: { gte: totalCost } }, data: { points: { decrement: totalCost } } });
      if (!updated || updated.count === 0) throw new Error('insufficient_points_during_transaction');
      // persist a GachaBatch record to group these records
      let batchRec;
      try {
        batchRec = await tx.gachaBatch.create({ data: { userId: req.userId, count, totalCost } });
      } catch (e) {
        // if migration hasn't been applied (model missing), ignore and continue without batch
        batchRec = null;
      }
      const out = [];
      for (let i = 0; i < count; i++) {
        const rnd = Math.floor(Math.random() * total) + 1;
        const chosen = cumulative.find(c => rnd <= c.cumulative);
        if (!chosen) throw new Error('could not_choose_item');
        const item = await tx.item.findUnique({ where: { id: chosen.id } });
        const recData = { userId: req.userId, itemId: item.id };
        if (batchRec && batchRec.id) recData.batchId = batchRec.id;
        const rec = await tx.gachaRecord.create({ data: recData });
        const owned = await tx.ownedItem.create({ data: { userId: req.userId, itemId: item.id } });
        out.push({ item, record: rec, owned });
      }
      const userAfter = await tx.user.findUnique({ where: { id: req.userId } });
      // summary notification
      try { await tx.notification.create({ data: { userId: req.userId, type: 'item_gacha', message: `ガチャを${count}回回しました` } }); } catch (e) { /* ignore */ }
      return { out, remainingPoints: userAfter.points };
    });

    return res.json({ results: results.out, remainingPoints: results.remainingPoints });
  } catch (e) {
    console.error('gacha batch error:', e && e.message ? e.message : e);
    if (e && e.message === 'insufficient_points_during_transaction') return res.status(402).json({ error: 'insufficient points' });
    return res.status(500).json({ error: 'server error' });
  }
});

// expose gacha rates / probabilities (readonly)
const ratesHandlers = [];
if (publicListLimiter) ratesHandlers.push(publicListLimiter);
ratesHandlers.push(async (req, res) => {
  try {
    // Mirror the server-side weights used in spin
    const weights = { common: 60, rare: 30, epic: 9, legendary: 1 };
    const total = Object.values(weights).reduce((s,v)=>s+v,0);
    const probs = {};
    Object.keys(weights).forEach(k=>{ probs[k] = weights[k] / total; });
    return res.json({ weights, probs });
  } catch (e) {
    console.error('gacha rates error', e);
    return res.status(500).json({ error: 'server error' });
  }
});
router.get('/rates', ratesHandlers);

// recent history for authenticated user
router.get('/history', auth, async (req, res) => {
  try {
    const list = await prisma.gachaRecord.findMany({
      where: { userId: req.userId },
      include: { item: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json(list.map(r=>({ id: r.id, item: r.item, createdAt: r.createdAt, batchId: r.batchId || null })));
  } catch (e) {
    console.error('gacha history error', e);
    return res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
