# MonoTransmotion Web アプリ - セットアップ手順

MonoTransmotion フレームワークを統合し、リアルタイムで人物の 3D 位置推定と軌跡予測を行うアプリケーションです。

## 前提条件
- Python 3.9 以上
- Node.js と npm
- Web カメラ（または映像ストリームのソース）

## インストール

### 1. バックエンドのセットアップ
```bash
cd backend
pip install -r requirements.txt
```

### 2. チェックポイント（重要）
[MonoTransmotion Releases](https://github.com/vita-epfl/MonoTransmotion/releases) から学習済みチェックポイントをダウンロードし、以下のパスに配置してください。
- `models/MonoTransmotion/checkpoints/localization.pth`
- `models/MonoTransmotion/checkpoints/traj_pred.pth`

その後、`models/MonoTransmotion/code/configs/` 内の `configs/*.yaml` ファイルを編集し、チェックポイントへの絶対パスを指定します。
```yaml
MODEL:
    checkpoint: "C:/absolute/path/to/localization.pth"
```

### 3. フロントエンドのセットアップ
```bash
cd frontend
npm install
```

## アプリの起動

### 1. バックエンドを起動する
```bash
cd backend
python main.py
```
バックエンドは `http://localhost:8000` で起動します。初回起動時に `yolov8n-pose.pt` が自動ダウンロードされます。

### 2. フロントエンドを起動する
```bash
cd frontend
npm run dev
```
ブラウザで `http://localhost:5173` を開いてください。

## アーキテクチャの補足
- **バックエンド:** FastAPI が WebSocket 接続を処理し、YOLOv8-pose で 2D スケルトンを抽出したうえで、MonoTransmotion の位置推定モデルと軌跡予測モデルに結果を渡します。
- **フロントエンド:** React が Web カメラの映像をキャプチャし、フレームをバックエンドに送信して、結果を 2D 俯瞰マップ（BEV）キャンバスに描画します。
