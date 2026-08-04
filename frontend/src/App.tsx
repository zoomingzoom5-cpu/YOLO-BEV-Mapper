import { useEffect, useRef, useState } from 'react';
import './App.css';

interface Detection {
  id: number;
  pos3d: number[] | null;
  trajectory: number[][] | null;
  quality?: string;
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasBevRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const demoMode = new URLSearchParams(window.location.search).get('demo') === '1';
  const [detections, setDetections] = useState<Detection[]>([]);
  const [detectedCount, setDetectedCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  const openDebugView = () => {
    const debugUrl = 'http://127.0.0.1:8000/debug';
    window.open(debugUrl, 'monoloco-debug', 'width=960,height=720');
  };

  useEffect(() => {
    if (demoMode) {
      setIsConnected(true);
      return;
    }

    const configuredUrl = import.meta.env.VITE_WS_URL;
    const isViteDevServer = window.location.port === '5173';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = isViteDevServer
      ? `${window.location.hostname}:8000`
      : window.location.host;
    const ws = new WebSocket(configuredUrl || `${wsProtocol}//${wsHost}/ws/process`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('バックエンドに接続しました');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status === 'success') {
        setDetections(data.detections);
        setDetectedCount(data.count ?? data.detections.length);
      }
    };

    ws.onclose = () => {
      console.log('バックエンドから切断されました');
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) {
      return;
    }

    // Web カメラを起動する
    async function startWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: { ideal: 16 / 9 },
          },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Web カメラへのアクセスエラー:', err);
      }
    }
    startWebcam();
  }, [demoMode]);

  useEffect(() => {
    if (!demoMode) {
      return;
    }

    const createDemoDetections = (tick: number): Detection[] => {
      const drift = Math.sin(tick / 10) * 0.35;
      const walk = Math.cos(tick / 12) * 0.25;
      return [
        {
          id: 1,
          pos3d: [-1.2 + drift, 0, 4.8 + walk],
          trajectory: [[-1.0, 4.45], [-0.75, 4.15], [-0.5, 3.85], [-0.25, 3.55]],
          quality: 'pose-height',
        },
        {
          id: 2,
          pos3d: [1.45 - drift * 0.5, 0, 6.6],
          trajectory: [[1.2, 6.3], [0.95, 6.05], [0.7, 5.8], [0.45, 5.55]],
          quality: 'homography-ready',
        },
        {
          id: 3,
          pos3d: [0.1, 0, 2.9 + walk * 0.4],
          trajectory: [[0.25, 3.1], [0.45, 3.35], [0.65, 3.6]],
          quality: 'box-height',
        },
      ];
    };

    let tick = 0;
    const updateDemo = () => {
      const nextDetections = createDemoDetections(tick);
      setDetections(nextDetections);
      setDetectedCount(nextDetections.length);
      tick += 1;
    };

    updateDemo();
    const interval = setInterval(updateDemo, 300);
    return () => clearInterval(interval);
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) {
      return;
    }

    // バックエンドにフレームを送信する
    const interval = setInterval(() => {
      if (wsRef.current && isConnected && videoRef.current && captureCanvasRef.current) {
        const video = videoRef.current;
        const canvas = captureCanvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (ctx && video.readyState === 4 && video.videoWidth > 0) {
          // キャンバスのサイズを動画に同期する
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
          
          // 動画を非表示キャンバスに描画して base64 を取得する
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64Image = canvas.toDataURL('image/jpeg', 0.5);
          wsRef.current.send(base64Image);
        }
      }
    }, 100); // 10 FPSで送信

    return () => clearInterval(interval);
  }, [demoMode, isConnected]);

  // 俯瞰マップ（Bird's Eye View）を描画する
  useEffect(() => {
    if (canvasBevRef.current) {
      const canvas = canvasBevRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // グリッドを描画する
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.width; i += 50) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        }
        for (let i = 0; i < canvas.height; i += 50) {
          ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
        }

        // 中心点（カメラ位置を表す）
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height - 20, 5, 0, 2 * Math.PI); ctx.fill();

        detections.forEach(det => {
          if (det.pos3d) {
            // 3D 座標 (X, Y, Z) を俯瞰マップ (X, Z) にマッピングする
            // バックエンドの pos3d は [横方向X, 高さY, 奥行きZ]（メートル単位）
            // X が左右、Z が奥行き方向。スケール値でピクセルに変換する。
            const scale = 50; // 1メートル = 50ピクセル
            const bevX = canvas.width / 2 + det.pos3d[0] * scale;
            const bevZ = canvas.height - 20 - det.pos3d[2] * scale;
            
            // 現在位置を描画する
            ctx.fillStyle = '#00ff00';
            ctx.beginPath(); ctx.arc(bevX, bevZ, 8, 0, 2 * Math.PI); ctx.fill();

            ctx.fillStyle = '#c9d1d9';
            ctx.font = '12px monospace';
            ctx.fillText(`#${det.id}`, bevX + 10, bevZ - 10);
            
            // 予測軌跡を描画する
            if (det.trajectory && det.trajectory.length > 0) {
              ctx.strokeStyle = '#00ffff';
              ctx.setLineDash([5, 5]);
              ctx.beginPath();
              ctx.moveTo(bevX, bevZ);
              det.trajectory.forEach(pt => {
                // 軌跡はワールド空間の XZ 座標として扱う
                const tx = canvas.width / 2 + pt[0] * scale;
                const tz = canvas.height - 20 - pt[1] * scale;
                ctx.lineTo(tx, tz);
              });
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        });
      }
    }
  }, [detections]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Live2DSpaceView</h1>
        <div className="header-actions">
          <button type="button" className="debug-button" onClick={openDebugView}>
            Debug View
          </button>
          <div className={`status ${isConnected ? 'online' : 'offline'}`}>
            {demoMode ? 'デモモード' : isConnected ? 'バックエンド接続中' : 'バックエンドに接続中...'}
          </div>
        </div>
      </header>
      
      <main className="App-main">
        <video ref={videoRef} autoPlay playsInline muted className="privacy-capture" />
        <canvas ref={captureCanvasRef} className="privacy-capture" />

        <section className="summary-grid">
          <div className="metric-panel">
            <span>検出人数</span>
            <strong>{detectedCount}</strong>
          </div>
          <div className="metric-panel">
            <span>マッピング済み</span>
            <strong>{detections.filter(det => det.pos3d).length}</strong>
          </div>
        </section>

        <section className="bev-panel">
          <h3>俯瞰マップ</h3>
          <div className="canvas-wrapper">
            <canvas ref={canvasBevRef} width={700} height={620} />
          </div>
        </section>
      </main>

      <div className="detections-info">
        <h3>リアルタイム検出情報</h3>
        <ul>
          {detections.map(det => (
            <li key={det.id}>
              ID: {det.id} | 
              3D 位置: {det.pos3d ? `${det.pos3d[0].toFixed(2)}, ${det.pos3d[1].toFixed(2)}, ${det.pos3d[2].toFixed(2)} m` : 'なし'}
              {det.quality ? ` | ${det.quality}` : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
