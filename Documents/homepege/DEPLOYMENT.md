# 🎾 テニス部ホームページ - デプロイガイド

## 🚀 本番環境へのデプロイ手順

### 前提条件
- Node.js 16.0.0以上
- npm または yarn
- GitHubアカウント

### 1. 環境変数の設定
`.env.production`ファイルを参考に、以下の環境変数を設定してください：

```bash
NODE_ENV=production
PORT=3000
JWT_SECRET=your-secure-secret-key
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ADMIN_EMAIL=admin@your-domain.com
ALLOWED_ORIGINS=https://your-domain.com
```

### 2. Gmail設定（メール送信機能用）
1. Googleアカウントで2段階認証を有効にする
2. アプリパスワードを生成する
3. `SMTP_USER`と`SMTP_PASS`に設定する

### 3. デプロイ先別の手順

#### 🌟 Render（推奨・無料）
1. [render.com](https://render.com)でアカウント作成
2. "New Web Service"を選択
3. GitHubリポジトリを接続
4. 設定：
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - 環境変数を設定

#### 🚄 Railway
1. [railway.app](https://railway.app)でアカウント作成
2. "Deploy from GitHub repo"を選択
3. 自動デプロイ完了

#### ⚡ Vercel
1. [vercel.com](https://vercel.com)でアカウント作成
2. GitHubリポジトリをインポート
3. 環境変数を設定

### 4. 本番環境での注意事項

#### セキュリティ
- [ ] `JWT_SECRET`を強力なランダム文字列に変更
- [ ] `ADMIN_EMAIL`を実際のメールアドレスに設定
- [ ] `ALLOWED_ORIGINS`を実際のドメインに設定

#### データベース
- [ ] SQLiteファイルのバックアップ
- [ ] 本番環境での初期データ設定

#### メール機能
- [ ] Gmail設定の確認
- [ ] 送信テストの実行

### 5. 動作確認
デプロイ後、以下の機能をテストしてください：

- [ ] ホームページの表示
- [ ] お問い合わせフォームの送信
- [ ] SNSフィードの表示
- [ ] 管理者ログイン
- [ ] レスポンシブデザイン

### 6. カスタムドメインの設定
各サービスでカスタムドメインを設定する方法：

#### Render
1. ダッシュボードで"Settings" → "Custom Domains"
2. ドメインを追加してDNS設定

#### Railway
1. プロジェクト設定で"Custom Domain"
2. CNAMEレコードを設定

#### Vercel
1. プロジェクト設定で"Domains"
2. ドメインを追加してネームサーバー設定

## 🛠️ トラブルシューティング

### よくある問題
1. **メール送信エラー** → Gmail設定を確認
2. **データベースエラー** → ファイルパスを確認
3. **CORS エラー** → `ALLOWED_ORIGINS`を確認
4. **ビルドエラー** → Node.jsバージョンを確認

### ログの確認
```bash
# Renderの場合
ログタブでリアルタイム確認

# Railwayの場合  
デプロイメントログを確認

# ローカルデバッグ
npm run dev
```

## 📞 サポート
問題が発生した場合は、ログを確認してから対応してください。