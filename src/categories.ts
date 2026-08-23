export interface Category {
  id: string;
  name: string;
  color: string;
  bg: string;
}

export const CATEGORIES: Category[] = [
  { id: 'work', name: 'کار', color: '#3E4A56', bg: '#DEE3E5' },
  { id: 'health', name: 'سلامت/ورزش', color: '#2F6F5E', bg: '#DCE7E0' },
  { id: 'finance', name: 'مالی', color: '#A63D2F', bg: '#F1DCD6' },
  { id: 'learn', name: 'یادگیری', color: '#B8842A', bg: '#F1E5C9' },
  { id: 'trade', name: 'ترید', color: '#6B4C9A', bg: '#E4DCEF' },
  { id: 'personal', name: 'شخصی', color: '#4A6FA5', bg: '#DCE4F0' },
];

export function categoryInfo(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}
