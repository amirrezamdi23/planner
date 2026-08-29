import { useEffect, useRef, useState } from 'react';
import { NotebookPen, History, Timer, Music, Menu, type LucideIcon } from 'lucide-react';

interface NavItem {
  id: string;
  targetId: string;
  label: string;
  icon: LucideIcon;
}

const ITEMS: NavItem[] = [
  { id: 'today', targetId: 'section-today', label: 'امروز', icon: NotebookPen },
  { id: 'history', targetId: 'section-history', label: 'پیشینه', icon: History },
  { id: 'tools', targetId: 'section-tools', label: 'ابزار', icon: Timer },
  { id: 'music', targetId: 'section-music', label: 'موسیقی', icon: Music },
  { id: 'more', targetId: 'section-more', label: 'بیشتر', icon: Menu },
];

// Scroll-spy: whichever section anchor is closest to the top of the
// viewport (without having scrolled past it) is the "active" tab — this is
// what keeps the pill highlight in sync with manual scrolling, not just taps.
function useActiveSection(): string {
  const [active, setActive] = useState(ITEMS[0].id);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const targets = ITEMS.map((item) => ({ id: item.id, el: document.getElementById(item.targetId) })).filter(
      (t): t is { id: string; el: HTMLElement } => t.el !== null
    );

    function onScroll() {
      let current = targets[0]?.id ?? ITEMS[0].id;
      for (const t of targets) {
        if (t.el.getBoundingClientRect().top <= 120) current = t.id;
      }
      if (current !== activeRef.current) setActive(current);
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return active;
}

export default function BottomNav() {
  const active = useActiveSection();

  function onTap(item: NavItem) {
    document.getElementById(item.targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav className="bottom-nav">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            className={'bottom-nav-item' + (isActive ? ' active' : '')}
            onClick={() => onTap(item)}
          >
            <span className="bottom-nav-icon">
              <Icon size={22} />
            </span>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
