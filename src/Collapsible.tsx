import { useState, type ReactNode } from 'react';

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
  const [open, setOpen] = useState(() => localStorage.getItem(key) !== '1');

  function toggle() {
    const next = !open;
    setOpen(next);
    localStorage.setItem(key, next ? '0' : '1');
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>
          {title}
          {tag && <span className="tag">{tag}</span>}
        </h2>
        <button
          className={'chevron-btn' + (open ? '' : ' collapsed')}
          onClick={toggle}
          aria-label={open ? 'جمع کردن' : 'باز کردن'}
          title={open ? 'جمع کردن' : 'باز کردن'}
        >
          ▾
        </button>
      </div>
      {open && <div className="card-body">{children}</div>}
    </div>
  );
}
