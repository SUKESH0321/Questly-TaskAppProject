import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import './lib/pwa' // registers the install-prompt listener early
import App from './App.tsx'

// Installable app: register the service worker in production browsers (not inside the Capacitor app).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) return
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
