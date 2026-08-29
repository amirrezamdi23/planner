import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { notifyCardOpened, onCardOpened } from './collapsibleGroup';

const LOCK_HOLD_MS = 800;

export default function Collapsible({
  title,
  tag,
  storageKey,
  children,
}: {
  title: string;
  tag?: string;
  storageKey: string;
  children: ReactNode;
}) {
  const key = 'collapsed_' + storageKey;
  const lockKey = 'locked_' + storageKey;
  const [open, setOpen] = useState(() => localStorage.getItem(key) !== '1');
  const [locked, setLocked] = useState(() => localStorage.getItem(lockKey) === '1');

  // Opening this card (by the user, not on initial mount) collapses every
  // other card that isn't itself locked open — a locked card is exempt, per
  // the long-press lock below.
  useEffect(
    () =>
      onCardOpened((openedKey) => {
        if (openedKey !== storageKey && !locked) {
          setOpen(false);
          localStorage.setItem(key, '1');
        }
      }),
    [storageKey, locked, key],
  );

  function openAndBroadcast() {
    setOpen(true);
    localStorage.setItem(key, '0');
    notifyCardOpened(storageKey);
  }

  // Holding the chevron toggles a lock: locked-open cards stay open and stop
  // responding to a quick tap (from this card or the accordion collapsing
  // triggered by another card opening) — only another long-press exits it.
  const pressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  function onChevronPointerDown() {
    longPressFiredRef.current = false;
    pressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      setLocked((prev) => {
        const next = !prev;
        localStorage.setItem(lockKey, next ? '1' : '0');
        return next;
      });
      if (!open) openAndBroadcast();
    }, LOCK_HOLD_MS);
  }
  function onChevronPointerUp() {
    if (pressTimerRef.current !== null) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }
  function onChevronClick() {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (locked) return;
    if (open) {
      setOpen(false);
      localStorage.setItem(key, '1');
    } else {
      openAndBroadcast();
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>
          {title}
          {tag && <span className="tag">{tag}</span>}
        </h2>
        <button
          className={'chevron-btn' + (open ? '' : ' collapsed') + (locked ? ' locked' : '')}
          onPointerDown={onChevronPointerDown}
          onPointerUp={onChevronPointerUp}
          onPointerLeave={onChevronPointerUp}
          onClick={onChevronClick}
          aria-label={open ? 'جمع کردن' : 'باز کردن'}
          title={locked ? 'باز نگه‌داشته شده — برای خروج نگه‌دار' : 'برای باز نگه‌داشتن نگه‌دار'}
        >
          <ChevronDown size={16} />
        </button>
      </div>
      {open && <div className="card-body">{children}</div>}
    </div>
  );
}
