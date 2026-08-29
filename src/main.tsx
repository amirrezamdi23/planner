import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Without this, the browser is free to silently evict IndexedDB (all of the
// user's journal data) under storage pressure, since it has no signal this
// origin's data matters. Best-effort — unsupported browsers just no-op.
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
