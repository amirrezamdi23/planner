import { CalendarDays, Inbox, CalendarClock, Menu, type LucideIcon } from 'lucide-react';

export type NavTab = 'today' | 'inbox' | 'upcoming' | 'browse';

interface NavItem {
  id: NavTab;
  label: string;
  icon: LucideIcon;
}

// 4 tabs mirroring a familiar reference layout (Inbox / Today / Upcoming /
// Browse), Persian-labeled. "امروز" is the quick-log page; the other three
// all land on "مرور" for now — the middle two have no page of their own yet.
const ITEMS: NavItem[] = [
  { id: 'today', label: 'امروز', icon: CalendarDays },
  { id: 'inbox', label: 'صندوق ورودی', icon: Inbox },
  { id: 'upcoming', label: 'پیش رو', icon: CalendarClock },
  { id: 'browse', label: 'مرور', icon: Menu },
];

export default function BottomNav({
  active,
  onSelect,
}: {
  active: NavTab;
  onSelect: (tab: NavTab) => void;
}) {
  return (
    <nav className="bottom-nav">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            className={'bottom-nav-item' + (active === item.id ? ' active' : '')}
            onClick={() => onSelect(item.id)}
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
