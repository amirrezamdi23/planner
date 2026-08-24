import { useEffect, useRef, useState } from 'react';
import Collapsible from './Collapsible';

const STAGE_COUNT = 3;

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TimerCard() {
  const [durationsMin, setDurationsMin] = useState<string[]>(['25', '5', '10']);
  const [stageIndex, setStageIndex] = useState(-1); // -1 = idle / setup screen
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [ringing, setRinging] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<number | null>(null);
  const origTitleRef = useRef(document.title);

  function ensureAudioCtx(): AudioContext {
    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctor();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }

  function beep() {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  function startRinging() {
    beep();
    ringIntervalRef.current = window.setInterval(beep, 600);
    document.title = '⏰ زنگ خورد! — ' + origTitleRef.current;
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  }
  function stopRinging() {
    if (ringIntervalRef.current !== null) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    document.title = origTitleRef.current;
  }

  useEffect(() => stopRinging, []);

  useEffect(() => {
    if (endAt === null || ringing) return;
    const id = window.setInterval(() => {
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
        setRemainingMs(0);
        setRinging(true);
        startRinging();
      } else {
        setRemainingMs(remaining);
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endAt, ringing]);

  function setDuration(i: number, val: string) {
    setDurationsMin((prev) => prev.map((d, idx) => (idx === i ? val : d)));
  }

  function startStage(idx: number) {
    const minutes = Math.max(1, parseInt(durationsMin[idx], 10) || 1);
    setStageIndex(idx);
    setEndAt(Date.now() + minutes * 60000);
    setRemainingMs(minutes * 60000);
  }

  function onStart() {
    ensureAudioCtx(); // unlock audio while we still have a real user gesture
    startStage(0);
  }

  function onDismissRing() {
    stopRinging();
    setRinging(false);
    if (stageIndex < STAGE_COUNT - 1) {
      startStage(stageIndex + 1);
    } else {
      setStageIndex(-1);
      setEndAt(null);
    }
  }

  function onCancel() {
    stopRinging();
    setRinging(false);
    setStageIndex(-1);
    setEndAt(null);
  }

  return (
    <Collapsible title="تایمر سه‌مرحله‌ای" storageKey="timer3">
      {stageIndex === -1 ? (
        <>
          <div className="empty">
            هر مرحله که تموم بشه زنگ می‌خوره؛ وقتی زنگ رو قطع کنی، مرحله‌ی بعد خودش شروع می‌شه.
          </div>
          {[0, 1, 2].map((i) => (
            <div className="add-row" key={i}>
              <span style={{ minWidth: 64, fontSize: 13, color: 'var(--ink-soft)' }}>مرحله {i + 1}</span>
              <input
                type="number"
                min="1"
                style={{ maxWidth: 80 }}
                value={durationsMin[i]}
                onChange={(e) => setDuration(i, e.target.value)}
              />
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>دقیقه</span>
            </div>
          ))}
          <div className="add-row">
            <button onClick={onStart}>شروع تایمر</button>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div className="day-nav-label">مرحله {stageIndex + 1} از {STAGE_COUNT}</div>
          {ringing ? (
            <>
              <div style={{ fontSize: 40, margin: '10px 0' }}>⏰</div>
              <div style={{ marginBottom: 12 }}>این مرحله تموم شد!</div>
              <button className="mini-btn" onClick={onDismissRing}>
                {stageIndex < STAGE_COUNT - 1 ? 'قطع زنگ و شروع مرحله‌ی بعد' : 'قطع زنگ'}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 36, fontFamily: "'JetBrains Mono', monospace", margin: '10px 0' }}>
                {formatClock(remainingMs)}
              </div>
              <button className="link-btn" onClick={onCancel}>
                لغو تایمر
              </button>
            </>
          )}
        </div>
      )}
    </Collapsible>
  );
}
