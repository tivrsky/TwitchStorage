# Twitch Stream Saver

Twitch 配信を保存するための Chrome 拡張機能です。

## 機能

- Twitch 配信のリアルタイム保存
- 複数画質の選択（720p、480p、360p 等）
- 配信情報の自動取得（配信者名、タイトル、視聴者数）
- 使いやすいポップアップインターフェース
- バックグラウンドでの録画処理

## インストール方法

### 1. ファイルの準備

以下のファイルをすべて同じフォルダに配置してください：

```
twitch-stream-saver/
├── manifest.json
├── popup.html
├── popup.js
├── content.js
├── background.js
├── inject.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### 2. アイコンファイルの作成

`icons`フォルダを作成し、以下のサイズのアイコンを用意してください：

- `icon16.png` (16x16px)
- `icon48.png` (48x48px)
- `icon128.png` (128x128px)

### 3. Chrome 拡張機能の読み込み

1. Chrome ブラウザを開きます
2. アドレスバーに `chrome://extensions/` と入力
3. 右上の「デベロッパーモード」を有効にします
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. 作成したフォルダを選択します

## 使用方法

### 1. 基本的な使用手順

1. **Twitch の配信ページを開く**

   - 保存したい配信のページに移動します

2. **拡張機能のアイコンをクリック**

   - ツールバーの Twitch Stream Saver アイコンをクリック

3. **画質を選択**

   - ポップアップから希望する画質を選択します
   - 最高画質、720p60、720p30、480p30、360p30、最低画質から選択可能

4. **配信 URL を取得**

   - 「配信 URL を取得」ボタンをクリック
   - 配信の HLS URL が自動的に検出されます

5. **ダウンロード開始**

   - 「ダウンロード開始」ボタンをクリック
   - 録画が開始されます

6. **録画停止**
   - 「録画停止」ボタンをクリックして録画を終了

### 2. 対応配信

- ライブ配信
- 過去の配信（VOD）
- クリップ

### 3. 保存されるファイル

- ファイル形式：.ts (Transport Stream)
- ファイル名：`twitch-{配信者名}-{日時}.ts`
- 保存場所：Chrome のデフォルトダウンロードフォルダ

## 注意事項

### 法的制約

- **私的利用の範囲内でのみ使用してください**
- 配信者の著作権を尊重してください
- 商用利用や再配布は禁止されています
- 配信の保存は個人的な視聴目的に限定してください

### 技術的制約

- 一部の配信では保存に失敗する場合があります
- 高画質での録画は大容量のファイルが生成されます
- 長時間の録画は PC の性能に影響を与える可能性があります

### トラブルシューティング

#### 「配信 URL を取得できません」エラー

- ページを再読み込みしてください
- 配信が実際に開始されているか確認してください
- 拡張機能を一度無効にして再度有効にしてください

#### ダウンロードが開始されない

- Chrome のダウンロード設定を確認してください
- ポップアップブロッカーを無効にしてください
- 拡張機能の権限を確認してください

#### 録画ファイルが再生できない

- VLC Media Player などの対応プレイヤーを使用してください
- ファイルが完全にダウンロードされているか確認してください

## 開発者向け情報

### ファイル構成

- `manifest.json`: 拡張機能の設定
- `popup.html/js`: ユーザーインターフェース
- `content.js`: Twitch ページでの情報取得
- `background.js`: バックグラウンド処理
- `inject.js`: ページコンテキストでのネットワーク監視

### カスタマイズ

拡張機能の動作をカスタマイズしたい場合は、以下のファイルを編集してください：

- **画質オプションの追加**: `popup.html`の select タグを編集
- **UI の変更**: `popup.html`の CSS を編集
- **録画ロジックの変更**: `background.js`を編集

### デバッグ

- `chrome://extensions/`でバックグラウンドページを検査
- コンソールログでエラーや動作を確認
- Twitch ページでの動作は DevTools のコンソールで確認

## 更新履歴

### v1.0.0

- 初回リリース
- 基本的な録画機能
- 配信情報の自動取得
- 複数画質対応

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。

## 免責事項

この拡張機能は教育目的で作成されています。使用によって生じたいかなる問題についても、開発者は責任を負いません。Twitch の利用規約を必ず確認し、遵守してください。
