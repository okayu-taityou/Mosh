const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
let publicListLimiter;
try { ({ publicListLimiter } = require('../middleware/rateLimit')); } catch (e) { /* optional */ }

// Get top users by points (leaderboard)
const pointsHandlers = [];
if (publicListLimiter) pointsHandlers.push(publicListLimiter);
pointsHandlers.push(async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  try {
    const topUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        points: true
      },
      orderBy: { points: 'desc' },
      take: Math.min(limit, 100) // 最大100件まで
    });
    
    // ランキング番号を追加
    const ranking = topUsers.map((user, index) => ({
      rank: index + 1,
      ...user
    }));
    
    res.json(ranking);
  } catch (e) {
    console.error('rankings error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// New route for points
router.get('/points', pointsHandlers);


// Get current user's rank and nearby users
router.get('/me', auth, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, avatarUrl: true, points: true }
    });
    
    if (!currentUser) return res.status(404).json({ error: 'user not found' });
    
    // 自分より上のユーザー数を数える（同点も考慮）
    const higherCount = await prisma.user.count({
      where: {
        points: { gt: currentUser.points }
      }
    });
    
    const myRank = higherCount + 1;
    
    // 前後のユーザーを取得（各2人ずつ）
    const above = await prisma.user.findMany({
      where: {
        points: { gt: currentUser.points }
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        points: true
      },
      orderBy: { points: 'asc' },
      take: 2
    });
    
    const below = await prisma.user.findMany({
      where: {
        points: { lt: currentUser.points }
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        points: true
      },
      orderBy: { points: 'desc' },
      take: 2
    });
    
    res.json({
      myRank,
      me: currentUser,
      above: above.reverse(), // 降順に並び替え
      below
    });
  } catch (e) {
    console.error('my rank error', e);
    res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
