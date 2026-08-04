import cv2
import numpy as np
import json
import time
from ultralytics import YOLO

class BEVMapper:
    def __init__(self, src_points, dst_points):
        """
        src_points: 画像上の 4 点 (x, y) — 床面の矩形の角
        dst_points: 対応する俯瞰座標 (BEV) 上の 4 点 (X, Y)
        """
        self.src_points = np.float32(src_points)
        self.dst_points = np.float32(dst_points)
        self.M = cv2.getPerspectiveTransform(self.src_points, self.dst_points)

    def transform(self, x, y):
        """画像座標 (x, y) を俯瞰座標 (BEV) (X, Y) に変換する。"""
        points = np.array([[[x, y]]], dtype=np.float32)
        transformed = cv2.perspectiveTransform(points, self.M)
        return transformed[0][0]

def main():
    # YOLOv8 モデルを読み込む（高速化のため Nano 版を使用）
    model = YOLO("yolov8n.pt")

    # カメラのセットアップ
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("エラー: Web カメラを開けませんでした。")
        return

    # --- キャリブレーション用ポイント（例）---
    # 実際のカメラ映像に合わせて調整してください。
    # 床面に 2m × 2m の正方形があると仮定します。
    # src: 画像ピクセル上の [左上, 右上, 右下, 左下]
    src = [[200, 300], [440, 300], [600, 450], [40, 450]]
    # dst: 対応するワールド座標（例: センチメートル単位）
    dst = [[0, 0], [200, 0], [200, 200], [0, 200]]

    mapper = BEVMapper(src, dst)

    print("検出を開始します... 'q' キーで終了")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # YOLO で人物検出を実行する
            results = model(frame, verbose=False, classes=[0])  # クラス 0 = 人物

            detections = []
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    # バウンディングボックスの座標を取得する
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = box.conf[0].item()

                    # バウンディングボックスの下端中央（足元の代表点）
                    feet_x = (x1 + x2) / 2
                    feet_y = y2

                    # 俯瞰座標 (BEV) にマッピングする
                    bev_x, bev_y = mapper.transform(feet_x, feet_y)

                    detections.append({
                        "id": int(time.time() * 1000),  # 仮の ID
                        "image_coords": [round(feet_x, 1), round(feet_y, 1)],
                        "bev_coords": [round(bev_x, 1), round(bev_y, 1)],
                        "confidence": round(conf, 2)
                    })

            # ターミナルに JSON として出力する
            if detections:
                print(json.dumps(detections))

            # 任意: 可視化（CLI モードでは無効にできる）
            for d in detections:
                ix, iy = d["image_coords"]
                cv2.circle(frame, (int(ix), int(iy)), 5, (0, 255, 0), -1)
            
            cv2.imshow("Webcam YOLO BEV", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
