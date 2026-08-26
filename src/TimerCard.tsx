import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Collapsible from './Collapsible';
import { getTimerSound, setTimerSound, clearTimerSound } from './db';
import { scheduleAlarm, cancelAlarm, TIMER_ALARM_IDS } from './lib/alarm';

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
  const [soundName, setSoundName] = useState<string | null>(null);
  const [soundUrl, setSoundUrl] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<number | null>(null);
  const origTitleRef = useRef(document.title);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const soundUrlRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await getTimerSound();
      if (stored) {
        const url = URL.createObjectURL(stored.blob);
        soundUrlRef.current = url;
        setSoundUrl(url);
        setSoundName(stored.name);
      }
    })();
    return () => {
      if (soundUrlRef.current) URL.revokeObjectURL(soundUrlRef.current);
    };
  }, []);

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
    if (soundUrl && audioRef.current) {
      audioRef.current.loop = true;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        beep();
        ringIntervalRef.current = window.setInterval(beep, 600);
      });
    } else {
      beep();
      ringIntervalRef.current = window.setInterval(beep, 600);
    }
    document.title = '⏰ زنگ خورد! — ' + origTitleRef.current;
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  }
  function stopRinging() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
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
    const endsAt = Date.now() + minutes * 60000;
    setStageIndex(idx);
    setEndAt(endsAt);
    setRemainingMs(minutes * 60000);
    // Hand this stage to the OS as well, so it still rings if the app gets
    // backgrounded. Inert on the web; see lib/alarm.ts.
    scheduleAlarm({
      id: TIMER_ALARM_IDS[idx],
      at: new Date(endsAt),
      title: 'تایمر',
      body: `مرحله ${idx + 1} از ${STAGE_COUNT} تموم شد`,
    });
  }

  function cancelAllAlarms() {
    for (const id of TIMER_ALARM_IDS) cancelAlarm(id);
  }

  function onStart() {
    ensureAudioCtx(); // unlock the beep fallback while we still have a real user gesture
    if (audioRef.current) {
      // Unlock the <audio> element too, so a later programmatic play() (when
      // the stage actually ends) isn't blocked by autoplay restrictions.
      audioRef.current
        .play()
        .then(() => audioRef.current?.pause())
        .catch(() => {});
    }
    startStage(0);
  }

  function onDismissRing() {
    stopRinging();
    setRinging(false);
    cancelAlarm(TIMER_ALARM_IDS[stageIndex]);
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
    cancelAllAlarms();
    setStageIndex(-1);
    setEndAt(null);
  }

  async function onPickSound(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await setTimerSound(file);
    if (soundUrlRef.current) URL.revokeObjectURL(soundUrlRef.current);
    const url = URL.createObjectURL(file);
    soundUrlRef.current = url;
    setSoundUrl(url);
    setSoundName(file.name);
  }

  async function onRemoveSound() {
    await clearTimerSound();
    if (soundUrlRef.current) URL.revokeObjectURL(soundUrlRef.current);
    soundUrlRef.current = null;
    setSoundUrl(null);
    setSoundName(null);
  }

  function onPreviewSound() {
    if (!audioRef.current) return;
    audioRef.current.loop = false;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
    window.setTimeout(() => audioRef.current?.pause(), 4000);
  }

  return (
    <Collapsible title="تایمر سه‌مرحله‌ای" storageKey="timer3">
      <audio ref={audioRef} src={soundUrl ?? undefined} style={{ display: 'none' }} />
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
            <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-soft)' }}>
              {soundName ? `🎵 زنگ دلخواه: ${soundName}` : 'زنگ پیش‌فرض (بوق ساده)'}
            </span>
          </div>
          <div className="add-row">
            <label className="mini-btn" style={{ cursor: 'pointer' }}>
              انتخاب آهنگ برای زنگ
              <input type="file" accept="audio/*" onChange={onPickSound} style={{ display: 'none' }} />
            </label>
            {soundName && (
              <>
                <button className="link-btn" onClick={onPreviewSound}>
                  پخش نمونه
                </button>
                <button className="link-btn" onClick={onRemoveSound}>
                  حذف و برگشت به بوق
                </button>
              </>
            )}
          </div>

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
