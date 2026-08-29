import { Square, SquareCheckBig, Circle, Minus, Lightbulb, type LucideIcon } from 'lucide-react';
import type { LogItemType } from './repo';

export interface LogTypeInfo {
  id: LogItemType;
  Icon: LucideIcon;
  DoneIcon?: LucideIcon;
  label: string;
}

// Symbol + spelled-out label together, always — so the user never has to
// memorize what each icon means on their own. Tasks use a tickable checkbox
// icon rather than a bullet, so "this can be checked off" reads at a glance.
export const LOG_TYPES: LogTypeInfo[] = [
  { id: 'task', Icon: Square, DoneIcon: SquareCheckBig, label: 'کار' },
  { id: 'event', Icon: Circle, label: 'رویداد' },
  { id: 'note', Icon: Minus, label: 'یادداشت' },
  { id: 'idea', Icon: Lightbulb, label: 'ایده' },
];
