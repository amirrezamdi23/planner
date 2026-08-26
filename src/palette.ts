export interface ColorSwatch {
  color: string;
  bg: string;
}

// Curated color+background pairs (readable text on a soft tint), picked to
// match the app's paper/ink aesthetic — used for category color pickers and
// anything a category's color needs to tint (its tag, its projects' tag).
export const CATEGORY_PALETTE: ColorSwatch[] = [
  { color: '#2F6F5E', bg: '#DCE7E0' }, // teal
  { color: '#A63D2F', bg: '#F1DCD6' }, // rust
  { color: '#B8842A', bg: '#F1E5C9' }, // gold
  { color: '#6B4C9A', bg: '#E4DCEF' }, // purple
  { color: '#4A6FA5', bg: '#DCE4F0' }, // blue
  { color: '#3E4A56', bg: '#DEE3E5' }, // slate
  { color: '#7A8B4F', bg: '#E5EAD9' }, // olive
  { color: '#B15A82', bg: '#F0DCE6' }, // mauve
];

export const DEFAULT_SWATCH: ColorSwatch = CATEGORY_PALETTE[0];
