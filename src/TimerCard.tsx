import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AlarmClock, Music } from 'lucide-react';
import Collapsible from './Collapsible';
import Switch from './Switch';
import { getTimerSound, setTimerSound, clearTimerSound } from './db';
import { scheduleAlarm, cancelAlarm, timerAlarmId } from './lib/alarm';

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TimerCard() {
  const [stageCountInput, setStageCountInput] = useState('3');
  const [durationsMin, setDurationsMin] = useState<string[]>(['25', '5', '10']);
  const [lockCancel, setLockCancel] = useState(false);
  const [stageIndex, setStageIndex] = useState(-1); // -1 = idle / setup screen
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [ringing, setRinging] = useState(false);
  const [soundName, setSoundName] = useState<string | null>(null);
  const [soundUrl, setSoundUrl] = useState<string | null>(null);

  // Captured at start so mid-run the setup screen's own state can't affect
  // an already-running timer.
  const activeStageCountRef = useRef(0);
  const activeLockRef = useRef(false);

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

  function onStageCountChange(val: string) {
    setStageCountInput(val);
    const n = Math.min(20, Math.max(1, parseInt(val, 10) || 1));
    setDurationsMin((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push('10');
      return next;
    });
  }

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
      id: timerAlarmId(idx),
      at: new Date(endsAt),
      title: 'تایمر',
      body: `مرحله ${idx + 1} از ${activeStageCountRef.current} تموم شد`,
    });
  }

  function cancelAllAlarms() {
    for (let i = 0; i < activeStageCountRef.current; i++) cancelAlarm(timerAlarmId(i));
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
    activeStageCountRef.current = durationsMin.length;
    activeLockRef.current = lockCancel;
    startStage(0);
  }

  function onDismissRing() {
    stopRinging();
    setRinging(false);
    cancelAlarm(timerAlarmId(stageIndex));
    if (stageIndex < activeStageCountRef.current - 1) {
      startStage(stageIndex + 1);
    } else {
      setStageIndex(-1);
      setEndAt(null);
    }
  }

  function onCancel() {
    if (activeLockRef.current) return;
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
    window.setTimeout(() => audioRef.current?.pause(), 15000);
  }

  return (
    <Collapsible title="تایمر چندمرحله‌ای" storageKey="timer3">
      <audio ref={audioRef} src={soundUrl ?? undefined} style={{ display: 'none' }} />
      {stageIndex === -1 ? (
        <>
          <div className="empty">
            هر مرحله که تموم بشه زنگ می‌خوره؛ وقتی زنگ رو قطع کنی، مرحله‌ی بعد خودش شروع می‌شه.
          </div>
          <div className="add-row">
            <span style={{ minWidth: 80, fontSize: 13, color: 'var(--ink-soft)' }}>تعداد مرحله</span>
            <input
              type="number"
              min="1"
              max="20"
              style={{ maxWidth: 80 }}
              value={stageCountInput}
              onChange={(e) => onStageCountChange(e.target.value)}
            />
          </div>
          {durationsMin.map((d, i) => (
            <div className="add-row" key={i}>
              <span style={{ minWidth: 64, fontSize: 13, color: 'var(--ink-soft)' }}>مرحله {i + 1}</span>
              <input
                type="number"
                min="1"
                style={{ maxWidth: 80 }}
                value={d}
                onChange={(e) => setDuration(i, e.target.value)}
              />
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>دقیقه</span>
            </div>
          ))}

          <div className="add-row" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>با شروع تایمر، امکان لغو تا پایان تمام مراحل نباشه</span>
            <Switch checked={lockCancel} onChange={setLockCancel} />
          </div>

          <div className="add-row">
            <span className="icon-row" style={{ flex: 1, fontSize: 13, color: 'var(--ink-soft)' }}>
              {soundName ? (
                <>
                  <Music size={13} /> زنگ دلخواه: {soundName}
                </>
              ) : (
                'زنگ پیش‌فرض (بوق ساده)'
              )}
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
          <div className="day-nav-label">
            مرحله {stageIndex + 1} از {activeStageCountRef.current}
          </div>
          {ringing ? (
            <>
              <div style={{ margin: '10px 0', display: 'flex', justifyContent: 'center' }}>
                <AlarmClock size={40} />
              </div>
              <div style={{ marginBottom: 12 }}>این مرحله تموم شد!</div>
              <button className="mini-btn" onClick={onDismissRing}>
                {stageIndex < activeStageCountRef.current - 1 ? 'قطع زنگ و شروع مرحله‌ی بعد' : 'قطع زنگ'}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 36, fontFamily: "'JetBrains Mono', monospace", margin: '10px 0' }}>
                {formatClock(remainingMs)}
              </div>
              {!activeLockRef.current && (
                <button className="link-btn" onClick={onCancel}>
                  لغو تایمر
                </button>
              )}
            </>
          )}
        </div>
      )}
    </Collapsible>
  );
}
