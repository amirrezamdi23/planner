import { Laugh, Smile, Meh, Frown, Angry, type LucideIcon } from 'lucide-react';

export interface MoodOption {
  id: string;
  label: string;
  Icon: LucideIcon;
  color: string;
  bg: string;
}

// Shared between App.tsx (the daily mood gate) and SleepReportCard.tsx (the
// mood column) so both render the same icon/color for the same stored mood
// id — a green-to-red spectrum from great to terrible.
export const MOOD_OPTIONS: MoodOption[] = [
  { id: 'great', label: 'عالی', Icon: Laugh, color: '#1e7d4b', bg: '#dcefe0' },
  { id: 'good', label: 'خوب', Icon: Smile, color: '#2f6f5e', bg: '#dce7e0' },
  { id: 'okay', label: 'معمولی', Icon: Meh, color: '#b8842a', bg: '#f1e5c9' },
  { id: 'bad', label: 'بد', Icon: Frown, color: '#c5623f', bg: '#f1dcd6' },
  { id: 'terrible', label: 'خیلی بد', Icon: Angry, color: '#fff', bg: '#a63d2f' },
];
