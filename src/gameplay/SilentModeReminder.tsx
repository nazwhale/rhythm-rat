import { useState } from 'react'
const DISMISSED_KEY = 'rhythm-rat:silent-mode-reminder:v1'

export default function SilentModeReminder() {
  const [dismissed, setDismissed] = useState(() => {
    try { return window.localStorage.getItem(DISMISSED_KEY) === 'dismissed' } catch { return false }
  })
  if (dismissed) return null
  return <aside className="silent-mode-reminder" aria-label="Sound reminder">
    <svg className="reminder-desktop" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 13v6h5l7 5V8l-7 5H4zM21 12a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></svg>
    <svg className="reminder-mobile-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 20v-7a7 7 0 0 1 14 0v7l3 4H6zM13 27h6M4 3l25 26" /><path d="M4 11V7m24 4V7" /></svg>
    <p>
      <strong className="reminder-desktop">Sound on</strong>
      <span className="reminder-desktop">Turn up your computer volume so you can hear the beat.</span>
      <strong className="reminder-mobile">Turn off silent mode on your phone</strong>
      <span className="reminder-mobile">Turn up the volume so you can hear the beat.</span>
    </p>
    <button type="button" onClick={(event) => {
      event.currentTarget.blur(); setDismissed(true)
      // Browsers cannot reliably detect the hardware silent switch. Remember the
      // acknowledgement instead, and keep play working when storage is blocked.
      try { window.localStorage.setItem(DISMISSED_KEY, 'dismissed') } catch { /* Dismiss for this visit. */ }
    }}>OK</button>
  </aside>
}
