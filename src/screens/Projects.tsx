import { useState } from 'react'
import { Route, Routes, useNavigate, useParams, Link } from 'react-router-dom'
import { useStore, live, blockTotals } from '../store/store'
import { BlockCard, HelpButton, Modal, ResultRing } from '../components/ui'
import { NewBlockModal } from '../components/capture'
import { ScheduleModal } from './Today'
import { Block } from '../lib/types'
import { uid, now, weekKey } from '../lib/utils'
import { Project } from '../lib/types'

const HELP = `If it takes multiple Results to get what you want, it's a Project.

A Project's "Table of Contents": the Ultimate Result (the big target, circled), the Ultimate Purpose (why it matters), and the Key Results — the milestones, each of which becomes its own full RPM Block.

When you complete a Project, celebrate and capture what you learned. The finished plan becomes a Pathway to Power: a proven recipe you can reuse.`

function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useStore(s => s.db)
  const upsert = useStore(s => s.upsert)
  const nav = useNavigate()
  const [ur, setUr] = useState('')
  const [up, setUp] = useState('')
  const [catId, setCatId] = useState('')
  const [date, setDate] = useState('')
  const cats = live(db.categories).filter(c => !c.archived)
  return (
    <Modal open={open} onClose={onClose} title="New Project">
      <span className="label">Ultimate Result — what do I want to achieve, by when?</span>
      <input className="input mb-2" value={ur} onChange={e => setUr(e.target.value)} />
      <span className="label">Ultimate Purpose — why does it matter?</span>
      <textarea className="input min-h-20 mb-2" value={up} onChange={e => setUp(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="label">Category</span>
          <select className="input" value={catId} onChange={e => setCatId(e.target.value)}>
            <option value="">—</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.juicyName || c.name}</option>)}
          </select>
        </div>
        <div>
          <span className="label">Target date</span>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <button className="btn-signal w-full mt-4" disabled={!ur.trim() || !up.trim()} onClick={() => {
        const p: Project = { id: uid(), updatedAt: now(), ultimateResult: ur.trim(), ultimatePurpose: up.trim(), categoryId: catId || undefined, targetDate: date || undefined, status: 'active' }
        upsert('project', p)
        onClose()
        nav(`/projects/${p.id}`)
      }}>Create Project</button>
    </Modal>
  )
}

function EditProjectForm({ p, onDone, upsert, cats }: {
  p: Project; onDone: () => void
  upsert: <T extends { id: string; updatedAt: number }>(kind: any, row: T) => T
  cats: { id: string; name: string; juicyName?: string }[]
}) {
  const [ur, setUr] = useState(p.ultimateResult)
  const [up, setUp] = useState(p.ultimatePurpose)
  const [date, setDate] = useState(p.targetDate ?? '')
  const [catId, setCatId] = useState(p.categoryId ?? '')
  return (
    <>
      <span className="label">Ultimate Result</span>
      <input className="input mb-2" value={ur} onChange={e => setUr(e.target.value)} />
      <span className="label">Ultimate Purpose</span>
      <textarea className="input min-h-20 mb-2" value={up} onChange={e => setUp(e.target.value)} />
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <span className="label">Category</span>
          <select className="input" value={catId} onChange={e => setCatId(e.target.value)}>
            <option value="">—</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.juicyName || c.name}</option>)}
          </select>
        </div>
        <div>
          <span className="label">Target date</span>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <button className="btn-signal w-full" onClick={() => {
        upsert('project', { ...p, ultimateResult: ur.trim() || p.ultimateResult, ultimatePurpose: up.trim(), targetDate: date || undefined, categoryId: catId || undefined })
        onDone()
      }}>Save</button>
    </>
  )
}

function ProjectDetail() {
  const { id } = useParams()
  const db = useStore(s => s.db)
  const completeProject = useStore(s => s.completeProject)
  const cloneAsPathway = useStore(s => s.cloneAsPathway)
  const [newKR, setNewKR] = useState(false)
  const [scheduling, setScheduling] = useState<Block | null>(null)
  const [celebrating, setCelebrating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [wins, setWins] = useState('')
  const [improve, setImprove] = useState('')
  const nav = useNavigate()

  const p = id ? db.projects[id] : undefined
  if (!p || p.deleted) return <p className="text-ink-mute">Project not found. <Link className="underline" to="/projects">Back to Projects</Link></p>

  const upsert = useStore(s => s.upsert)
  const krs = live(db.blocks).filter(b => b.projectId === p.id)
  const doneKr = krs.filter(b => b.status === 'completed').length
  const cat = p.categoryId ? db.categories[p.categoryId] : undefined
  const totalMust = krs.reduce((s, b) => s + blockTotals(db, b.id).must, 0)

  return (
    <div>
      <Link to="/projects" className="text-sm text-ink-mute">← Projects</Link>
      <div className="card p-5 mt-2 border-l-4" style={{ borderLeftColor: cat?.color ?? '#E8563F' }}>
        <div className="flex items-start gap-4">
          <ResultRing pct={krs.length ? doneKr / krs.length : 0} size={64} color={cat?.color ?? '#E8563F'}>
            {doneKr}/{krs.length}
          </ResultRing>
          <div className="min-w-0">
            <h1 className="h-display text-2xl sm:text-3xl leading-tight break-words">{p.ultimateResult}</h1>
            <p className="purpose-text mt-1">“{p.ultimatePurpose}”</p>
            <p className="text-xs text-ink-mute mt-1">
              {cat ? `${cat.juicyName || cat.name} · ` : ''}{p.targetDate ? `By ${p.targetDate} · ` : ''}Total Must Time in Key Results: {Math.round(totalMust / 60)}h
            </p>
          </div>
          <button aria-label="Edit project" className="text-ink-mute text-sm px-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
            onClick={() => setEditing(true)}>✎</button>
        </div>
        {p.status === 'completed' && p.celebration && (
          <div className="mt-3 text-sm bg-zone-soft dark:bg-zone/20 rounded-lg p-3">
            <p><b>Wins:</b> {p.celebration.wins}</p>
            <p className="mt-1"><b>Improve next time:</b> {p.celebration.improvements}</p>
          </div>
        )}
      </div>

      <h2 className="h-display text-2xl mt-5 mb-2">Key Results</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {krs.map(b => <BlockCard key={b.id} block={b} categoryColor={cat?.color}
          footer={b.status !== 'completed'
            ? <div className="mt-2"><button className="btn-ghost text-xs" onClick={() => setScheduling(b)}>◷ Commit Block Time</button></div>
            : undefined} />)}
      </div>
      <ScheduleModal block={scheduling} open={!!scheduling} onClose={() => setScheduling(null)} />

      <div className="mt-4 flex flex-wrap gap-2">
        {p.status === 'active' && <>
          <button className="btn-primary" onClick={() => setNewKR(true)}>＋ Key Result</button>
          {krs.length > 0 && <button className="btn-signal" onClick={() => setCelebrating(true)}>✦ Complete & Celebrate</button>}
        </>}
        {p.status === 'completed' && (
          <button className="btn-primary" onClick={() => { cloneAsPathway('project', p.id, weekKey()); nav('/projects') }}>
            ⇉ Reuse as Pathway to Power
          </button>
        )}
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit Project">
        <EditProjectForm p={p} onDone={() => setEditing(false)} upsert={upsert} cats={live(db.categories).filter(c => !c.archived)} />
      </Modal>

      <NewBlockModal open={newKR} onClose={() => setNewKR(false)}
        defaults={{ projectId: p.id, categoryId: p.categoryId, scope: 'project', periodDate: '' }} />

      <Modal open={celebrating} onClose={() => setCelebrating(false)} title="Complete · Measure · Celebrate">
        <span className="label">Build on success — what did I achieve that I'm proud of? What worked and why?</span>
        <textarea className="input min-h-20 mb-2" value={wins} onChange={e => setWins(e.target.value)} />
        <span className="label">Improve for the future — what didn't go as planned?</span>
        <textarea className="input min-h-20" value={improve} onChange={e => setImprove(e.target.value)} />
        <button className="btn-signal w-full mt-4" onClick={() => { completeProject(p.id, wins, improve); setCelebrating(false) }}>
          Celebrate — this plan is now a Pathway to Power
        </button>
      </Modal>
    </div>
  )
}

function ProjectList() {
  const db = useStore(s => s.db)
  const [creating, setCreating] = useState(false)
  const projects = live(db.projects)
  const active = projects.filter(p => p.status === 'active')
  const done = projects.filter(p => p.status === 'completed')

  const Card = ({ p }: { p: Project }) => {
    const upsert = useStore(s => s.upsert)
  const krs = live(db.blocks).filter(b => b.projectId === p.id)
    const doneKr = krs.filter(b => b.status === 'completed').length
    const cat = p.categoryId ? db.categories[p.categoryId] : undefined
    return (
      <Link to={`/projects/${p.id}`} className="card p-3 sm:p-4 flex items-center gap-3 border-l-4 hover:shadow-md transition-shadow min-w-0 overflow-hidden"
        style={{ borderLeftColor: cat?.color ?? '#5A6B85' }}>
        <ResultRing pct={krs.length ? doneKr / krs.length : 0} color={cat?.color ?? '#E8563F'}>{doneKr}/{krs.length}</ResultRing>
        <div className="min-w-0 flex-1">
          <p className="h-display text-lg sm:text-xl leading-tight break-words">{p.ultimateResult}</p>
          <p className="text-xs text-ink-mute">{cat ? (cat.juicyName || cat.name) : '—'}{p.targetDate ? ` · by ${p.targetDate}` : ''}{p.sourcePathwayId ? ' · ⇉ from Pathway' : ''}</p>
        </div>
      </Link>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="h-display text-4xl">Projects</h1>
        <HelpButton text={HELP} />
      </div>
      <button className="btn-primary mb-4" data-tour="projects" onClick={() => setCreating(true)}>＋ New Project</button>
      <div className="grid gap-3 sm:grid-cols-2">{active.map(p => <Card key={p.id} p={p} />)}</div>
      {active.length === 0 && <p className="text-sm text-ink-mute">No active Projects. A dream with a plan becomes a Project.</p>}
      {done.length > 0 && <>
        <h2 className="h-display text-2xl mt-6 mb-2 text-ink-mute">Completed — Pathways to Power</h2>
        <div className="grid gap-3 sm:grid-cols-2">{done.map(p => <Card key={p.id} p={p} />)}</div>
      </>}
      <NewProjectModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

export default function Projects() {
  return (
    <Routes>
      <Route index element={<ProjectList />} />
      <Route path=":id" element={<ProjectDetail />} />
    </Routes>
  )
}
