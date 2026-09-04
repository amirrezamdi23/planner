import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { notifyCardOpened, onCardOpened } from './collapsibleGroup';

const LOCK_HOLD_MS = 800;

// A card shown on its own page has no siblings to collapse against, and its
// title already sits in the page header — so the whole collapse affordance is
// dropped there. Provided as context so every card component gets this for
// free without each one growing a prop.
export const BareCardContext = createContext(false);

export default function Collapsible({
  title,
  tag,
  storageKey,
  nested,
  children,
}: {
  title: string;
  tag?: string;
  storageKey: string;
  // A Collapsible placed inside another Collapsible (e.g. "خواب میان‌روزی" or
  // "کارها و یادداشت‌ها" inside "یادداشت سریع") is a local toggle for a
  // sub-section, not a top-level card competing for accordion space — it
  // must sit out of the global accordion entirely. Without this, opening it
  // both (a) closes unrelated top-level cards, and (b) closes its own
  // parent, since the parent's listener sees a storageKey that isn't its
  // own and collapses itself right along with everything else.
  nested?: boolean;
  children: ReactNode;
}) {
  const bare = useContext(BareCardContext);
  const key = 'collapsed_' + storageKey;
  const lockKey = 'locked_' + storageKey;
  const [open, setOpen] = useState(() => localStorage.getItem(key) !== '1');
  const [locked, setLocked] = useState(() => localStorage.getItem(lockKey) === '1');

  // Opening this card (by the user, not on initial mount) collapses every
  // other card that isn't itself locked open — a locked card is exempt, per
  // the long-press lock below. Nested cards don't participate at all.
  useEffect(() => {
    if (nested) return;
    return onCardOpened((openedKey) => {
      if (openedKey !== storageKey && !locked) {
        setOpen(false);
        localStorage.setItem(key, '1');
      }
    });
  }, [storageKey, locked, key, nested]);

  function openAndBroadcast() {
    setOpen(true);
    localStorage.setItem(key, '0');
    if (!nested) notifyCardOpened(storageKey);
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

  if (bare) {
    return (
      <div className="card">
        {tag && <div className="card-bare-tag">{tag}</div>}
        <div className="card-body">{children}</div>
      </div>
    );
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
