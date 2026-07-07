import { ReactNode, useState } from 'react'
import { useStore, blockActions, blockTotals } from '../store/store'
import { Block, Action, ActionStatus } from '../lib/types'
import { fmtDur } from '../lib/utils'

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/50 p-0 sm:p-6" onClick={onClose}>
      <div
        className={`card w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-b-xl p-5`}
        onClick={e => e.stopPropagation()}
      >
        {title && <h2 className="h-display text-2xl mb-3">{title}</h2>}
        {children}
      </div>
    </div>
  )
}

/* ---------- Result ring (circle your Result) ---------- */
export function ResultRing({ pct, size = 44, color = '#E8563F', children }: {
  pct: number; size?: number; color?: string; children?: ReactNode
}) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct))} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .4s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold">{children}</div>
    </div>
  )
}

/* ---------- Action marking key ---------- */
const MARKS: { s: ActionStatus; glyph: string; label: string }[] = [
  { s: 'done', glyph: '✘', label: 'Done' },
  { s: 'inProgress', glyph: '✔', label: 'In progress' },
  { s: 'leveraged', glyph: '¡', label: 'Leveraged' },
  { s: 'carriedOver', glyph: '➜', label: 'Carry over' },
  { s: 'notNeeded', glyph: '■', label: "Didn't need it (80/20!)" }
]

export function markGlyph(s: ActionStatus) {
  return MARKS.find(m => m.s === s)?.glyph ?? ''
}

function ActionRow({ a }: { a: Action }) {
  const setStatus = useStore(s => s.setActionStatus)
  const softDelete = useStore(s => s.softDelete)
  const upsert = useStore(s => s.upsert)
  const [menu, setMenu] = useState(false)
  const done = a.status === 'done' || a.status === 'notNeeded' || a.status === 'leveraged'
  return (
    <div className="relative flex items-center gap-2 py-1 group">
      <button
        aria-label="Mark action"
        onClick={() => setMenu(m => !m)}
        className={`w-6 h-6 shrink-0 rounded border text-xs font-bold flex items-center justify-center
          ${done ? 'bg-ink text-white border-ink dark:bg-signal dark:border-signal' : 'border-black/20 dark:border-white/25 text-ink-mute'}`}
      >
        {markGlyph(a.status)}
      </button>
      {menu && (
        <div className="absolute z-20 top-7 left-0 card p-1.5 flex flex-col text-left" onMouseLeave={() => setMenu(false)}>
          {MARKS.map(m => (
            <button key={m.s} className="btn-ghost justify-start text-xs px-2 py-1"
              onClick={() => { setStatus(a.id, a.status === m.s ? 'pending' : m.s); setMenu(false) }}>
              <span className="w-4 font-bold">{m.glyph}</span>{m.label}
            </button>
          ))}
          <button className="btn-ghost justify-start text-xs px-2 py-1 text-signal"
            onClick={() => { softDelete('action', a.id); setMenu(false) }}>✕ Remove</button>
        </div>
      )}
      <span className="text-[11px] w-4 text-ink-mute text-right shrink-0">{a.priority}</span>
      {a.isMust && <span className="text-signal font-bold shrink-0" title="Must">*</span>}
      <span className={`text-sm flex-1 ${a.status === 'done' ? 'line-through text-ink-mute' : a.status === 'notNeeded' ? 'text-ink-mute' : ''}`}>
        {a.text}
        {a.leverageTo && <span className="ml-1.5 text-[11px] text-zone font-semibold uppercase">→ {a.leverageTo}</span>}
      </span>
      <span className="text-[11px] text-ink-mute shrink-0">{a.durationMin ? fmtDur(a.durationMin) : ''}</span>
      <button className="opacity-0 group-hover:opacity-100 text-[11px] text-ink-mute px-1"
        title="Toggle must / duration / leverage"
        onClick={() => {
          const dur = prompt('Duration in minutes (blank = none):', a.durationMin?.toString() ?? '')
          const lev = prompt('Leverage to (initials, blank = none):', a.leverageTo ?? '')
          const must = confirm('Is this a MUST? (OK = yes, Cancel = no)')
          upsert('action', { ...a, durationMin: dur ? parseInt(dur) || undefined : undefined, leverageTo: lev || undefined, isMust: must })
        }}>⋯</button>
    </div>
  )
}

/* ---------- Block card: MAP left · Result circled · Purpose right ---------- */
export function BlockCard({ block, categoryColor, compact, footer }: {
  block: Block; categoryColor?: string; compact?: boolean; footer?: ReactNode
}) {
  const db = useStore(s => s.db)
  const addAction = useStore(s => s.addAction)
  const completeBlock = useStore(s => s.completeBlock)
  const [newAction, setNewAction] = useState('')
  const acts = blockActions(db, block.id)
  const t = blockTotals(db, block.id)
  const pct = t.count ? t.done / t.count : 0
  const color = categoryColor ?? '#E8563F'

  return (
    <div className="card p-4 border-l-4" style={{ borderLeftColor: color }}>
      <div className="flex items-start gap-3">
        <ResultRing pct={block.status === 'completed' ? 1 : pct} color={color}>
          {block.status === 'completed' ? '✓' : `${t.done}/${t.count}`}
        </ResultRing>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {block.isMust && <span className="text-signal font-bold" title="Must Result">*</span>}
            <h3 className="h-display text-xl leading-tight">{block.result}</h3>
          </div>
          {block.purpose && <p className="purpose-text mt-0.5">“{block.purpose}”</p>}
        </div>
      </div>

      {!compact && (
        <>
          <div className="mt-3 border-t border-black/5 dark:border-white/10 pt-2">
            {acts.map(a => <ActionRow key={a.id} a={a} />)}
            <form className="flex gap-2 mt-1" onSubmit={e => { e.preventDefault(); if (newAction.trim()) { addAction(block.id, newAction); setNewAction('') } }}>
              <input className="input py-1.5 text-sm" placeholder="Add action…" value={newAction} onChange={e => setNewAction(e.target.value)} />
            </form>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-ink-mute">
            <span>Total {fmtDur(t.total)} · <b className="text-signal">Must {fmtDur(t.must)}</b></span>
            {block.status !== 'completed' && t.count > 0 && (
              <button className="btn-ghost text-[11px] py-0.5" onClick={() => completeBlock(block.id)}>Complete Block</button>
            )}
          </div>
        </>
      )}
      {footer}
    </div>
  )
}

/* ---------- Contextual help ---------- */
export function HelpButton({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button aria-label="Help" onClick={() => setOpen(true)}
        className="w-7 h-7 rounded-full border border-black/15 dark:border-white/20 text-ink-mute text-sm font-semibold hover:bg-black/5">?</button>
      <Modal open={open} onClose={() => setOpen(false)} title="From the method">
        <p className="text-sm leading-relaxed whitespace-pre-line">{text}</p>
        <button className="btn-primary mt-4 w-full" onClick={() => setOpen(false)}>Got it</button>
      </Modal>
    </>
  )
}

/* ---------- The Zone bullseye (signature visual) ---------- */
export function Bullseye({ zonePct, size = 220 }: { zonePct: number; size?: number }) {
  const rings = [
    { r: 1.0, label: 'Distraction', fill: 'rgba(90,107,133,.14)' },
    { r: 0.78, label: 'Delusion', fill: 'rgba(90,107,133,.22)' },
    { r: 0.56, label: 'Demand', fill: 'rgba(232,86,63,.28)' },
    { r: 0.34, label: 'The Zone', fill: '#2E7D6B' }
  ]
  const c = size / 2
  const inTarget = zonePct >= 40 && zonePct <= 70
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} role="img" aria-label={`Zone of Fulfillment: ${zonePct}%`}>
        {rings.map((ring, i) => (
          <circle key={i} cx={c} cy={c} r={c * ring.r - 2} fill={ring.fill} />
        ))}
        <text x={c} y={c - 4} textAnchor="middle" className="fill-white font-display" fontSize={size * 0.16} fontWeight={700}>
          {zonePct}%
        </text>
        <text x={c} y={c + size * 0.075} textAnchor="middle" className="fill-white" fontSize={size * 0.05}>
          in the Zone
        </text>
      </svg>
      <p className={`text-xs mt-1 ${inTarget ? 'text-zone font-semibold' : 'text-ink-mute'}`}>
        {inTarget ? 'In the 40–70% target band' : 'Target: 40–70% of your time'}
      </p>
    </div>
  )
}
