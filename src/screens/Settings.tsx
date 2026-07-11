import { useEffect, useState } from 'react'
import { useStore, live } from '../store/store'
import { uid, now } from '../lib/utils'
import { FeedbackNote } from '../lib/types'
import { syncEnabled, signInMagicLink, signOut, getSession } from '../lib/sync'
import { gcalAvailable, connectGcal } from '../lib/gcal'

export default function Settings() {
  const settings = useStore(s => s.settings)
  const setSettings = useStore(s => s.setSettings)
  const setToast = useStore(s => s.setToast)
  const syncNow = useStore(s => s.syncNow)
  const db = useStore(s => s.db)
  const upsert = useStore(s => s.upsert)
  const softDelete = useStore(s => s.softDelete)
  const startTour = useStore(s => s.startTour)
  const [note, setNote] = useState('')
  const notes = live(db.feedbacks).sort((a, b) => b.createdAt - a.createdAt)
  const [email, setEmail] = useState('')
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => { getSession().then(s => setSessionEmail(s?.user.email ?? null)) }, [])

  return (
    <div className="max-w-xl">
      <h1 className="h-display text-4xl mb-5">Settings</h1>

      <section className="card p-4 mb-4">
        <p className="label">Appearance & rituals</p>
        <label className="flex items-center justify-between py-2 text-sm">
          Dark theme
          <input type="checkbox" checked={settings.theme === 'dark'}
            onChange={e => setSettings({ theme: e.target.checked ? 'dark' : 'light' })} />
        </label>
        <label className="flex items-center justify-between py-2 text-sm">
          <span>Daily ritual prompts<br /><span className="text-xs text-ink-mute">Morning & evening power questions</span></span>
          <input type="checkbox" checked={settings.rituals} onChange={e => setSettings({ rituals: e.target.checked })} />
        </label>
        <div className="flex flex-wrap gap-2 mt-1">
          <button className="btn-primary text-sm" onClick={startTour}>▶ Start interactive tutorial</button>
          <button className="btn-ghost text-sm" onClick={() => setSettings({ onboarded: false })}>Replay first-run setup</button>
        </div>
        <p className="text-[11px] text-ink-mute mt-1.5">The interactive tutorial highlights each part of the app and has you use it for real, step by step. Come back to it anytime.</p>
      </section>

      <section className="card p-4 mb-4">
        <p className="label">Feedback & ideas</p>
        <p className="text-sm text-ink-mute mb-2">Spot a bug or think of an improvement? Jot it here the moment it happens — everything is kept in one list you can copy and share later.</p>
        <form className="flex gap-2" onSubmit={e => {
          e.preventDefault()
          if (!note.trim()) return
          upsert<FeedbackNote>('feedback', { id: uid(), updatedAt: now(), text: note.trim(), createdAt: now() })
          setNote('')
          setToast('✓ Feedback saved')
        }}>
          <input className="input" placeholder="e.g. The Week screen should…" value={note} onChange={e => setNote(e.target.value)} />
          <button className="btn-primary shrink-0">Add</button>
        </form>
        {notes.length > 0 && (
          <>
            <div className="mt-3 space-y-1.5 max-h-56 overflow-y-auto">
              {notes.map(n => (
                <div key={n.id} className="flex items-start gap-2 text-sm bg-black/5 dark:bg-white/10 rounded-lg px-2.5 py-1.5">
                  <span className="flex-1">{n.text}</span>
                  <span className="text-[10px] text-ink-mute shrink-0 mt-0.5">{new Date(n.createdAt).toLocaleDateString()}</span>
                  <button className="text-ink-mute text-xs px-1" onClick={() => softDelete('feedback', n.id)}>✕</button>
                </div>
              ))}
            </div>
            <button className="btn-ghost text-xs mt-2" onClick={() => {
              const all = notes.map(n => `- [${new Date(n.createdAt).toLocaleDateString()}] ${n.text}`).join('\n')
              navigator.clipboard.writeText(all).then(() => setToast('✓ All feedback copied — paste it anywhere'))
            }}>⧉ Copy all ({notes.length})</button>
          </>
        )}
      </section>

      <section className="card p-4 mb-4">
        <p className="label">Account & sync</p>
        {!syncEnabled && (
          <p className="text-sm text-ink-mute">
            Running in <b>local-only mode</b> — your data lives on this device (and works fully offline).
            To sync across devices, add your Supabase keys to <code>.env</code> and redeploy. See DEPLOY.md.
          </p>
        )}
        {syncEnabled && !sessionEmail && (
          <form className="flex gap-2" onSubmit={async e => {
            e.preventDefault()
            setSending(true)
            try { await signInMagicLink(email); setToast('Check your email for the sign-in link') }
            catch { setToast('Could not send the link — check the address') }
            setSending(false)
          }}>
            <input type="email" required className="input" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            <button className="btn-primary shrink-0" disabled={sending}>{sending ? 'Sending…' : 'Send sign-in link'}</button>
          </form>
        )}
        {syncEnabled && sessionEmail && (
          <div className="text-sm">
            <p>Signed in as <b>{sessionEmail}</b> — synced across your devices.</p>
            <div className="flex gap-2 mt-2">
              <button className="btn-ghost text-sm" onClick={() => syncNow()}>Sync now</button>
              <button className="btn-ghost text-sm text-signal" onClick={async () => { await signOut(); setSessionEmail(null) }}>Sign out</button>
            </div>
          </div>
        )}
      </section>

      <section className="card p-4 mb-4">
        <p className="label">Google Calendar</p>
        {!gcalAvailable && (
          <p className="text-sm text-ink-mute">Not configured. Add <code>VITE_GOOGLE_CLIENT_ID</code> to enable pushing Block Time to your calendar (with reminders). See DEPLOY.md.</p>
        )}
        {gcalAvailable && (
          <div className="text-sm">
            <p className="mb-2">{settings.gcalConnected
              ? 'Connected — scheduled Block Time is pushed to your primary calendar with a 10-minute reminder.'
              : 'Connect to push committed Block Time into your calendar.'}</p>
            <button className="btn-primary" onClick={async () => {
              const ok = await connectGcal(true)
              setSettings({ gcalConnected: ok })
              setToast(ok ? 'Google Calendar connected' : 'Connection cancelled')
            }}>{settings.gcalConnected ? 'Reconnect' : 'Connect Google Calendar'}</button>
            {settings.gcalConnected && (
              <button className="btn-ghost text-sm ml-2" onClick={() => setSettings({ gcalConnected: false })}>Disconnect</button>
            )}
          </div>
        )}
      </section>

      <section className="card p-4">
        <p className="label">Areas & categories</p>
        <p className="text-sm text-ink-mute">Rename, recolor, add, or archive your Areas of Management and Categories directly on the <b>Life Plan</b> screen.</p>
      </section>
    </div>
  )
}
