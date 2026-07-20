import { useMemo, useState } from 'react'
import { useStore, live, blockActions } from '../store/store'
import { BlockCard, HelpButton, Modal } from '../components/ui'
import { NewBlockModal } from '../components/capture'
import { dayKey, weekKey, fmtTime, fmtDur, fmtDay } from '../lib/utils'
import { Block, Slot } from '../lib/types'
import { format } from 'date-fns'

const HELP = `An RPM day is 3–5 Blocks, not a to-do list.

Each Block: the Result you want (circled), the Purpose that drives it, and a Massive Action Plan — a menu of choices, not have-tos. 20% of actions give 80% of the Result.

Commit Block Time: "90 minutes on this Result." If life bumps a slot, it moves — it never disappears.`

export function ScheduleModal({ block, open, onClose, replacingSlot }: {
  block: Block | null; open: boolean; onClose: () => void; replacingSlot?: Slot
}) {
  const scheduleBlock = useStore(s => s.scheduleBlock)
  const upsert = useStore(s => s.upsert)
  const [date, setDate] = useState(dayKey())
  const [start, setStart] = useState('09:00')
  const [mins, setMins] = useState('90')
  if (!block) return null
  const go = async () => {
    const m = Math.max(5, parseInt(mins) || 60)
    const s = new Date(`${date}T${start}`).getTime()
    const slot = await scheduleBlock(block.id, s, s + m * 60000)
    if (replacingSlot) {
      upsert<Slot>('slot', { ...replacingSlot, rescheduledTo: slot.id })
    }
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Commit Block Time">
      <p className="text-sm mb-3">When it's scheduled, it's <b>real</b>. — <span className="purpose-text">{block.result}</span></p>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1"><span className="label">Day</span><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><span className="label">Start</span><input type="time" className="input" value={start} onChange={e => setStart(e.target.value)} /></div>
        <div>
          <span className="label">Minutes</span>
          <input type="text" inputMode="numeric" pattern="[0-9]*" className="input" value={mins}
            onChange={e => setMins(e.target.value.replace(/[^0-9]/g, ''))} placeholder="90" />
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {[30, 45, 60, 90, 120].map(m => (
              <button key={m} type="button" onClick={() => setMins(String(m))}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${mins === String(m) ? 'bg-ink text-white border-ink dark:bg-signal dark:border-signal' : 'border-black/15 dark:border-white/20'}`}>
                {m < 60 ? `${m}m` : `${m / 60}h`}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button className="btn-signal w-full mt-4" onClick={go}>Schedule it</button>
    </Modal>
  )
}

function DailyReview({ onClose }: { onClose: () => void }) {
  const db = useStore(s => s.db)
  const saveReview = useStore(s => s.saveReview)
  const carryForward = useStore(s => s.carryForward)
  const today = dayKey()
  const existing = live(db.reviews).find(r => r.type === 'daily' && r.date === today)
  const [ach, setAch] = useState(existing?.achievements ?? '')
  const [magic, setMagic] = useState(existing?.magicMoments ?? '')
  const [ack, setAck] = useState(existing?.acknowledgment ?? '')
  const [evening, setEvening] = useState(existing?.evening ?? '')

  const openActions = live(db.blocks)
    .filter(b => b.scope === 'daily' && b.periodDate === today)
    .flatMap(b => blockActions(db, b.id).filter(a => a.status === 'pending' || a.status === 'inProgress'))

  return (
    <Modal open onClose={onClose} title="Complete · Measure · Celebrate" wide>
      {openActions.length > 0 && (
        <div className="mb-4">
          <p className="label">Still open — carry over or let go</p>
          {openActions.map(a => (
            <div key={a.id} className="flex items-center gap-2 py-1 text-sm">
              <span className="flex-1">{a.isMust && <b className="text-signal">* </b>}{a.text}</span>
              <button className="btn-ghost text-xs" onClick={() => carryForward(a.id, 'day')}>➜ Tomorrow</button>
              <button className="btn-ghost text-xs" onClick={() => useStore.getState().setActionStatus(a.id, 'notNeeded')}>■ Not needed</button>
            </div>
          ))}
        </div>
      )}
      <span className="label">What did I achieve today?</span>
      <textarea className="input min-h-16 mb-2" value={ach} onChange={e => setAch(e.target.value)} />
      <span className="label">Magic moments</span>
      <textarea className="input min-h-16 mb-2" value={magic} onChange={e => setMagic(e.target.value)} placeholder="Savor them — you can't manage what you don't measure" />
      <span className="label">One thing to acknowledge myself for</span>
      <input className="input mb-2" value={ack} onChange={e => setAck(e.target.value)} placeholder="If you don't give yourself credit, who will?" />
      <span className="label">Evening power question — what did I learn or improve today?</span>
      <input className="input" value={evening} onChange={e => setEvening(e.target.value)} />
      <button className="btn-signal w-full mt-4" onClick={() => {
        saveReview({ type: 'daily', date: today, achievements: ach, magicMoments: magic, acknowledgment: ack, evening })
        onClose()
      }}>Celebrate the day ✦</button>
    </Modal>
  )
}

export default function Today() {
  const db = useStore(s => s.db)
  const settings = useStore(s => s.settings)
  const saveReview = useStore(s => s.saveReview)
  const completeSlot = useStore(s => s.completeSlot)
  const deleteSlot = useStore(s => s.deleteSlot)
  const [newBlock, setNewBlock] = useState(false)
  const [scheduling, setScheduling] = useState<{ block: Block; replacing?: Slot } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [morning, setMorning] = useState('')

  const today = dayKey()
  const wk = weekKey()
  const blocks = useMemo(() =>
    live(db.blocks).filter(b =>
      (b.scope === 'daily' && b.periodDate === today) ||
      (b.scope === 'weekly' && b.periodDate === wk && b.status !== 'completed')
    ).sort((a, b) => Number(b.isMust ?? false) - Number(a.isMust ?? false)),
    [db.blocks, today, wk])

  const todaySlots = live(db.slots)
    .filter(s => dayKey(new Date(s.start)) === today && s.status !== 'bumped')
    .sort((a, b) => a.start - b.start)

  const bumpedAll = live(db.slots).filter(s => {
    if (s.status !== 'bumped' || s.rescheduledTo) return false
    const b = db.blocks[s.blockId]
    return !!b && !b.deleted && b.status !== 'completed'
  })
  // one entry per block — no more duplicate rows when several slots were missed
  const bumped = [...new Map(bumpedAll.map(s => [s.blockId, s])).values()]
  const bumpedExtra = (blockId: string) => bumpedAll.filter(s => s.blockId === blockId).length - 1
  const staleBlocks = live(db.blocks).filter(b =>
    b.scope === 'daily' && b.periodDate && b.periodDate < today && b.status !== 'completed')
  const review = live(db.reviews).find(r => r.type === 'daily' && r.date === today)
  const cat = (id?: string) => (id ? db.categories[id] : undefined)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="h-display text-4xl">Today</h1>
        <HelpButton text={HELP} />
      </div>
      <p className="text-sm text-ink-mute mb-4">{format(new Date(), 'EEEE, d MMMM')}</p>

      {settings.rituals && !review?.morning && (
        <form className="card p-3 mb-4"
          onSubmit={e => { e.preventDefault(); if (morning.trim()) saveReview({ type: 'daily', date: today, morning }) }}>
          <p className="text-sm font-medium mb-1.5">☀ Morning power question</p>
          <p className="text-sm text-ink-mute mb-2">What am I happy or excited about right now?</p>
          <div className="flex gap-2">
            <input className="input" placeholder="Type your answer…"
              value={morning} onChange={e => setMorning(e.target.value)} />
            <button className="btn-primary text-sm shrink-0">Save</button>
          </div>
        </form>
      )}

      {staleBlocks.length > 0 && (
        <div className="card p-3 mb-4 border-l-4 border-signal">
          <p className="text-sm font-semibold mb-0.5">Unfinished from a previous day</p>
          <p className="text-xs text-ink-mute mb-2">Results don't vanish overnight. Move the Block to today, or carry its open actions to the Inbox and archive it.</p>
          {staleBlocks.map(b => {
            const open = blockActions(db, b.id).filter(a => a.status === 'pending' || a.status === 'inProgress').length
            return (
              <div key={b.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm border-t border-black/5 dark:border-white/10 first:border-0">
                <span className="flex-1 min-w-40">{b.result} <span className="text-xs text-ink-mute">({fmtDay(b.periodDate)} · {open} open)</span></span>
                <button className="btn-signal text-xs" onClick={() => useStore.getState().moveBlockToToday(b.id)}>→ Move to today</button>
                <button className="btn-ghost text-xs" onClick={() => useStore.getState().carryBlockForward(b.id)}>➜ Actions to Inbox</button>
              </div>
            )
          })}
        </div>
      )}

      {bumped.length > 0 && (
        <div className="card p-3 mb-4 border-l-4 border-signal">
          <p className="text-sm font-semibold mb-1">Block Time moved — it never disappears</p>
          {bumped.map(s => {
            const b = db.blocks[s.blockId]
            if (!b) return null
            const extra = bumpedExtra(s.blockId)
            return (
              <div key={s.id} className="flex items-center gap-2 text-sm py-1">
                <span className="flex-1">{b.result}{extra > 0 && <span className="text-xs text-ink-mute"> (+{extra} more missed)</span>}</span>
                <button className="btn-signal text-xs" onClick={() => setScheduling({ block: b, replacing: s })}>Reschedule</button>
                <button className="btn-ghost text-xs" onClick={() => bumpedAll.filter(x => x.blockId === s.blockId).forEach(x => deleteSlot(x.id))}>Let go</button>
              </div>
            )
          })}
        </div>
      )}

      {todaySlots.length > 0 && (
        <div className="card p-4 mb-4">
          <p className="label">Committed Block Time</p>
          {todaySlots.map(s => {
            const b = db.blocks[s.blockId]
            if (!b) return null
            const c = cat(b.categoryId)
            return (
              <div key={s.id} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="font-display text-lg w-24 shrink-0">{fmtTime(s.start)}–{fmtTime(s.end)}</span>
                <span className="w-1.5 h-5 rounded-full" style={{ background: c?.color ?? '#5A6B85' }} />
                <span className="flex-1">{b.result} <span className="text-ink-mute text-xs">({fmtDur(Math.round((s.end - s.start) / 60000))})</span></span>
                {s.status === 'completed'
                  ? <span className="text-zone font-bold">✘ done</span>
                  : <button className="btn-ghost text-xs" onClick={() => completeSlot(s.id)}>Mark done</button>}
              </div>
            )
          })}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2" data-tour="today-blocks">
        {blocks.map(b => (
          <BlockCard key={b.id} block={b} categoryColor={cat(b.categoryId)?.color}
            footer={
              <div className="mt-2 flex gap-2">
                <button className="btn-ghost text-xs" onClick={() => setScheduling({ block: b })}>◷ Commit Block Time</button>
              </div>
            } />
        ))}
      </div>

      {blocks.length === 0 && (
        <div className="card p-8 text-center text-ink-mute" data-tour="today-blocks">
          <p className="h-display text-2xl mb-1 text-ink dark:text-white">No Blocks yet</p>
          <p className="text-sm">Ask the first question of the day: what Result am I committed to achieve?</p>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button className="btn-primary" onClick={() => setNewBlock(true)}>＋ New Block</button>
        <button className="btn-ghost" data-tour="evening-review" onClick={() => setReviewOpen(true)}>
          {review?.achievements ? '✦ Review saved — edit' : '✦ Evening review'}
        </button>
      </div>

      <NewBlockModal open={newBlock} onClose={() => setNewBlock(false)} defaults={{ scope: 'daily', periodDate: today }} />
      <ScheduleModal block={scheduling?.block ?? null} replacingSlot={scheduling?.replacing}
        open={!!scheduling} onClose={() => setScheduling(null)} />
      {reviewOpen && <DailyReview onClose={() => setReviewOpen(false)} />}
    </div>
  )
}
