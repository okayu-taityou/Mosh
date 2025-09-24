const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const database = require('../database/init');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'tennis-club-secret-key-2023';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// 認証ミドルウェア
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'アクセストークンが必要です'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                error: 'トークンが無効です'
            });
        }
        req.user = user;
        next();
    });
};

// ダッシュボード統計情報
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        const db = database.getDb();
        
        // お問い合わせ統計
        const contactStats = await new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'unread' THEN 1 ELSE 0 END) as unread,
                    SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
                    SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
                    COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as today,
                    COUNT(CASE WHEN DATE(created_at) >= DATE('now', '-7 days') THEN 1 END) as this_week
                FROM contacts
            `;
            
            db.get(sql, [], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // SNS統計
        const snsStats = await new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total_posts,
                    SUM(likes_count) as total_likes,
                    SUM(comments_count) as total_comments,
                    SUM(shares_count) as total_shares,
                    COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as today_posts,
                    COUNT(CASE WHEN DATE(created_at) >= DATE('now', '-7 days') THEN 1 END) as week_posts
                FROM sns_posts 
                WHERE is_active = 1
            `;
            
            db.get(sql, [], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // 最新のお問い合わせ
        const recentContacts = await new Promise((resolve, reject) => {
            const sql = `
                SELECT id, name, email, subject, status, created_at
                FROM contacts 
                ORDER BY created_at DESC 
                LIMIT 5
            `;
            
            db.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // 最新のSNS投稿
        const recentPosts = await new Promise((resolve, reject) => {
            const sql = `
                SELECT id, platform, content, likes_count, comments_count, shares_count, created_at
                FROM sns_posts 
                WHERE is_active = 1
                ORDER BY created_at DESC 
                LIMIT 5
            `;
            
            db.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json({
            success: true,
            data: {
                contacts: contactStats,
                sns: snsStats,
                recent_contacts: recentContacts,
                recent_posts: recentPosts,
                server_info: {
                    uptime: process.uptime(),
                    memory_usage: process.memoryUsage(),
                    timestamp: new Date().toISOString()
                }
            }
        });

    } catch (error) {
        console.error('ダッシュボード統計取得エラー:', error);
        res.status(500).json({
            success: false,
            error: '統計情報の取得に失敗しました'
        });
    }
});

// ログイン
const loginValidation = [
    body('username')
        .isLength({ min: 1 })
        .withMessage('ユーザー名は必須です')
        .trim()
        .escape(),
    body('password')
        .isLength({ min: 1 })
        .withMessage('パスワードは必須です')
];

router.post('/login', loginValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'バリデーションエラー',
                details: errors.array()
            });
        }

        const { username, password } = req.body;
        const db = database.getDb();
        
        // ユーザー検索
        const admin = await new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM admins WHERE username = ?';
            db.get(sql, [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!admin) {
            return res.status(401).json({
                success: false,
                error: 'ユーザー名またはパスワードが正しくありません'
            });
        }

        // パスワード確認
        const isValidPassword = await bcrypt.compare(password, admin.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'ユーザー名またはパスワードが正しくありません'
            });
        }

        // ログイン時刻更新
        await new Promise((resolve, reject) => {
            const sql = 'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?';
            db.run(sql, [admin.id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // JWTトークン生成
        const token = jwt.sign(
            { 
                id: admin.id, 
                username: admin.username, 
                email: admin.email,
                role: admin.role 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        res.json({
            success: true,
            message: 'ログインしました',
            data: {
                token,
                user: {
                    id: admin.id,
                    username: admin.username,
                    email: admin.email,
                    role: admin.role,
                    last_login: admin.last_login
                }
            }
        });

    } catch (error) {
        console.error('ログインエラー:', error);
        res.status(500).json({
            success: false,
            error: 'ログイン処理に失敗しました'
        });
    }
});

// トークン検証
router.get('/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'トークンは有効です',
        data: {
            user: req.user
        }
    });
});

// お問い合わせステータス更新
router.put('/contacts/:id/status', authenticateToken, async (req, res) => {
    try {
        const contactId = parseInt(req.params.id);
        const { status } = req.body;
        
        if (!['unread', 'read', 'replied', 'closed'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: '無効なステータスです'
            });
        }

        const db = database.getDb();
        const sql = `
            UPDATE contacts 
            SET status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        
        const result = await new Promise((resolve, reject) => {
            db.run(sql, [status, contactId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });

        if (result === 0) {
            return res.status(404).json({
                success: false,
                error: 'お問い合わせが見つかりません'
            });
        }

        res.json({
            success: true,
            message: 'ステータスを更新しました'
        });

    } catch (error) {
        console.error('ステータス更新エラー:', error);
        res.status(500).json({
            success: false,
            error: 'ステータスの更新に失敗しました'
        });
    }
});

// 初期管理者作成（初回セットアップ用）
router.post('/setup', async (req, res) => {
    try {
        const db = database.getDb();
        
        // 既に管理者が存在するかチェック
        const existingAdmin = await new Promise((resolve, reject) => {
            const sql = 'SELECT COUNT(*) as count FROM admins';
            db.get(sql, [], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        if (existingAdmin > 0) {
            return res.status(400).json({
                success: false,
                error: '管理者は既に作成されています'
            });
        }

        const { username, password, email } = req.body;
        
        if (!username || !password || !email) {
            return res.status(400).json({
                success: false,
                error: 'ユーザー名、パスワード、メールアドレスは必須です'
            });
        }

        // パスワードハッシュ化
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // 管理者作成
        const adminId = await new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO admins (username, password_hash, email, role)
                VALUES (?, ?, ?, 'admin')
            `;
            
            db.run(sql, [username, passwordHash, email], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });

        res.json({
            success: true,
            message: '初期管理者を作成しました',
            data: {
                id: adminId,
                username,
                email
            }
        });

    } catch (error) {
        console.error('管理者作成エラー:', error);
        res.status(500).json({
            success: false,
            error: '管理者の作成に失敗しました'
        });
    }
});

module.exports = router;