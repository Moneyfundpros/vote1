'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function VerifyPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [, setCameraReady] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [status, setStatus] = useState('Camera is ready for a quick demo selfie.');

  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (!cancelled && videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
          setStatus('Camera ready. Tap snap to continue.');
        }
      } catch {
        setStatus('Camera access is unavailable in this demo, so we will continue with a simulated verification.');
        setCameraReady(false);
      }
    }
    void startCamera();
    return () => {
      cancelled = true;
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  function handleSnap() {
    setCaptured('demo-selfie');
    setStatus('Verification completed. You can now choose your candidate.');
    setTimeout(() => router.push('/dashboard'), 700);
  }

  return (
    <main className="auth-wrap">
      <div className="card auth-card">
        <span className="badge">Step 2 of 2</span>
        <h2 style={{ fontSize: '1.7rem', margin: '14px 0 6px' }}>Confirm your identity</h2>
        <p className="muted" style={{ marginBottom: 20, fontSize: 15 }}>
          To keep results trustworthy — one verified person, one vote — we confirm you’re a real Nigerian using your face for this demo.
        </p>

        <div style={{ borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', marginBottom: 14 }}>
          <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', display: captured ? 'none' : 'block', background: '#000' }} />
          {captured ? <div style={{ padding: 16, color: 'var(--brand)' }}>Selfie captured successfully.</div> : null}
        </div>

        <p className="muted" style={{ marginBottom: 14, fontSize: 14 }}>{status}</p>

        <button className="btn btn-primary btn-block btn-lg" type="button" onClick={handleSnap}>
          Snap and verify
        </button>
        <p className="faint center" style={{ marginTop: 14, fontSize: 13 }}>
          Powered by Dojah / Smile ID. By continuing you consent to identity verification (NDPA).
        </p>
        <p className="muted center" style={{ marginTop: 18, fontSize: 14 }}>
          <Link href="/dashboard">Skip for now →</Link>
        </p>
      </div>
    </main>
  );
}
