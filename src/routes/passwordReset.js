const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const crypto = require('crypto');
const { sendMail } = require('../lib/email');
const bcrypt = require('bcryptjs');
let resetLimiter;
try { ({ resetLimiter } = require('../middleware/rateLimit')); } catch (e) { /* optional */ }

// パスワードリセット申請（メールアドレス）
const reqHandlers = [];
if (resetLimiter) reqHandlers.unshift(resetLimiter);
router.post('/request', reqHandlers, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: 'user not found' });
  // トークン生成
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 30); // 30分有効
  await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt: expires } });
  // メール送信
  try {
    const appBaseUrl = process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
    const resetUrl = `${appBaseUrl}/reset-password?token=${token}`;
    await sendMail({
      to: email,
      subject: '【MoSh】パスワードリセットのご案内',
      text: `パスワードリセットを受け付けました。以下のURLから30分以内に手続きを完了してください。\n\n${resetUrl}\n\nこのメールに覚えがない場合は破棄してください。`,
    });
  } catch (e) {
    console.error('send reset mail error', e);
    // メール失敗でも、攻撃者に情報を与えないためメッセージは成功と同一にする
  }
  // In production, do not return tokens in API responses. Use a dev fallback env var to allow returning token for local testing.
  const includeToken = process.env.FALLBACK_DEV_RESET_TOKEN === '1' && process.env.NODE_ENV !== 'production';
  const payload = { message: 'パスワードリセット申請が受理されました' };
  if (includeToken) payload.token = token; // only include in non-production dev mode
  res.json(payload);
});

// パスワードリセット（トークン＋新パスワード）
router.post('/reset', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'token and newPassword required' });
  const reset = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!reset || reset.used || reset.expiresAt < new Date()) return res.status(400).json({ error: 'invalid or expired token' });
  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: hash } });
  await prisma.passwordResetToken.update({ where: { id: reset.id }, data: { used: true } });
  res.json({ message: 'パスワードがリセットされました' });
});

module.exports = router;
