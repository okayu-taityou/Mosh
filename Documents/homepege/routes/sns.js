const express = require('express');
const { body, validationResult } = require('express-validator');
const database = require('../database/init');
const moment = require('moment');
const router = express.Router();

// SNS投稿一覧取得
router.get('/posts', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const platform = req.query.platform;
        
        const db = database.getDb();
        
        let whereClause = 'WHERE is_active = 1';
        let queryParams = [];
        
        if (platform && ['instagram', 'twitter', 'facebook'].includes(platform)) {
            whereClause += ' AND platform = ?';
            queryParams.push(platform);
        }

        const sql = `
            SELECT id, platform, author, content, image_url, 
                   likes_count, comments_count, shares_count, 
                   post_url, created_at, updated_at
            FROM sns_posts 
            ${whereClause}
            ORDER BY created_at DESC 
            LIMIT ?
        `;
        
        const posts = await new Promise((resolve, reject) => {
            db.all(sql, [...queryParams, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // 日付フォーマット
                    const formattedPosts = rows.map(post => ({
                        ...post,
                        created_at: moment(post.created_at).fromNow(),
                        formatted_date: moment(post.created_at).format('YYYY年MM月DD日 HH:mm')
                    }));
                    resolve(formattedPosts);
                }
            });
        });

        res.json({
            success: true,
            data: posts,
            total: posts.length
        });

    } catch (error) {
        console.error('SNS投稿取得エラー:', error);
        res.status(500).json({
            success: false,
            error: '投稿の取得に失敗しました'
        });
    }
});

// 投稿のエンゲージメント更新（いいね、コメント、シェア）
router.post('/posts/:id/engagement', async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const { type, increment = 1 } = req.body;
        
        if (!['likes', 'comments', 'shares'].includes(type)) {
            return res.status(400).json({
                success: false,
                error: '無効なエンゲージメントタイプです'
            });
        }

        const db = database.getDb();
        const columnName = `${type}_count`;
        
        const sql = `
            UPDATE sns_posts 
            SET ${columnName} = ${columnName} + ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ? AND is_active = 1
        `;
        
        const result = await new Promise((resolve, reject) => {
            db.run(sql, [increment, postId], function(err) {
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
                error: '投稿が見つかりません'
            });
        }

        // 更新後の投稿データを取得
        const updatedPost = await new Promise((resolve, reject) => {
            db.get(
                'SELECT likes_count, comments_count, shares_count FROM sns_posts WHERE id = ?',
                [postId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        res.json({
            success: true,
            message: `${type}を更新しました`,
            data: updatedPost
        });

    } catch (error) {
        console.error('エンゲージメント更新エラー:', error);
        res.status(500).json({
            success: false,
            error: 'エンゲージメントの更新に失敗しました'
        });
    }
});

// 新しい投稿作成（管理者用）
const postValidation = [
    body('platform')
        .isIn(['instagram', 'twitter', 'facebook'])
        .withMessage('有効なプラットフォームを選択してください'),
    body('author')
        .isLength({ min: 1, max: 100 })
        .withMessage('投稿者名は1文字以上100文字以下で入力してください')
        .trim()
        .escape(),
    body('content')
        .isLength({ min: 1, max: 1000 })
        .withMessage('投稿内容は1文字以上1000文字以下で入力してください')
        .trim(),
    body('image_url')
        .optional()
        .isURL()
        .withMessage('正しい画像URLを入力してください'),
    body('post_url')
        .optional()
        .isURL()
        .withMessage('正しい投稿URLを入力してください')
];

router.post('/posts', postValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'バリデーションエラー',
                details: errors.array()
            });
        }

        const { platform, author, content, image_url, post_url } = req.body;
        
        const db = database.getDb();
        const sql = `
            INSERT INTO sns_posts (platform, author, content, image_url, post_url)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const postId = await new Promise((resolve, reject) => {
            db.run(sql, [platform, author, content, image_url || null, post_url || null], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });

        // 作成された投稿を取得
        const newPost = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM sns_posts WHERE id = ?',
                [postId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        res.json({
            success: true,
            message: '投稿を作成しました',
            data: {
                ...newPost,
                created_at: moment(newPost.created_at).fromNow()
            }
        });

    } catch (error) {
        console.error('SNS投稿作成エラー:', error);
        res.status(500).json({
            success: false,
            error: '投稿の作成に失敗しました'
        });
    }
});

// 模擬的なリアルタイム投稿生成（開発・デモ用）
router.post('/generate-mock-post', async (req, res) => {
    try {
        const mockPosts = [
            {
                platform: 'instagram',
                author: '○○大学テニス部',
                content: '今日の練習はサーブ強化でした！新入部員も頑張っています🎾 #テニス #大学テニス #サーブ練習',
                likes_count: Math.floor(Math.random() * 50) + 10,
                comments_count: Math.floor(Math.random() * 10) + 1,
                shares_count: Math.floor(Math.random() * 5) + 1
            },
            {
                platform: 'twitter',
                author: '○○大学テニス部',
                content: '明日は他大学との練習試合です。応援よろしくお願いします！',
                likes_count: Math.floor(Math.random() * 30) + 5,
                comments_count: Math.floor(Math.random() * 8) + 1,
                shares_count: Math.floor(Math.random() * 8) + 2
            },
            {
                platform: 'instagram',
                author: '○○大学テニス部',
                content: 'コート整備完了！綺麗になったコートで気持ちよく練習できます✨',
                likes_count: Math.floor(Math.random() * 40) + 15,
                comments_count: Math.floor(Math.random() * 6) + 2,
                shares_count: Math.floor(Math.random() * 3) + 1
            }
        ];

        const randomPost = mockPosts[Math.floor(Math.random() * mockPosts.length)];
        
        const db = database.getDb();
        const sql = `
            INSERT INTO sns_posts (platform, author, content, likes_count, comments_count, shares_count)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const postId = await new Promise((resolve, reject) => {
            db.run(sql, [
                randomPost.platform,
                randomPost.author,
                randomPost.content,
                randomPost.likes_count,
                randomPost.comments_count,
                randomPost.shares_count
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });

        // 作成された投稿を取得
        const newPost = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM sns_posts WHERE id = ?',
                [postId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        res.json({
            success: true,
            message: '模擬投稿を生成しました',
            data: {
                ...newPost,
                created_at: moment(newPost.created_at).fromNow(),
                formatted_date: moment(newPost.created_at).format('YYYY年MM月DD日 HH:mm')
            }
        });

    } catch (error) {
        console.error('模擬投稿生成エラー:', error);
        res.status(500).json({
            success: false,
            error: '模擬投稿の生成に失敗しました'
        });
    }
});

// SNS統計情報取得
router.get('/stats', async (req, res) => {
    try {
        const db = database.getDb();
        
        const stats = await new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    platform,
                    COUNT(*) as post_count,
                    SUM(likes_count) as total_likes,
                    SUM(comments_count) as total_comments,
                    SUM(shares_count) as total_shares,
                    AVG(likes_count) as avg_likes
                FROM sns_posts 
                WHERE is_active = 1 
                GROUP BY platform
            `;
            
            db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });

        // 全体統計も取得
        const totalStats = await new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total_posts,
                    SUM(likes_count) as total_likes,
                    SUM(comments_count) as total_comments,
                    SUM(shares_count) as total_shares
                FROM sns_posts 
                WHERE is_active = 1
            `;
            
            db.get(sql, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });

        res.json({
            success: true,
            data: {
                by_platform: stats,
                total: totalStats
            }
        });

    } catch (error) {
        console.error('SNS統計取得エラー:', error);
        res.status(500).json({
            success: false,
            error: '統計情報の取得に失敗しました'
        });
    }
});

module.exports = router;