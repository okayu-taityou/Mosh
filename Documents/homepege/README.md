# 🎾 大学テニス部ホームページ

美しく機能的な大学テニス部のウェブサイト。Node.js + Express + SQLiteで作られたバックエンド機能付き。

## ✨ 機能

### 🎯 フロントエンド
- **レスポンシブデザイン**: モバイル・タブレット・デスクトップ対応
- **現代的なUI**: 水色をメインとしたクリーンなデザイン
- **インタラクティブな機能**: スムーススクロール、アニメーション
- **複数ページ構成**: ホーム・試合結果・アクセス・SNS

### 🔧 バックエンド
- **お問い合わせ機能**: バリデーション・自動返信メール
- **SNS投稿管理**: 投稿表示・エンゲージメント管理
- **管理者ダッシュボード**: 統計情報・投稿管理
- **セキュリティ**: レート制限・JWT認証・データベース保護

## 🚀 クイックスタート

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境設定

```bash
# 環境設定ファイルをコピー
cp .env.example .env

# 必要に応じて .env ファイルを編集
nano .env
```

### 3. サーバー起動

```bash
# 開発モード
npm run dev

# 本番モード  
npm start
```

### 4. ブラウザでアクセス

```
http://localhost:3000
```

## 📚 API エンドポイント

### 🔍 お問い合わせ API

```bash
# お問い合わせ送信
POST /api/contact/send
Content-Type: application/json

{
  "name": "山田太郎",
  "email": "yamada@example.com", 
  "phone": "090-1234-5678",
  "subject": "入部について",
  "message": "テニス部への入部を検討しています..."
}

# お問い合わせ一覧取得（管理者用）
GET /api/contact/list?page=1&limit=10&status=unread
Authorization: Bearer <JWT_TOKEN>
```

### 📱 SNS API

```bash
# SNS投稿一覧取得
GET /api/sns/posts?limit=10&platform=instagram

# エンゲージメント更新
POST /api/sns/posts/1/engagement
Content-Type: application/json

{
  "type": "likes",
  "increment": 1
}

# 模擬投稿生成（開発用）
POST /api/sns/generate-mock-post
```

### 👨‍💼 管理者 API

```bash
# 初期管理者作成（初回のみ）
POST /api/admin/setup
Content-Type: application/json

{
  "username": "admin",
  "password": "secure-password",
  "email": "admin@tennis-club.com"
}

# ログイン
POST /api/admin/login
Content-Type: application/json

{
  "username": "admin", 
  "password": "secure-password"
}

# ダッシュボード統計
GET /api/admin/dashboard
Authorization: Bearer <JWT_TOKEN>
```

## 🗃️ データベース構造

### contacts テーブル
| カラム | 型 | 説明 |
|--------|----|----|
| id | INTEGER | 主キー |
| name | TEXT | お名前 |
| email | TEXT | メールアドレス |
| phone | TEXT | 電話番号 |
| subject | TEXT | 件名 |
| message | TEXT | メッセージ |
| status | TEXT | ステータス (unread/read/replied/closed) |
| created_at | DATETIME | 作成日時 |

### sns_posts テーブル  
| カラム | 型 | 説明 |
|--------|----|----|
| id | INTEGER | 主キー |
| platform | TEXT | SNSプラットフォーム |
| author | TEXT | 投稿者 |
| content | TEXT | 投稿内容 |
| likes_count | INTEGER | いいね数 |
| comments_count | INTEGER | コメント数 |
| shares_count | INTEGER | シェア数 |
| is_active | BOOLEAN | 有効フラグ |
| created_at | DATETIME | 作成日時 |

## 📁 プロジェクト構造

```
tennis-club-website/
├── server.js              # メインサーバーファイル
├── package.json           # 依存関係定義
├── .env                   # 環境設定
├── database/
│   ├── init.js            # データベース初期化
│   └── tennis_club.db     # SQLiteデータベース
├── routes/
│   ├── contact.js         # お問い合わせAPI
│   ├── sns.js            # SNS API
│   └── admin.js          # 管理者API
├── index.html            # メインページ
├── results.html          # 試合結果ページ
├── access.html           # アクセスページ  
├── sns.html              # SNSページ
├── style.css             # スタイルシート
├── script.js             # メインスクリプト
├── contact.js            # お問い合わせ機能
├── sns.js               # SNS機能
└── results.js           # 試合結果機能
```

## 🔐 セキュリティ機能

- **レート制限**: API呼び出し制限（15分間で100回）
- **お問い合わせ制限**: 1時間で5件まで
- **JWT認証**: 管理者機能の保護
- **入力検証**: XSS・SQLインジェクション対策
- **CSP**: コンテンツセキュリティポリシー
- **CORS**: クロスオリジンリクエスト制御

## 📧 メール設定

### Gmail使用の場合

1. Googleアカウントの2段階認証を有効化
2. アプリパスワードを生成
3. `.env`ファイルに設定：

```env
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password  
ADMIN_EMAIL=admin@tennis-club.com
```

### 他のSMTPサービス

`routes/contact.js`の`createMailTransporter`関数を編集してください。

## 🚢 デプロイ

### Herokuでのデプロイ

```bash
# Heroku CLIインストール後
heroku create tennis-club-app
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-production-secret
heroku config:set SMTP_USER=your-email@gmail.com
heroku config:set SMTP_PASS=your-app-password
git push heroku main
```

### VPS/専用サーバー

```bash
# PM2でプロセス管理
npm install -g pm2
pm2 start server.js --name tennis-club
pm2 save
pm2 startup
```

## 🛠️ 開発

### ファイル監視での開発

```bash
npm run dev
```

### デバッグログの確認

```bash
# サーバーログ
tail -f logs/app.log

# データベース内容確認
sqlite3 database/tennis_club.db
.tables
SELECT * FROM contacts LIMIT 5;
```

## 📞 サポート

### よくある質問

**Q: メールが送信されない**
A: `.env`ファイルのSMTP設定を確認してください。開発環境では模擬メールが使用されます。

**Q: 管理者にログインできない**
A: まず`POST /api/admin/setup`で初期管理者を作成してください。

**Q: データベースエラーが発生する**
A: `database`ディレクトリの書き込み権限を確認してください。

### 技術サポート

- GitHub Issues: プロジェクトページで問題を報告
- メール: admin@tennis-club.com
- 電話: 大学テニス部まで

## 📄 ライセンス

MIT License - 自由にご利用ください

## 🎾 開発者

○○大学テニス部 技術チーム

---

**楽しいテニスライフを！** 🎾✨

## 特徴

- **レスポンシブデザイン**: PCからスマートフォンまで、あらゆるデバイスで最適化された表示
- **モダンなUI/UX**: 清潔で見やすいデザイン
- **スムーススクロール**: ナビゲーション機能
- **お問い合わせフォーム**: 新入部員募集や見学希望者向け
- **部員紹介**: 現役部員の紹介セクション
- **活動紹介**: 練習や大会、イベントの詳細

## ページ構成

### メインセクション
1. **ヒーローセクション** - 部の魅力的な紹介
2. **部について** - テニス部の概要、統計情報
3. **活動紹介** - 練習、大会、合宿・イベント
4. **部員紹介** - 主要メンバーの紹介
5. **お知らせ** - 最新情報、イベント情報
6. **お問い合わせ** - 連絡先、見学・体験入部フォーム

## ファイル構成

```
/
├── index.html          # メインHTMLファイル
├── style.css           # スタイルシート
├── script.js           # JavaScript機能
└── README.md          # このファイル
```

## 使用技術

- **HTML5**: セマンティックなマークアップ
- **CSS3**: Flexbox、Grid、アニメーション
- **JavaScript (ES6+)**: インタラクティブ機能
- **Google Fonts**: Noto Sans JP フォント

## 機能

### ナビゲーション
- 固定ヘッダー
- スムーススクロール
- アクティブセクションのハイライト
- モバイル用ハンバーガーメニュー

### レスポンシブ対応
- タブレット (768px以下)
- スマートフォン (480px以下)

### アニメーション
- スクロール時の要素表示アニメーション
- ホバーエフェクト
- トランジション効果

### フォーム機能
- 入力値バリデーション
- メールアドレス形式チェック
- フォーム送信処理（アラート表示）

## カスタマイズ方法

### 1. 大学名・部名の変更
`index.html`内の「○○大学テニス部」を実際の大学名に変更してください。

### 2. 画像の追加
現在はプレースホルダー画像を使用しています。実際の画像に変更する場合：

```html
<!-- 変更前 -->
<img src="https://via.placeholder.com/600x400/4a90e2/ffffff?text=Tennis+Court" alt="テニスコート">

<!-- 変更後 -->
<img src="images/tennis-court.jpg" alt="テニスコート">
```

### 3. 部員情報の更新
`index.html`の部員紹介セクションで、実際の部員情報に変更してください。

### 4. 連絡先の変更
お問い合わせセクションの連絡先情報を実際の情報に変更してください。

### 5. 色の変更
`style.css`でカラーパレットを変更できます：

```css
/* メインカラー */
--primary-color: #3498db;
--secondary-color: #2c3e50;
--accent-color: #e74c3c;
```

## 展開方法

1. **ファイルの配置**: すべてのファイルをWebサーバーにアップロード
2. **画像の追加**: `images/` フォルダを作成し、実際の画像を配置
3. **ドメイン設定**: 大学のドメインまたはサブドメインを設定
4. **SSL証明書**: HTTPS対応を推奨

## メンテナンス

### 定期更新が必要な項目
- お知らせセクション
- 部員紹介（卒業・入部に伴う更新）
- 大会結果
- 活動写真

### SEO対策
- ページタイトルの最適化
- メタディスクリプションの追加
- 構造化データの実装
- sitemap.xmlの作成

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## お問い合わせ

ホームページに関するご質問やカスタマイズのご依頼は、以下までご連絡ください：
- GitHub Issues
- メール: [連絡先メールアドレス]

---

© 2024 ○○大学テニス部. All rights reserved.