const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
let publicListLimiter;
try { ({ publicListLimiter } = require('../middleware/rateLimit')); } catch (e) { /* optional */ }

// Public user profile by id
const userHandlers = [];
if (publicListLimiter) userHandlers.push(publicListLimiter);
userHandlers.push(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, avatarUrl: true, bio: true, points: true, createdAt: true }
    });
    if (!user) return res.status(404).json({ error: 'not found' });
    res.json(user);
  } catch (e) {
    console.error('get user error', e);
    res.status(500).json({ error: 'server error' });
  }
});
router.get('/:id', userHandlers);

module.exports = router;
