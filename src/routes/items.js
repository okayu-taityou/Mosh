const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
let publicListLimiter;
try { ({ publicListLimiter } = require('../middleware/rateLimit')); } catch (e) { /* optional */ }

// public list of items (for gacha display)
const itemsHandlers = [];
if (publicListLimiter) itemsHandlers.push(publicListLimiter);
itemsHandlers.push(async (req, res) => {
  try {
    const items = await prisma.item.findMany({ orderBy: { id: 'asc' } });
    res.json(items);
  } catch (e) {
    console.error('items list error', e);
    res.status(500).json({ error: 'server error' });
  }
});
router.get('/', itemsHandlers);

// current user's owned items
router.get('/my', auth, async (req, res) => {
  try {
    const owned = await prisma.ownedItem.findMany({ where: { userId: req.userId }, include: { item: true } });
    res.json(owned);
  } catch (e) {
    console.error('owned items error', e);
    res.status(500).json({ error: 'server error' });
  }
});

const { validate } = require('../middleware/validate');
const { createItemSchema } = require('../schemas');
// 管理用: create item (dev only unless ALLOW_ITEM_MOD=1)
router.post('/', auth, validate(createItemSchema), async (req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ITEM_MOD !== '1') {
    return res.status(403).json({ error: 'not allowed' });
  }
  const { name, rarity, power } = req.body;
  try {
    const it = await prisma.item.create({ data: { name, rarity, power: power || null } });
    res.json(it);
  } catch (e) {
    console.error('create item error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// 管理用: update item
router.put('/:id', auth, async (req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ITEM_MOD !== '1') {
    return res.status(403).json({ error: 'not allowed' });
  }
  const id = Number(req.params.id);
  const data = {};
  if (req.body.name !== undefined) data.name = req.body.name;
  if (req.body.rarity !== undefined) data.rarity = req.body.rarity;
  if (req.body.power !== undefined) data.power = req.body.power;
  try {
    const updated = await prisma.item.update({ where: { id }, data });
    res.json(updated);
  } catch (e) {
    console.error('update item error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// 管理用: delete item
router.delete('/:id', auth, async (req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ITEM_MOD !== '1') {
    return res.status(403).json({ error: 'not allowed' });
  }
  const id = Number(req.params.id);
  try {
    await prisma.item.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error('delete item error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// 管理用: give an item to current user (dev only)
router.post('/:id/give', auth, async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'not allowed' });
  const itemId = Number(req.params.id);
  try {
    const owned = await prisma.ownedItem.create({ data: { userId: req.userId, itemId } });
    res.json(owned);
  } catch (e) {
    console.error('give item error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Equip/unequip owned item
router.post('/:ownedId/equip', auth, async (req, res) => {
  const ownedId = Number(req.params.ownedId);
  try {
    const owned = await prisma.ownedItem.findUnique({ where: { id: ownedId }, include: { item: true } });
    if (!owned) return res.status(404).json({ error: 'owned item not found' });
    if (owned.userId !== req.userId) return res.status(403).json({ error: 'not owner' });
    const updated = await prisma.ownedItem.update({ where: { id: ownedId }, data: { equipped: !owned.equipped } });
    // 履歴を記録
    const action = updated.equipped ? 'item_equipped' : 'item_unequipped';
    const detail = updated.equipped ? `「${owned.item.name}」を装備` : `「${owned.item.name}」を装備解除`;
    await prisma.activityLog.create({ data: { userId: req.userId, action, detail } });
    res.json(updated);
  } catch (e) {
    console.error('equip error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Use (consume) an owned item. Behavior: if there's an active user boss status, heal by item.power (capped by boss.maxHp) and delete ownedItem.
router.post('/:ownedId/use', auth, async (req, res) => {
  const ownedId = Number(req.params.ownedId);
  try {
    const owned = await prisma.ownedItem.findUnique({ where: { id: ownedId }, include: { item: true } });
    if (!owned) return res.status(404).json({ error: 'owned item not found' });
    if (owned.userId !== req.userId) return res.status(403).json({ error: 'not owner' });

    // find active user boss status
    const status = await prisma.userBossStatus.findFirst({ where: { userId: req.userId, finished: false }, include: { boss: true } });
    if (!status) return res.status(400).json({ error: 'no active fight to use item' });

    const power = Number(owned.item.power) || 0;
    const result = await prisma.$transaction(async (tx) => {
      // heal capped to boss.maxHp
      const newHp = Math.min(status.hp + power, status.boss.maxHp);
      const s = await tx.userBossStatus.update({ where: { id: status.id }, data: { hp: newHp } });
      // remove owned item (consume)
      await tx.ownedItem.delete({ where: { id: ownedId } });
      // 履歴を記録
      await tx.activityLog.create({ data: { userId: req.userId, action: 'item_used', detail: `「${owned.item.name}」を使用してHP+${newHp - status.hp}回復` } });
      return { status: s, healed: newHp - status.hp };
    });

    res.json(result);
  } catch (e) {
    console.error('use item error', e);
    res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
