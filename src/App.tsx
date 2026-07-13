import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { useStore } from './store/store'
import { CaptureOverlay } from './components/capture'
import Today from './screens/Today'
import Week from './screens/Week'
import Inbox from './screens/Inbox'
import Projects from './screens/Projects'
import LifePlan from './screens/LifePlan'
import Progress from './screens/Progress'
import History from './screens/History'
import Settings from './screens/Settings'
import Onboarding from './screens/Onboarding'
import Tutorial from './components/tutorial'
import Rewards from './components/rewards'

const NAV = [
  { to: '/', label: 'Today', icon: '◎' },
  { to: '/week', label: 'Week', icon: '☰' },
  { to: '/inbox', label: 'Inbox', icon: '⇣' },
  { to: '/projects', label: 'Projects', icon: '▲' },
  { to: '/life', label: 'Life Plan', icon: '◯' },
  { to: '/progress', label: 'Progress', icon: '◔' }
]

export default function App() {
  const { loaded, load, settings, toast, syncNow, markBumpedSlots, db, canUndo, canRedo, undo, redo, startTour } = useStore()
  const [captureOpen, setCaptureOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark')
  }, [settings.theme])

  useEffect(() => {
    const onFocus = () => { markBumpedSlots(); syncNow().catch(() => {}) }
    window.addEventListener('focus', onFocus)
    const iv = setInterval(onFocus, 5 * 60 * 1000)
    return () => { window.removeEventListener('focus', onFocus); clearInterval(iv) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard: "c" opens capture; Ctrl+Z / Ctrl+Y undo-redo
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (e.key === 'c' && !typing && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); setCaptureOpen(true)
      }
      if ((e.ctrlKey || e.metaKey) && !typing) {
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); useStore.getState().undo() }
        if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); useStore.getState().redo() }
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  if (!loaded) return <div className="h-full flex items-center justify-center text-ink-mute">Loading…</div>
  if (!settings.onboarded) return <Onboarding />

  const unsorted = Object.values(db.captures).filter(c => !c.deleted && c.status === 'unsorted').length

  return (
    <div className="min-h-full flex flex-col sm:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="hidden sm:flex flex-col w-52 shrink-0 bg-ink text-white p-4 gap-1 min-h-screen sticky top-0">
        <div className="h-display text-3xl mb-4 flex items-center gap-2">
          <span className="text-signal">◎</span> RPM
        </div>
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
            className={({ isActive }) => `rounded-lg px-3 py-2 text-sm flex items-center gap-2.5 ${isActive ? 'bg-white/15 font-semibold' : 'text-white/70 hover:bg-white/10'}`}>
            <span className="w-4 text-center">{n.icon}</span>{n.label}
            {n.to === '/inbox' && unsorted > 0 && <span className="ml-auto text-[10px] bg-signal rounded-full px-1.5 py-0.5">{unsorted}</span>}
          </NavLink>
        ))}
        <NavLink to="/history" className={({ isActive }) => `rounded-lg px-3 py-2 text-sm flex items-center gap-2.5 ${isActive ? 'bg-white/15 font-semibold' : 'text-white/70 hover:bg-white/10'}`}>
          <span className="w-4 text-center">⌛</span>History
        </NavLink>
        <div className="mt-auto">
          <div className="flex gap-1 mb-1">
            <button aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}
              className="flex-1 rounded-lg py-1.5 text-white/80 hover:bg-white/10 disabled:opacity-30">↶</button>
            <button aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={redo}
              className="flex-1 rounded-lg py-1.5 text-white/80 hover:bg-white/10 disabled:opacity-30">↷</button>
          </div>
          <NavLink to="/settings" className={({ isActive }) => `rounded-lg px-3 py-2 text-sm flex items-center gap-2.5 ${isActive ? 'bg-white/15 font-semibold' : 'text-white/70 hover:bg-white/10'}`}>
            <span className="w-4 text-center">⚙</span>Settings
          </NavLink>
          <button data-tour="capture" className="w-full mt-2 btn-signal" onClick={() => setCaptureOpen(true)}>＋ Capture <kbd className="text-[10px] opacity-70">C</kbd></button>
        </div>
      </aside>

      {/* Top bar (mobile only) */}
      <div className="sm:hidden flex items-center justify-between px-4 pt-3">
        <div className="h-display text-2xl flex items-center gap-1.5">
          <span className="text-signal">◎</span> RPM
        </div>
        <div className="flex items-center gap-0.5">
          <button aria-label="Undo" disabled={!canUndo} onClick={undo}
            className="w-9 h-9 rounded-full flex items-center justify-center text-ink-mute disabled:opacity-30 text-lg">↶</button>
          <button aria-label="Redo" disabled={!canRedo} onClick={redo}
            className="w-9 h-9 rounded-full flex items-center justify-center text-ink-mute disabled:opacity-30 text-lg">↷</button>
          <button aria-label="More" onClick={() => setMoreOpen(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-ink-mute hover:bg-black/5 dark:hover:bg-white/10 text-xl">⋯</button>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 p-4 sm:p-8 pb-28 sm:pb-8 max-w-5xl w-full mx-auto">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/week" element={<Week />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/projects/*" element={<Projects />} />
          <Route path="/life" element={<LifePlan />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-ink text-white flex justify-around items-center pt-1.5 pb-[max(env(safe-area-inset-bottom),8px)] z-40">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
            className={({ isActive }) => `flex flex-col items-center text-[10px] px-1.5 py-1 relative ${isActive ? 'text-signal font-semibold' : 'text-white/70'}`}>
            <span className="text-base leading-none">{n.icon}</span>{n.label}
            {n.to === '/inbox' && unsorted > 0 && <span className="absolute -top-0.5 right-0 w-2 h-2 bg-signal rounded-full" />}
          </NavLink>
        ))}
      </nav>

      {/* Capture FAB (mobile) */}
      <button aria-label="Capture" data-tour="capture" onClick={() => setCaptureOpen(true)}
        className="sm:hidden fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-signal text-white text-2xl shadow-card">＋</button>

      <CaptureOverlay open={captureOpen} onClose={() => setCaptureOpen(false)} />

      <Tutorial />
      <Rewards />

      {/* More sheet (mobile): History & Settings */}
      {moreOpen && (
        <div className="sm:hidden fixed inset-0 z-50 bg-ink/50 flex items-end" onClick={() => setMoreOpen(false)}>
          <div className="card w-full rounded-b-none p-3 pb-[max(env(safe-area-inset-bottom),12px)]" onClick={e => e.stopPropagation()}>
            <NavLink to="/history" onClick={() => setMoreOpen(false)}
              className="rounded-lg px-3 py-3 text-sm flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10">
              <span className="w-4 text-center">⌛</span>History
            </NavLink>
            <NavLink to="/settings" onClick={() => setMoreOpen(false)}
              className="rounded-lg px-3 py-3 text-sm flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10">
              <span className="w-4 text-center">⚙</span>Settings
            </NavLink>
            <button onClick={() => { setMoreOpen(false); startTour() }}
              className="w-full rounded-lg px-3 py-3 text-sm flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10">
              <span className="w-4 text-center">▶</span>Interactive tutorial
            </button>
            <button className="btn-ghost w-full mt-1" onClick={() => setMoreOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-white text-sm px-4 py-2 rounded-full shadow-card">
          {toast}
        </div>
      )}
    </div>
  )
}
