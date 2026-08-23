// Simple sortable unique id (timestamp + random) — good enough for a single-user local-first app.
export function newId(): string {
  const ts = Date.now().toString(36).padStart(9, '0');
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}-${rand}`;
}

export function getDeviceId(): string {
  const KEY = 'device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = newId();
    localStorage.setItem(KEY, id);
  }
  return id;
}
