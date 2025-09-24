const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'tennis_club.db');

class Database {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(DB_PATH, (err) => {
                if (err) {
                    console.error('データベース接続エラー:', err);
                    reject(err);
                } else {
                    console.log('SQLiteデータベースに接続しました');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            // お問い合わせテーブル
            const createContactsTable = `
                CREATE TABLE IF NOT EXISTS contacts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    phone TEXT,
                    subject TEXT,
                    message TEXT NOT NULL,
                    status TEXT DEFAULT 'unread',
                    ip_address TEXT,
                    user_agent TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            // SNS投稿テーブル
            const createSnsPostsTable = `
                CREATE TABLE IF NOT EXISTS sns_posts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    platform TEXT NOT NULL,
                    author TEXT NOT NULL,
                    content TEXT NOT NULL,
                    image_url TEXT,
                    likes_count INTEGER DEFAULT 0,
                    comments_count INTEGER DEFAULT 0,
                    shares_count INTEGER DEFAULT 0,
                    post_url TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            // 管理者テーブル
            const createAdminsTable = `
                CREATE TABLE IF NOT EXISTS admins (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    role TEXT DEFAULT 'admin',
                    last_login DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            // 活動記録テーブル
            const createActivitiesTable = `
                CREATE TABLE IF NOT EXISTS activities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT,
                    date DATE NOT NULL,
                    type TEXT DEFAULT 'practice',
                    location TEXT,
                    participants INTEGER,
                    images TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            // 試合結果テーブル
            const createMatchResultsTable = `
                CREATE TABLE IF NOT EXISTS match_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tournament_name TEXT NOT NULL,
                    match_date DATE NOT NULL,
                    opponent TEXT,
                    our_score INTEGER,
                    opponent_score INTEGER,
                    result TEXT NOT NULL,
                    venue TEXT,
                    weather TEXT,
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            const tables = [
                createContactsTable,
                createSnsPostsTable,
                createAdminsTable,
                createActivitiesTable,
                createMatchResultsTable
            ];

            let completed = 0;
            const total = tables.length;

            tables.forEach((sql, index) => {
                this.db.run(sql, (err) => {
                    if (err) {
                        console.error(`テーブル作成エラー (${index}):`, err);
                        reject(err);
                    } else {
                        completed++;
                        if (completed === total) {
                            console.log('すべてのテーブルが作成されました');
                            this.insertSampleData().then(resolve).catch(reject);
                        }
                    }
                });
            });
        });
    }

    async insertSampleData() {
        return new Promise((resolve, reject) => {
            // サンプルSNS投稿データ
            const samplePosts = [
                {
                    platform: 'instagram',
                    author: '○○大学テニス部',
                    content: '今日は春季大会の練習試合でした！みんな調子よく、来週の本戦が楽しみです🎾 #テニス #大学テニス #春季大会',
                    likes_count: 42,
                    comments_count: 8,
                    shares_count: 3
                },
                {
                    platform: 'twitter',
                    author: '○○大学テニス部',
                    content: '新入部員募集中です！経験者・初心者問わず大歓迎！一緒にテニスを楽しみましょう！',
                    likes_count: 28,
                    comments_count: 5,
                    shares_count: 12
                },
                {
                    platform: 'instagram',
                    author: '○○大学テニス部',
                    content: 'コート整備お疲れ様でした！綺麗になったコートで明日からまた頑張ります💪',
                    likes_count: 35,
                    comments_count: 6,
                    shares_count: 2
                }
            ];

            let completed = 0;
            const total = samplePosts.length;

            if (total === 0) {
                resolve();
                return;
            }

            samplePosts.forEach(post => {
                const sql = `
                    INSERT OR IGNORE INTO sns_posts 
                    (platform, author, content, likes_count, comments_count, shares_count) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                
                this.db.run(sql, [
                    post.platform,
                    post.author,
                    post.content,
                    post.likes_count,
                    post.comments_count,
                    post.shares_count
                ], (err) => {
                    if (err) {
                        console.error('サンプルデータ挿入エラー:', err);
                    }
                    completed++;
                    if (completed === total) {
                        console.log('サンプルデータが挿入されました');
                        resolve();
                    }
                });
            });
        });
    }

    getDb() {
        return this.db;
    }

    close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('データベースクローズエラー:', err);
                    } else {
                        console.log('データベース接続を閉じました');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

const database = new Database();
module.exports = database;