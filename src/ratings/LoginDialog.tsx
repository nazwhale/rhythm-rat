import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import type { OnlineUser } from './onlineTypes'

const CODE_LENGTH = 4
const emptyCode = () => Array<string>(CODE_LENGTH).fill('')

export default function LoginDialog({ onLogin, onCancel }: {
  onLogin: (user: OnlineUser) => Promise<void>
  onCancel: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const codeInputs = useRef<(HTMLInputElement | null)[]>([])
  const pending = useRef(false)
  const [email, setEmail] = useState('')
  const [digits, setDigits] = useState(emptyCode)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const code = digits.join('')

  useEffect(() => {
    const modal = dialog.current
    if (!modal) return
    const viewport = window.visualViewport
    function fitViewport() {
      if (!modal || !viewport) return
      modal.style.setProperty('--login-viewport-top', `${viewport.offsetTop}px`)
      modal.style.setProperty('--login-viewport-height', `${viewport.height}px`)
    }
    fitViewport()
    viewport?.addEventListener('resize', fitViewport)
    viewport?.addEventListener('scroll', fitViewport)
    modal.showModal()

    return () => {
      viewport?.removeEventListener('resize', fitViewport)
      viewport?.removeEventListener('scroll', fitViewport)
      modal.close()
    }
  }, [])

  function focusDigit(index: number) {
    codeInputs.current[index]?.focus({ preventScroll: true })
  }

  async function send() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await api('auth/code', { email })
      setSent(true)
      setDigits(emptyCode())
      if (sent) focusDigit(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a code.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  async function verify(completeCode: string) {
    if (pending.current || completeCode.length !== CODE_LENGTH) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const response = await api<{ user: OnlineUser }>('auth/verify', { email, code: completeCode })
      await onLogin(response.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
      setDigits(emptyCode())
      focusDigit(0)
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  function enterDigits(index: number, value: string) {
    if (pending.current) return
    const numeric = value.replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (value && !numeric) return
    const start = numeric.length === CODE_LENGTH ? 0 : index
    const incoming = numeric.slice(0, CODE_LENGTH - start)
    const next = [...digits]
    next.splice(start, incoming.length || 1, ...(incoming ? [...incoming] : ['']))
    setDigits(next)
    setError('')

    if (next.every(Boolean)) {
      void verify(next.join(''))
    } else if (incoming) {
      focusDigit(Math.min(start + incoming.length, CODE_LENGTH - 1))
    }
  }

  return <dialog ref={dialog} className="login-dialog" aria-labelledby="login-title" onCancel={event => {
    event.preventDefault()
    if (!busy) onCancel()
  }}>
    <h2 id="login-title">Save your rating</h2>
    <p>{sent
      ? <>Enter the code we sent to <strong>{email}</strong>.</>
      : 'Sign in or create an account with your email. We’ll remember you on this device.'}</p>
    <form onSubmit={event => {
      event.preventDefault()
      if (sent) void verify(code)
      else void send()
    }}>
      {sent ? <fieldset className="login-code">
        <legend>Four-digit code</legend>
        <div className="login-code-digits">
          {digits.map((digit, index) => <input
            key={index}
            ref={input => { codeInputs.current[index] = input }}
            aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
            autoFocus={index === 0}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            inputMode="numeric"
            maxLength={index === 0 ? undefined : 1}
            spellCheck={false}
            readOnly={busy}
            value={digit}
            onFocus={event => event.currentTarget.select()}
            onClick={event => event.currentTarget.select()}
            onChange={event => {
              const input = event.currentTarget
              const value = input.value
              // A second keystroke in the first slot replaces its digit. Autofill can supply the whole code.
              const caret = input.selectionStart ?? value.length
              enterDigits(index, value.length === 2 && digit ? value.slice(caret - 1, caret) : value)
            }}
            onPaste={event => {
              event.preventDefault()
              enterDigits(index, event.clipboardData.getData('text'))
            }}
            onKeyDown={event => {
              if (pending.current) return
              if (event.key === 'Backspace' && !digit && index > 0) {
                event.preventDefault()
                enterDigits(index - 1, '')
                focusDigit(index - 1)
              }
            }}
          />)}
        </div>
      </fieldset> : <label>Email <input autoFocus type="email" autoComplete="email" value={email} required readOnly={busy} onChange={event => setEmail(event.target.value)} /></label>}
      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="account-button login-submit" disabled={busy || (sent && code.length !== CODE_LENGTH)} type="submit">
        {busy ? 'Please wait…' : sent ? 'Sign in' : 'Email me a code'}
      </button>
      <div className="login-actions">
        {sent && <>
          <button className="account-button" disabled={busy} type="button" onClick={() => void send()}>Resend code</button>
          <button className="account-button" disabled={busy} type="button" onClick={() => { setSent(false); setDigits(emptyCode()); setError('') }}>Change email</button>
        </>}
        <button className="account-button" disabled={busy} type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  </dialog>
}
