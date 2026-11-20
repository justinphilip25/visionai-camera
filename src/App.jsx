
import React, { useEffect, useRef, useState } from "react";
import {
  Camera, CameraOff, SwitchCamera, Zap, ZapOff, Settings,
  Image, ScanFace, Sparkles, Aperture, Timer, X,
  Check, RefreshCw, Download, Trash2, Sun, Maximize,
  CircleDot, Focus, ShieldCheck, Brain, SlidersHorizontal
} from "lucide-react";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const timerRef = useRef(null);
  const lastDetectionRef = useRef(0);
  const stableRef = useRef(0);
  const faceSeenRef = useRef(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState("environment");
  const [flash, setFlash] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState("PHOTO");
  const [aiOn, setAiOn] = useState(true);
  const [autoCapture, setAutoCapture] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [faceStatus, setFaceStatus] = useState("AI STANDBY");
  const [photos, setPhotos] = useState([]);
  const [preview, setPreview] = useState(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filter, setFilter] = useState("none");
  const [countdown, setCountdown] = useState(null);
  const [error, setError] = useState("");
  const [detectorReady, setDetectorReady] = useState(false);

  const filters = [
    { name: "Original", value: "none" },
    { name: "Mono", value: "grayscale(1)" },
    { name: "Vintage", value: "sepia(.7)" },
    { name: "Vivid", value: "saturate(1.8)" },
    { name: "Cool", value: "hue-rotate(20deg)" }
  ];

  async function startCamera(nextFacing = facing) {
    stopCamera();
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      setFacing(nextFacing);
    } catch (e) {
      setError("Camera access unavailable. Allow camera permission and use HTTPS.");
      setCameraOn(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    clearInterval(timerRef.current);
    setCameraOn(false);
  }

  async function switchCamera() {
    const next = facing === "environment" ? "user" : "environment";
    await startCamera(next);
  }

  async function initializeAI() {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
      );
      detectorRef.current = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.65
      });
      setDetectorReady(true);
    } catch (e) {
      setFaceStatus("AI UNAVAILABLE");
    }
  }

  useEffect(() => {
    initializeAI();
    return () => {
      stopCamera();
      if (detectorRef.current) detectorRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (!cameraOn || !aiOn || !detectorReady) return;
    timerRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !detectorRef.current) return;
      try {
        const now = performance.now();
        if (now - lastDetectionRef.current < 250) return;
        lastDetectionRef.current = now;
        const result = detectorRef.current.detectForVideo(video, now);
        const count = result.detections.length;
        setFaceCount(count);
        if (count > 0) {
          setFaceStatus("FACE DETECTED");
          faceSeenRef.current = true;
          stableRef.current += 1;
          if (autoCapture && stableRef.current >= 8 && countdown === null) {
            takePhoto();
            stableRef.current = 0;
          }
        } else {
          setFaceStatus("SEARCHING FOR FACE");
          faceSeenRef.current = false;
          stableRef.current = 0;
        }
      } catch (e) {
        setFaceStatus("AI SCANNING");
      }
    }, 250);
    return () => clearInterval(timerRef.current);
  }, [cameraOn, aiOn, detectorReady, autoCapture, countdown]);

  function takePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.filter = filter;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const image = canvas.toDataURL("image/jpeg", 0.95);
    const item = { id: Date.now(), image, date: new Date().toLocaleString() };
    setPhotos(old => [item, ...old]);
    setPreview(item);
  }

  function downloadPhoto(item) {
    const link = document.createElement("a");
    link.href = item.image;
    link.download = `VisionAI-${item.id}.jpg`;
    link.click();
  }

  function deletePhoto(id) {
    setPhotos(old => old.filter(photo => photo.id !== id));
    if (preview?.id === id) setPreview(null);
  }

  function changeZoom(value) {
    setZoom(value);
    const track = streamRef.current?.getVideoTracks()[0];
    const capabilities = track?.getCapabilities?.();
    if (capabilities?.zoom) {
      track.applyConstraints({ advanced: [{ zoom: value }] }).catch(() => {});
    }
  }

  const isFront = facing === "user";

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brandIcon"><Aperture size={23}/></div>
          <div>
            <div className="brandName">VISION<span>AI</span></div>
            <div className="brandSub">CAMERA PRO · INTELLIGENCE</div>
          </div>
        </div>
        <div className="topActions">
          <button className="iconButton" onClick={() => setGalleryOpen(true)}>
            <Image size={20}/><small>{photos.length}</small>
          </button>
          <button className="iconButton" onClick={() => setSettingsOpen(true)}>
            <Settings size={20}/>
          </button>
        </div>
      </header>

      <section className="cameraFrame">
        <video
          ref={videoRef}
          className="video"
          playsInline
          muted
          style={{
            display: cameraOn ? "block" : "none",
            transform: isFront ? "scaleX(-1)" : "none",
            filter
          }}
        />
        {!cameraOn && (
          <div className="cameraPlaceholder">
            <div className="placeholderOrb"><Aperture size={48}/></div>
            <h2>Your camera. Reimagined.</h2>
            <p>AI-powered photography starts here.</p>
            <button className="startButton" onClick={() => startCamera()}>
              <Camera size={19}/> ACTIVATE CAMERA
            </button>
          </div>
        )}

        {cameraOn && (
          <>
            <div className="frameCorners"><i/><i/><i/><i/></div>
            <div className="cameraTopOverlay">
              <span className="liveTag"><b/> LIVE</span>
              <span className="resolution">AUTO · HD</span>
            </div>
            <div className="aiStatus">
              <ScanFace size={15}/>
              <span>{faceStatus}</span>
              {detectorReady && <span className="aiDot"/>}
            </div>
            {faceCount > 0 && (
              <div className="faceNotice">
                <ScanFace size={16}/> {faceCount} FACE{faceCount > 1 ? "S" : ""} DETECTED
              </div>
            )}
            <div className="zoomBadge">{zoom.toFixed(1)}×</div>
            <div className="cameraBottomOverlay">
              <span>VISION AI ENGINE</span>
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
          </>
        )}
      </section>

      <section className="aiPanel">
        <div className="panelHeading">
          <div><Sparkles size={17}/> <strong>INTELLIGENCE ENGINE</strong></div>
          <span className={detectorReady ? "ready" : "loading"}>
            {detectorReady ? "ONLINE" : "INITIALIZING"}
          </span>
        </div>
        <div className="aiControls">
          <button className={aiOn ? "aiChip active" : "aiChip"} onClick={() => setAiOn(!aiOn)}>
            <Brain size={17}/> AI SCAN <span>{aiOn ? "ON" : "OFF"}</span>
          </button>
          <button className={autoCapture ? "aiChip active" : "aiChip"} onClick={() => setAutoCapture(!autoCapture)}>
            <Aperture size={17}/> AUTO CAPTURE <span>{autoCapture ? "ON" : "OFF"}</span>
          </button>
        </div>
        <p className="aiHint">
          {autoCapture
            ? "Auto capture activates after a face remains detected for a short period."
            : "Enable Auto Capture to take a photo when a face is detected."}
        </p>
      </section>

      <section className="modeRow">
        {["PHOTO", "PORTRAIT", "NIGHT", "VIDEO"].map(m => (
          <button key={m} onClick={() => setMode(m)} className={mode === m ? "mode activeMode" : "mode"}>
            {m}
          </button>
        ))}
      </section>

      <section className="zoomControl">
        <span><Maximize size={15}/> ZOOM</span>
        <input type="range" min="1" max="5" step=".1" value={zoom}
          onChange={e => changeZoom(Number(e.target.value))}/>
        <b>{zoom.toFixed(1)}×</b>
      </section>

      <section className="filterSection">
        <div className="sectionTitle"><SlidersHorizontal size={16}/> CREATIVE FILTERS</div>
        <div className="filterList">
          {filters.map(f => (
            <button key={f.value}
              className={filter === f.value ? "filter activeFilter" : "filter"}
              onClick={() => setFilter(f.value)}>
              <span className="filterSample" style={{filter:f.value}}/>
              {f.name}
            </button>
          ))}
        </div>
      </section>

      <section className="capturePanel">
        <button className="sideControl" onClick={() => setFlash(!flash)}>
          {flash ? <Zap size={22}/> : <ZapOff size={22}/>}
          <small>FLASH</small>
        </button>
        <button className="captureButton" onClick={takePhoto} disabled={!cameraOn}>
          <span><Camera size={29}/></span>
        </button>
        <button className="sideControl" onClick={switchCamera} disabled={!cameraOn}>
          <SwitchCamera size={23}/>
          <small>FLIP</small>
        </button>
      </section>

      <div className="bottomBar">
        <span><ShieldCheck size={14}/> PRIVATE BY DESIGN</span>
        <span>VISIONAI PRO v1.0</span>
      </div>

      <canvas ref={canvasRef} hidden/>

      {preview && (
        <div className="modal">
          <div className="modalCard">
            <div className="modalHeader">
              <strong>CAPTURE COMPLETE</strong>
              <button onClick={() => setPreview(null)}><X/></button>
            </div>
            <img className="previewImage" src={preview.image} alt="Captured"/>
            <div className="previewMeta">{preview.date}</div>
            <div className="modalActions">
              <button className="secondaryButton" onClick={() => deletePhoto(preview.id)}><Trash2 size={17}/> DELETE</button>
              <button className="primaryButton" onClick={() => downloadPhoto(preview)}><Download size={17}/> SAVE PHOTO</button>
            </div>
          </div>
        </div>
      )}

      {galleryOpen && (
        <div className="modal">
          <div className="modalCard galleryCard">
            <div className="modalHeader">
              <strong>YOUR GALLERY · {photos.length}</strong>
              <button onClick={() => setGalleryOpen(false)}><X/></button>
            </div>
            {photos.length === 0 ? <p className="emptyText">No photos yet. Capture your first moment.</p> :
              <div className="galleryGrid">
                {photos.map(p => (
                  <button key={p.id} className="galleryImage" onClick={() => {setPreview(p);setGalleryOpen(false);}}>
                    <img src={p.image} alt="Gallery photo"/>
                  </button>
                ))}
              </div>
            }
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="modal">
          <div className="modalCard">
            <div className="modalHeader">
              <strong>CAMERA SETTINGS</strong>
              <button onClick={() => setSettingsOpen(false)}><X/></button>
            </div>
            <div className="settingLine"><span>AI face detection</span><b>{detectorReady ? "Ready" : "Loading"}</b></div>
            <div className="settingLine"><span>Camera status</span><b>{cameraOn ? "Active" : "Off"}</b></div>
            <div className="settingLine"><span>Capture mode</span><b>{mode}</b></div>
            <div className="settingLine"><span>Photo count</span><b>{photos.length}</b></div>
            <p className="aiHint">Camera access requires HTTPS and permission. Some zoom and flash controls depend on your phone hardware.</p>
          </div>
        </div>
      )}

      {error && <div className="errorToast" onClick={() => setError("")}>{error} ✕</div>}
    </main>
  );
}
