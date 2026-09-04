import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initNotifications } from './lib/notifications'

// Without this, the browser is free to silently evict IndexedDB (all of the
// user's journal data) under storage pressure, since it has no signal this
// origin's data matters. Best-effort — unsupported browsers just no-op.
navigator.storage?.persist?.().catch(() => {})

// Registers the بله/خیر and باشه action types and starts listening for
// which one gets tapped — has to happen once at startup, not lazily inside
// NotificationsCard, since a tap can relaunch the app from a killed state
// straight into this listener needing to already be registered.
initNotifications()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
