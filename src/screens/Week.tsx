import { useMemo, useState } from 'react'
import { useStore, live, blockActions, blockTotals } from '../store/store'
import { BlockCard, HelpButton, Modal } from '../components/ui'
import { NewBlockModal } from '../components/capture'
import { ScheduleModal } from './Today'
import { weekKey, fmtDay, fmtDur, XP } from '../lib/utils'
import { Block, Category } from '../lib/types'

const HELP = `The Weekly Planning Process is the cornerstone of RPM — 45–60 minutes, ideally at the same time each week.

1 · Connect to what matters (your Ultimate Vision & Purpose)
2 · Focus on each vital area — what needs to happen in every Category this week?
3 · Capture, chunk, and create your RPM Blocks
4 · Set yourself up to win — schedule the musts, anticipate challenges.

Organizing the week by Category is deliberate: no area of life gets crowded out.`

function PlanningWizard({ onClose }: { onClose: () => void }) {
  const db = useStore(s => s.db)
  const { saveReview, addXp, setToast, setCelebration } = useStore.getState()
  const [step, setStep] = useState(0)
  const [challenges, setChallenges] = useState('')
  const [newBlockCat, setNewBlockCat] = useState<string | null>(null)
  const cats = live(db.categories).filter(c => !c.archived)
  const wk = weekKey()
  const lastWeekReview = live(db.reviews).find(r => r.type === 'weekly' && r.date === wk)

  const finish = () => {
    saveReview({ type: 'weekly', date: wk, whatDidntHappen: lastWeekReview?.whatDidntHappen ?? '', achievements: lastWeekReview?.achievements ?? '', magicMoments: challenges ? `Anticipated challenges & game plan: ${challenges}` : (lastWeekReview?.magicMoments ?? ''), acknowledgment: lastWeekReview?.acknowledgment ?? '' })
    addXp(XP.weeklyPlan, 'Weekly Planning done')
    setCelebration('week')
    onClose()
  }

  const steps = [
    {
      title: '1 · Connect to what matters',
      body: (
        <div className="space-y-3">
          {cats.slice(0, 4).map(c => c.m7.vision && (
            <div key={c.id} className="border-l-4 pl-3" style={{ borderColor: c.color }}>
              <p className="text-xs font-semibold">{c.juicyName || c.name}</p>
              <p className="purpose-text">{c.m7.vision}</p>
            </div>
          ))}
          <p className="text-sm">Take a breath. Who do you want to be this week? What do you stand for?</p>
        </div>
      )
    },
    {
      title: '2 · Focus on each vital area',
      body: (
        <div className="space-y-2">
          <p className="text-sm mb-2">For each Category: what needs to happen here this week? Create a Block where the answer matters.</p>
          {cats.map(c => {
            const has = live(db.blocks).some(b => b.scope === 'weekly' && b.periodDate === wk && b.categoryId === c.id)
            return (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                <span className="flex-1">{c.juicyName || c.name}</span>
                {has ? <span className="text-zone text-xs font-semibold">✓ planned</span>
                  : <button className="btn-ghost text-xs" onClick={() => setNewBlockCat(c.id)}>＋ Block</button>}
              </div>
            )
          })}
        </div>
      )
    },
    {
      title: '3 · Pick your 3-to-Thrive',
      body: <ThreeToThrive />
    },
    {
      title: '4 · Set yourself up to win',
      body: (
        <div>
          <p className="text-sm mb-2">Schedule your musts from the Week board after this. Then anticipate:</p>
          <span className="label">What challenges are likely this week — and what's your game plan?</span>
          <textarea className="input min-h-24" value={challenges} onChange={e => setChallenges(e.target.value)} />
        </div>
      )
    }
  ]

  return (
    <Modal open onClose={onClose} title="Weekly Planning" wide>
      <p className="label mb-2">{steps[step].title}</p>
      {steps[step].body}
      <div className="mt-4 flex justify-between">
        <button className="btn-ghost" onClick={() => step === 0 ? onClose() : setStep(step - 1)}>{step === 0 ? 'Later' : 'Back'}</button>
        {step < steps.length - 1
          ? <button className="btn-primary" onClick={() => setStep(step + 1)}>Next</button>
          : <button className="btn-signal" onClick={finish}>Finish planning</button>}
      </div>
      <NewBlockModal open={!!newBlockCat} onClose={() => setNewBlockCat(null)}
        defaults={{ scope: 'weekly', periodDate: wk, categoryId: newBlockCat ?? undefined }} />
    </Modal>
  )
}

function ThreeToThrive() {
  const db = useStore(s => s.db)
  const upsert = useStore(s => s.upsert)
  const wk = weekKey()
  const blocks = live(db.blocks).filter(b => b.scope === 'weekly' && b.periodDate === wk)
  const musts = blocks.filter(b => b.isMust).length
  return (
    <div>
      <p className="text-sm mb-2">Of everything this week, which 3 Results matter most? Mark them as Musts (<b className="text-signal">*</b>).</p>
      {blocks.map(b => (
        <label key={b.id} className="flex items-center gap-2 text-sm py-1">
          <input type="checkbox" checked={!!b.isMust}
            onChange={e => upsert<Block>('block', { ...b, isMust: e.target.checked })} />
          <span className={b.isMust ? 'font-semibold' : ''}>{b.result}</span>
        </label>
      ))}
      {blocks.length === 0 && <p className="text-sm text-ink-mute">No weekly Blocks yet — go back a step and create some.</p>}
      {musts > 3 && <p className="text-xs text-signal mt-1">Too many musts creates stress — the book suggests 3-to-Thrive.</p>}
    </div>
  )
}

function WeeklyReview({ onClose }: { onClose: () => void }) {
  const db = useStore(s => s.db)
  const { saveReview, carryForward } = useStore.getState()
  const wk = weekKey()
  const existing = live(db.reviews).find(r => r.type === 'weekly' && r.date === wk)
  const [ach, setAch] = useState(existing?.achievements ?? '')
  const [magic, setMagic] = useState(existing?.magicMoments ?? '')
  const [didnt, setDidnt] = useState(existing?.whatDidntHappen ?? '')
  const open = live(db.blocks)
    .filter(b => b.scope === 'weekly' && b.periodDate === wk)
    .flatMap(b => blockActions(db, b.id).filter(a => a.status === 'pending' || a.status === 'inProgress'))
  const bumped = live(db.slots).filter(s => s.status === 'bumped' && !s.rescheduledTo)

  return (
    <Modal open onClose={onClose} title="Weekly Review" wide>
      {bumped.length > 0 && (
        <p className="text-sm text-signal mb-3">⚠ {bumped.length} bumped Block Time slot{bumped.length > 1 ? 's' : ''} still need rescheduling — resolve them on Today before closing the week.</p>
      )}
      {open.length > 0 && (
        <div className="mb-3">
          <p className="label">Open actions — carry to next week or let go</p>
          {open.map(a => (
            <div key={a.id} className="flex items-center gap-2 py-1 text-sm">
              <span className="flex-1">{a.isMust && <b className="text-signal">* </b>}{a.text}</span>
              <button className="btn-ghost text-xs" onClick={() => carryForward(a.id, 'week')}>➜ Next week</button>
              <button className="btn-ghost text-xs" onClick={() => useStore.getState().setActionStatus(a.id, 'notNeeded')}>■ Not needed</button>
            </div>
          ))}
        </div>
      )}
      <span className="label">What did I accomplish that I'm proud of? What progress did I make?</span>
      <textarea className="input min-h-16 mb-2" value={ach} onChange={e => setAch(e.target.value)} />
      <span className="label">Magic moments</span>
      <textarea className="input min-h-16 mb-2" value={magic} onChange={e => setMagic(e.target.value)} />
      <span className="label">What didn't happen — what's not perfect yet?</span>
      <textarea className="input min-h-16" value={didnt} onChange={e => setDidnt(e.target.value)} />
      <button className="btn-signal w-full mt-4" onClick={() => {
        saveReview({ type: 'weekly', date: wk, achievements: ach, magicMoments: magic, whatDidntHappen: didnt, acknowledgment: '' })
        onClose()
      }}>Close the week ✦</button>
    </Modal>
  )
}

export default function Week() {
  const db = useStore(s => s.db)
  const [wizard, setWizard] = useState(false)
  const [review, setReview] = useState(false)
  const [newBlockCat, setNewBlockCat] = useState<string | null | 'none'>(null)
  const [scheduling, setScheduling] = useState<Block | null>(null)
  const wk = weekKey()

  const cats = live(db.categories).filter(c => !c.archived).sort((a, b) => a.sort - b.sort)
  const weekBlocks = useMemo(() => live(db.blocks).filter(b => b.scope === 'weekly' && b.periodDate === wk), [db.blocks, wk])
  const byCat = (c?: Category) => weekBlocks.filter(b => (c ? b.categoryId === c.id : !b.categoryId))
  const uncategorized = byCat(undefined)
  const totalMust = weekBlocks.reduce((s, b) => s + blockTotals(db, b.id).must, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="h-display text-4xl">This Week</h1>
        <HelpButton text={HELP} />
      </div>
      <p className="text-sm text-ink-mute mb-4">Week of {fmtDay(wk)} · Total Must Time {fmtDur(totalMust)}</p>

      <div className="flex flex-wrap gap-2 mb-5">
        <button className="btn-signal" data-tour="weekly-planning" onClick={() => setWizard(true)}>▶ Weekly Planning</button>
        <button className="btn-ghost" onClick={() => setReview(true)}>✦ Weekly review</button>
      </div>

      <div className="space-y-5">
        {cats.map(c => (
          <section key={c.id}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
              <h2 className="h-display text-2xl">{c.juicyName || c.name}</h2>
              <button className="btn-ghost text-xs ml-auto" onClick={() => setNewBlockCat(c.id)}>＋ Block</button>
            </div>
            {byCat(c).length === 0
              ? <p className="text-xs text-ink-mute pl-5">Nothing planned here this week — a conscious choice, or crowded out?</p>
              : <div className="grid gap-3 sm:grid-cols-2">
                  {byCat(c).map(b => (
                    <BlockCard key={b.id} block={b} categoryColor={c.color}
                      footer={<div className="mt-2"><button className="btn-ghost text-xs" onClick={() => setScheduling(b)}>◷ Commit Block Time</button></div>} />
                  ))}
                </div>}
          </section>
        ))}
        {uncategorized.length > 0 && (
          <section>
            <h2 className="h-display text-2xl mb-2 text-ink-mute">Uncategorized</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {uncategorized.map(b => <BlockCard key={b.id} block={b}
                footer={<div className="mt-2"><button className="btn-ghost text-xs" onClick={() => setScheduling(b)}>◷ Commit Block Time</button></div>} />)}
            </div>
          </section>
        )}
      </div>

      {wizard && <PlanningWizard onClose={() => setWizard(false)} />}
      {review && <WeeklyReview onClose={() => setReview(false)} />}
      <NewBlockModal open={!!newBlockCat} onClose={() => setNewBlockCat(null)}
        defaults={{ scope: 'weekly', periodDate: wk, categoryId: newBlockCat === 'none' ? undefined : newBlockCat ?? undefined }} />
      <ScheduleModal block={scheduling} open={!!scheduling} onClose={() => setScheduling(null)} />
    </div>
  )
}
