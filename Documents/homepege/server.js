const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// ルートのインポート
const contactRoutes = require('./routes/contact');
const snsRoutes = require('./routes/sns');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// セキュリティミドルウェア
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'"]
        }
    }
}));

// CORS設定
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-domain.com'] 
        : ['http://localhost:3000', 'http://127.0.0.1:3000', 'file://'],
    credentials: true
}));

// レート制限
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 100, // 最大100リクエスト
    message: {
        error: 'リクエスト制限を超えました。15分後に再試行してください。'
    }
});

const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1時間
    max: 5, // 最大5件のお問い合わせ
    message: {
        error: 'お問い合わせの送信制限を超えました。1時間後に再試行してください。'
    }
});

app.use('/api/', limiter);
app.use('/api/contact', contactLimiter);

// ログ
app.use(morgan('combined'));

// ボディパーサー
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静的ファイルの提供
app.use(express.static(path.join(__dirname), {
    index: 'index.html',
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1日
        }
    }
}));

// API ルート
app.use('/api/contact', contactRoutes);
app.use('/api/sns', snsRoutes);
app.use('/api/admin', adminRoutes);

// ヘルスチェック
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: require('./package.json').version
    });
});

// 404ハンドラー（APIリクエスト用）
app.use('/api/*', (req, res) => {
    res.status(404).json({
        error: 'APIエンドポイントが見つかりません',
        path: req.path,
        method: req.method
    });
});

// HTMLファイルのルート
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/results', (req, res) => {
    res.sendFile(path.join(__dirname, 'results.html'));
});

app.get('/access', (req, res) => {
    res.sendFile(path.join(__dirname, 'access.html'));
});

app.get('/sns', (req, res) => {
    res.sendFile(path.join(__dirname, 'sns.html'));
});

// SPAのフォールバック
app.get('*', (req, res) => {
    // 拡張子がない場合はindex.htmlを返す
    if (!path.extname(req.path)) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        res.status(404).send('ファイルが見つかりません');
    }
});

// グローバルエラーハンドラー
app.use((err, req, res, next) => {
    console.error('エラーが発生しました:', err);
    
    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            error: 'ファイルサイズが大きすぎます'
        });
    }
    
    res.status(500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'サーバーエラーが発生しました' 
            : err.message
    });
});

// データベース初期化
const db = require('./database/init');
db.init().then(() => {
    console.log('データベースが初期化されました');
}).catch(err => {
    console.error('データベース初期化エラー:', err);
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`🎾 テニス部ホームページサーバーが起動しました`);
    console.log(`📱 URL: http://localhost:${PORT}`);
    console.log(`🔧 環境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ 開始時刻: ${new Date().toLocaleString('ja-JP')}`);
});

module.exports = app;