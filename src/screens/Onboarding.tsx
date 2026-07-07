import { useState } from 'react'
import { useStore } from '../store/store'
import { dayKey } from '../lib/utils'

export default function Onboarding() {
  const { addCapture, createBlock, addAction, scheduleBlock, setSettings, seedDefaults, db } = useStore()
  const [step, setStep] = useState(0)
  const [captures, setCaptures] = useState<string[]>([])
  const [captureText, setCaptureText] = useState('')
  const [result, setResult] = useState('')
  const [purpose, setPurpose] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [start, setStart] = useState('09:00')
  const [mins, setMins] = useState(90)

  const finish = async () => {
    seedDefaults()
    if (result.trim() && purpose.trim()) {
      const b = createBlock({ result: result.trim(), purpose: purpose.trim(), scope: 'daily', periodDate: dayKey() })
      selected.forEach(i => addAction(b.id, captures[i]))
      captures.forEach((c, i) => { if (!selected.includes(i)) addCapture(c, 'idea') })
      const s = new Date(`${dayKey()}T${start}`).getTime()
      await scheduleBlock(b.id, s, s + mins * 60000)
    } else {
      captures.forEach(c => addCapture(c, 'idea'))
    }
    setSettings({ onboarded: true })
  }

  const skip = () => { seedDefaults(); setSettings({ onboarded: true }) }
  const hasData = Object.values(db.blocks).some(b => !b.deleted)

  const steps = [
    // 0 — welcome
    <div key="0">
      <p className="h-display text-5xl leading-none mb-3"><span className="text-signal">◎</span> RPM</p>
      <p className="text-lg font-medium mb-2">Results-focused. Purpose-driven. Massive Action Plan.</p>
      <p className="text-sm text-ink-mute leading-relaxed">
        Traditional planning asks <i>"what do I need to do today?"</i> — and buries you in to-dos.
        RPM asks a better question: <b>"what Result am I committed to achieve, and why?"</b>
      </p>
      <p className="text-sm text-ink-mute mt-2">This 3-minute tour teaches the method by having you actually use it{hasData ? ' (your existing data is untouched)' : ''}.</p>
    </div>,
    // 1 — capture
    <div key="1">
      <p className="label">Step 1 · Capture</p>
      <p className="text-sm mb-3">Empty your head. Type 3–5 things on your mind right now — tasks, ideas, calls. Press Enter after each. Don't organize, just capture.</p>
      <form onSubmit={e => {
        e.preventDefault()
        if (captureText.trim()) { setCaptures([...captures, captureText.trim()]); setCaptureText('') }
      }}>
        <input autoFocus className="input" value={captureText} onChange={e => setCaptureText(e.target.value)} placeholder="Type and press Enter…" />
      </form>
      <ul className="mt-2 text-sm space-y-1">{captures.map((c, i) => <li key={i} className="card px-3 py-1.5">{c}</li>)}</ul>
    </div>,
    // 2 — chunk: pick related
    <div key="2">
      <p className="label">Step 2 · Chunk</p>
      <p className="text-sm mb-3">Chunking turns more into less. Tap the items that relate to <b>one same outcome</b> — they'll become your first Block's action plan.</p>
      <div className="space-y-1.5">
        {captures.map((c, i) => (
          <button key={i} onClick={() => setSelected(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i])}
            className={`w-full text-left card px-3 py-2 text-sm border ${selected.includes(i) ? 'border-signal bg-signal-soft dark:bg-signal/20' : 'border-transparent'}`}>
            {c}
          </button>
        ))}
      </div>
    </div>,
    // 3 — the 3 questions
    <div key="3">
      <p className="label">Step 3 · The 3 Questions — in this exact order</p>
      <p className="text-sm mb-1"><b>1. Result</b> — what do these items add up to? What do you really want?</p>
      <input className="input mb-3" value={result} onChange={e => setResult(e.target.value)} placeholder="e.g. Ship the investor deck v2" />
      <p className="text-sm mb-1"><b>2. Purpose</b> — why is it a must? How will achieving it make you feel?</p>
      <textarea className="input min-h-20" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Use words that give you juice — emotion is the fuel" />
      <p className="text-xs text-ink-mute mt-2">3. Your selected captures become the Massive Action Plan — a menu of choices, not have-tos. 20% of actions give 80% of the Result.</p>
    </div>,
    // 4 — schedule
    <div key="4">
      <p className="label">Step 4 · Commit Block Time</p>
      <p className="text-sm mb-3">You don't schedule to-dos — you commit a chunk of time to the <b>Result</b>. When it's scheduled, it's real. And if life bumps it, it moves; it never disappears.</p>
      <div className="grid grid-cols-2 gap-2">
        <div><span className="label">Start today at</span><input type="time" className="input" value={start} onChange={e => setStart(e.target.value)} /></div>
        <div><span className="label">Minutes</span><input type="number" className="input" min={15} step={15} value={mins} onChange={e => setMins(parseInt(e.target.value) || 60)} /></div>
      </div>
    </div>,
    // 5 — celebrate preview
    <div key="5">
      <p className="label">Step 5 · Complete · Measure · Celebrate</p>
      <p className="text-sm leading-relaxed">
        Each evening the app asks three things: what you achieved, your <b>magic moments</b>, and one thing to acknowledge yourself for.
        Weekly, you'll plan in a 45-minute guided session that reconnects every Block to your Life Plan.
      </p>
      <p className="text-sm mt-2 text-ink-mute">Default life categories are set up for you — make them yours on the Life Plan screen, nicknames and all. Ready?</p>
    </div>
  ]

  const canNext =
    step === 1 ? captures.length >= 1 :
    step === 2 ? selected.length >= 1 :
    step === 3 ? result.trim() && purpose.trim() :
    true

  return (
    <div className="min-h-full flex items-center justify-center p-5 bg-ink">
      <div className="card w-full max-w-lg p-6">
        {steps[step]}
        <div className="mt-5 flex items-center justify-between">
          <button className="btn-ghost text-sm" onClick={skip}>Skip tour</button>
          <div className="flex gap-1.5">
            {steps.map((_, i) => <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === step ? 'bg-signal' : 'bg-black/20 dark:bg-white/25'}`} />)}
          </div>
          {step < steps.length - 1
            ? <button className="btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Next</button>
            : <button className="btn-signal" onClick={finish}>Start living RPM</button>}
        </div>
      </div>
    </div>
  )
}
