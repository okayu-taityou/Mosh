const express = require('express');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const database = require('../database/init');
const router = express.Router();

// メール送信設定
const createMailTransporter = () => {
    // 開発環境ではEthereal Emailを使用（テスト用）
    if (process.env.NODE_ENV !== 'production') {
        return nodemailer.createTransporter({
            host: 'smtp.ethereal.email',
            port: 587,
            auth: {
                user: 'ethereal.user@ethereal.email',
                pass: 'ethereal.pass'
            }
        });
    }
    
    // 本番環境ではGmailまたは他のSMTPサービスを使用
    return nodemailer.createTransporter({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};

// バリデーションルール
const contactValidation = [
    body('name')
        .isLength({ min: 1, max: 100 })
        .withMessage('お名前は1文字以上100文字以下で入力してください')
        .trim()
        .escape(),
    body('email')
        .isEmail()
        .withMessage('正しいメールアドレスを入力してください')
        .normalizeEmail(),
    body('phone')
        .optional()
        .isMobilePhone('ja-JP')
        .withMessage('正しい電話番号を入力してください'),
    body('subject')
        .optional()
        .isLength({ max: 200 })
        .withMessage('件名は200文字以下で入力してください')
        .trim()
        .escape(),
    body('message')
        .isLength({ min: 10, max: 2000 })
        .withMessage('メッセージは10文字以上2000文字以下で入力してください')
        .trim()
        .escape()
];

// お問い合わせ送信
router.post('/send', contactValidation, async (req, res) => {
    try {
        // バリデーションチェック
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'バリデーションエラー',
                details: errors.array()
            });
        }

        const { name, email, phone, subject, message } = req.body;
        const clientIp = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        // データベースに保存
        const db = database.getDb();
        const insertSql = `
            INSERT INTO contacts (name, email, phone, subject, message, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const contactId = await new Promise((resolve, reject) => {
            db.run(insertSql, [name, email, phone || null, subject || null, message, clientIp, userAgent], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });

        // メール送信
        const transporter = createMailTransporter();
        
        // 管理者向けメール
        const adminMailOptions = {
            from: process.env.SMTP_USER || 'noreply@tennis-club.com',
            to: process.env.ADMIN_EMAIL || 'admin@tennis-club.com',
            subject: `【テニス部HP】新しいお問い合わせ: ${subject || '件名なし'}`,
            html: `
                <div style="font-family: 'Noto Sans JP', sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #00bcd4; border-bottom: 2px solid #00bcd4; padding-bottom: 10px;">
                        🎾 新しいお問い合わせ
                    </h2>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>お名前:</strong> ${name}</p>
                        <p><strong>メールアドレス:</strong> ${email}</p>
                        ${phone ? `<p><strong>電話番号:</strong> ${phone}</p>` : ''}
                        ${subject ? `<p><strong>件名:</strong> ${subject}</p>` : ''}
                        <div style="margin-top: 20px;">
                            <strong>メッセージ:</strong>
                            <div style="background: white; padding: 15px; border-radius: 4px; margin-top: 10px; border-left: 4px solid #00bcd4;">
                                ${message.replace(/\n/g, '<br>')}
                            </div>
                        </div>
                    </div>
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 0.9em;">
                        <p><strong>受信情報:</strong></p>
                        <p>ID: ${contactId}</p>
                        <p>受信日時: ${new Date().toLocaleString('ja-JP')}</p>
                        <p>IPアドレス: ${clientIp}</p>
                    </div>
                    <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
                        このメールは○○大学テニス部のホームページから自動送信されました。
                    </p>
                </div>
            `
        };

        // 自動返信メール
        const replyMailOptions = {
            from: process.env.SMTP_USER || 'noreply@tennis-club.com',
            to: email,
            subject: '【○○大学テニス部】お問い合わせありがとうございます',
            html: `
                <div style="font-family: 'Noto Sans JP', sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #00bcd4, #26c6da); color: white; border-radius: 8px 8px 0 0;">
                        <h1 style="margin: 0; font-size: 1.8em;">🎾 ○○大学テニス部</h1>
                        <p style="margin: 10px 0 0; opacity: 0.9;">お問い合わせありがとうございます</p>
                    </div>
                    <div style="padding: 30px; background: white; border-radius: 0 0 8px 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                        <p><strong>${name}</strong> 様</p>
                        <p>この度は○○大学テニス部へお問い合わせいただき、誠にありがとうございます。</p>
                        <p>以下の内容でお問い合わせを承りました。</p>
                        
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            ${subject ? `<p><strong>件名:</strong> ${subject}</p>` : ''}
                            <div style="margin-top: 15px;">
                                <strong>お問い合わせ内容:</strong>
                                <div style="background: white; padding: 15px; border-radius: 4px; margin-top: 10px; border-left: 4px solid #00bcd4;">
                                    ${message.replace(/\n/g, '<br>')}
                                </div>
                            </div>
                        </div>
                        
                        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="color: #2e7d32; margin: 0 0 15px;">📞 今後の流れ</h3>
                            <ul style="margin: 0; padding-left: 20px; color: #333;">
                                <li>内容を確認次第、担当者よりご連絡いたします</li>
                                <li>通常1-2営業日以内にお返事いたします</li>
                                <li>お急ぎの場合は直接お電話ください</li>
                            </ul>
                        </div>
                        
                        <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="color: #f57c00; margin: 0 0 15px;">🏫 部活動情報</h3>
                            <p style="margin: 0; color: #333;">
                                <strong>練習時間:</strong> 平日 16:00-19:00 / 土日 9:00-17:00<br>
                                <strong>練習場所:</strong> 大学テニスコート<br>
                                <strong>見学:</strong> いつでも歓迎です！
                            </p>
                        </div>
                        
                        <p style="color: #666; font-size: 0.9em; margin-top: 30px; text-align: center;">
                            このメールは自動送信されています。<br>
                            心当たりがない場合は、お手数ですが削除してください。
                        </p>
                    </div>
                </div>
            `
        };

        // メール送信実行
        try {
            await transporter.sendMail(adminMailOptions);
            await transporter.sendMail(replyMailOptions);
            console.log(`お問い合わせメール送信完了 - ID: ${contactId}, From: ${email}`);
        } catch (mailError) {
            console.error('メール送信エラー:', mailError);
            // メール送信に失敗してもデータベース保存は成功とする
        }

        res.json({
            success: true,
            message: 'お問い合わせを承りました。ご返信をお待ちください。',
            contactId: contactId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('お問い合わせ処理エラー:', error);
        res.status(500).json({
            success: false,
            error: 'サーバーエラーが発生しました。時間をおいて再試行してください。'
        });
    }
});

// お問い合わせ一覧取得（管理者用）
router.get('/list', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const status = req.query.status || 'all';

        const db = database.getDb();
        
        let whereClause = '';
        let queryParams = [];
        
        if (status !== 'all') {
            whereClause = 'WHERE status = ?';
            queryParams = [status];
        }

        // 総件数取得
        const countSql = `SELECT COUNT(*) as total FROM contacts ${whereClause}`;
        const total = await new Promise((resolve, reject) => {
            db.get(countSql, queryParams, (err, row) => {
                if (err) reject(err);
                else resolve(row.total);
            });
        });

        // データ取得
        const dataSql = `
            SELECT id, name, email, phone, subject, message, status, created_at, updated_at
            FROM contacts 
            ${whereClause}
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `;
        
        const contacts = await new Promise((resolve, reject) => {
            db.all(dataSql, [...queryParams, limit, offset], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json({
            success: true,
            data: {
                contacts,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('お問い合わせ一覧取得エラー:', error);
        res.status(500).json({
            success: false,
            error: 'データの取得に失敗しました'
        });
    }
});

module.exports = router;