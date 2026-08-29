// Accordion behavior across independent <Collapsible> cards: each card owns
// its own open/closed state (persisted per-storageKey in localStorage), so
// there's no shared parent state to lift this into without a bigger
// refactor — a window CustomEvent broadcast (same pattern as repo.ts's
// onCategoriesChanged) lets a card that just opened tell every other card
// to close, without either knowing about the other.
const CARD_OPENED_EVENT = 'planner:card-opened';

export function notifyCardOpened(storageKey: string): void {
  window.dispatchEvent(new CustomEvent<string>(CARD_OPENED_EVENT, { detail: storageKey }));
}

export function onCardOpened(handler: (storageKey: string) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<string>).detail);
  window.addEventListener(CARD_OPENED_EVENT, listener);
  return () => window.removeEventListener(CARD_OPENED_EVENT, listener);
}
