import { useEffect, useRef, useState } from 'react'
import { useStore, live } from '../store/store'
import { Modal } from './ui'
import { Block, BlockScope } from '../lib/types'
import { dayKey, weekKey } from '../lib/utils'

/* ---------- Global capture overlay ---------- */
export function CaptureOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addCapture = useStore(s => s.addCapture)
  const [lane, setLane] = useState<'idea' | 'comm'>('idea')
  const [text, setText] = useState('')
  const [count, setCount] = useState(0)
  const [recent, setRecent] = useState<string[]>([])
  const [flash, setFlash] = useState(false)
  const [listening, setListening] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const recRef = useRef<any>(null)

  useEffect(() => { if (open) { setCount(0); setRecent([]); setTimeout(() => inputRef.current?.focus(), 50) } }, [open])

  const submit = () => {
    if (!text.trim()) return
    addCapture(text, lane)
    setRecent(r => [text.trim(), ...r].slice(0, 4))
    setText('')
    setCount(c => c + 1)
    setFlash(true)
    setTimeout(() => setFlash(false), 500)
    inputRef.current?.focus() // cursor instantly ready for the next item
  }

  const speechSupported = typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  const toggleVoice = () => {
    if (listening) { recRef.current?.stop(); return }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const rec = new SR()
    rec.lang = navigator.language || 'en-US'
    rec.interimResults = false
    rec.onresult = (e: any) => {
      const t = e.results[e.results.length - 1][0].transcript.trim()
      // put the words IN the input so you can see and edit them, then press Enter to save
      if (t) setText(prev => (prev ? prev + ' ' : '') + t)
    }
    rec.onend = () => { setListening(false); inputRef.current?.focus() }
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="h-display text-2xl">Capture</h2>
        <button className="btn-primary text-xs" onClick={onClose}>Done{count > 0 ? ` (${count})` : ''}</button>
      </div>
      <div className="flex gap-1 mb-3">
        <button className={`btn flex-1 text-sm ${lane === 'idea' ? 'bg-ink text-white' : 'bg-black/5 dark:bg-white/10'}`} onClick={() => setLane('idea')}>Ideas · Wants · Needs</button>
        <button className={`btn flex-1 text-sm ${lane === 'comm' ? 'bg-ink text-white' : 'bg-black/5 dark:bg-white/10'}`} onClick={() => setLane('comm')}>Communications</button>
      </div>
      <form onSubmit={e => { e.preventDefault(); submit() }} className="flex gap-2">
        <input ref={inputRef} type="text" name="rpm-capture" autoComplete="off" autoCorrect="on" autoCapitalize="sentences" spellCheck enterKeyHint="send" data-lpignore="true" data-1p-ignore
          className={`input transition-shadow ${flash ? 'ring-2 ring-zone' : ''}`} placeholder="Get it out of your head…" value={text} onChange={e => setText(e.target.value)} />
        {speechSupported && (
          <button type="button" onClick={toggleVoice}
            className={`btn shrink-0 ${listening ? 'bg-signal text-white animate-pulse' : 'bg-black/5 dark:bg-white/10'}`}
            aria-label="Voice capture">🎙</button>
        )}
      </form>
      {recent.length > 0 && (
        <div className="mt-3 space-y-1">
          {recent.map((r, i) => (
            <div key={`${r}-${count}-${i}`} className={`flex items-center gap-2 text-sm rounded-lg px-2.5 py-1.5 bg-black/5 dark:bg-white/10 ${i === 0 ? 'animate-pop' : ''}`}>
              <span className="text-zone font-bold">✓</span>
              <span className="flex-1 truncate">{r}</span>
              <span className="text-[10px] text-ink-mute">saved to Inbox</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-ink-mute">
        {count > 0 ? `✓ ${count} captured — keep going, or tap Done above.` : 'This is not your plan. Just empty your head.'}
      </p>
    </Modal>
  )
}

/* ---------- New Block flow: the 3 Questions, in the mandated order ---------- */
export function NewBlockModal({ open, onClose, defaults, onCreated, prefillActions }: {
  open: boolean
  onClose: () => void
  defaults?: Partial<Block>
  onCreated?: (b: Block) => void
  /** capture texts that will become the MAP — shown pre-filled so nothing is typed twice */
  prefillActions?: string[]
}) {
  const db = useStore(s => s.db)
  const createBlock = useStore(s => s.createBlock)
  const addAction = useStore(s => s.addAction)
  const [step, setStep] = useState(0)
  const [result, setResult] = useState('')
  const [purpose, setPurpose] = useState('')
  const [map, setMap] = useState('')
  const [categoryId, setCategoryId] = useState(defaults?.categoryId ?? '')
  const [scope, setScope] = useState<BlockScope>(defaults?.scope ?? 'daily')
  const [isMust, setIsMust] = useState(false)
  const cats = live(db.categories).filter(c => !c.archived)

  useEffect(() => {
    if (open) {
      setStep(0); setResult(''); setPurpose('')
      setMap(prefillActions?.length ? prefillActions.join('\n') : '')
      setCategoryId(defaults?.categoryId ?? ''); setScope(defaults?.scope ?? 'daily'); setIsMust(false)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const QUESTIONS = [
    { title: '1 · Result', q: 'What do I really want? What Result am I committed to achieving?' },
    { title: '2 · Purpose', q: 'Why do I want it? Why is it a must? How will it make me feel?' },
    { title: '3 · Massive Action Plan', q: 'What specific actions could get me this Result? One per line. This is a MENU of options, not another to-do list — you\u2019ll rarely need all of them (20% of actions usually deliver 80% of the Result).' }
  ]

  const finish = () => {
    const b = createBlock({
      result: result.trim(), purpose: purpose.trim(),
      categoryId: categoryId || undefined,
      projectId: defaults?.projectId,
      scope, isMust,
      periodDate: defaults?.periodDate ?? (scope === 'weekly' ? weekKey() : scope === 'project' ? '' : dayKey())
    })
    map.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => addAction(b.id, l))
    onCreated?.(b)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="New RPM Block">
      <p className="label">{QUESTIONS[step].title}</p>
      <p className="text-sm mb-2">{QUESTIONS[step].q}</p>
      {step === 0 && <input autoFocus className="input" value={result} onChange={e => setResult(e.target.value)} placeholder="Clarity is power — be specific" />}
      {step === 1 && <textarea autoFocus className="input min-h-24" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Use words that move you — emotion is the fuel" />}
      {step === 2 && (
        <>
          {prefillActions && prefillActions.length > 0 && (
            <p className="text-[11px] text-zone bg-zone-soft dark:bg-zone/20 rounded-lg px-2.5 py-1.5 mb-2">
              ✓ Your {prefillActions.length} selected capture{prefillActions.length > 1 ? 's are' : ' is'} already here — they MOVE from the Inbox into this plan (no duplicates). Add more lines only if something's missing.
            </p>
          )}
          <textarea autoFocus className="input min-h-28 font-mono text-sm" value={map} onChange={e => setMap(e.target.value)} placeholder={'One action per line'} />
        </>
      )}

      {step === 2 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <span className="label">Category</span>
            <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">—</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.juicyName || c.name}</option>)}
            </select>
          </div>
          {!defaults?.projectId && (
            <div>
              <span className="label">Scope</span>
              <select className="input" value={scope} onChange={e => setScope(e.target.value as BlockScope)}>
                <option value="daily">Today</option>
                <option value="weekly">This week</option>
              </select>
            </div>
          )}
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isMust} onChange={e => setIsMust(e.target.checked)} />
            <span><b className="text-signal">*</b> This Result is a Must — non-negotiable</span>
          </label>
        </div>
      )}

      <div className="mt-4 flex justify-between">
        <button className="btn-ghost" onClick={() => step === 0 ? onClose() : setStep(step - 1)}>{step === 0 ? 'Cancel' : 'Back'}</button>
        {step < 2
          ? <button className="btn-primary" disabled={step === 0 ? !result.trim() : !purpose.trim()}
              onClick={() => setStep(step + 1)}>Next</button>
          : <button className="btn-signal" disabled={!result.trim() || !purpose.trim()} onClick={finish}>Create Block</button>}
      </div>
      {step === 1 && !purpose.trim() && (
        <p className="text-[11px] text-ink-mute mt-2">Don't skip your Purpose — without the why, the plan loses its drive.</p>
      )}
    </Modal>
  )
}
