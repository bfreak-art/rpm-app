import { useMemo, useState } from 'react'
import { useStore, live, blockActions } from '../store/store'
import { HelpButton } from '../components/ui'
import { markGlyph } from '../components/ui'
import { weekKey, fmtDay } from '../lib/utils'

const HELP = `Every completed plan is a Pathway to Power — a proven recipe you never have to reinvent.

Search past Blocks, Projects, and reviews. When a similar Result comes up again, reuse the plan: same structure, statuses reset. Pattern recognition is how RPM gets faster the longer you use it.`

export default function History() {
  const db = useStore(s => s.db)
  const cloneAsPathway = useStore(s => s.cloneAsPathway)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [tab, setTab] = useState<'blocks' | 'projects' | 'reviews'>('blocks')
  const cats = live(db.categories)

  const blocks = useMemo(() => live(db.blocks)
    .filter(b => b.status === 'completed')
    .filter(b => !cat || b.categoryId === cat)
    .filter(b => !q || (b.result + ' ' + b.purpose).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt), [db.blocks, q, cat])

  const projects = useMemo(() => live(db.projects)
    .filter(p => p.status !== 'active')
    .filter(p => !cat || p.categoryId === cat)
    .filter(p => !q || (p.ultimateResult + ' ' + p.ultimatePurpose).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt), [db.projects, q, cat])

  const reviews = useMemo(() => live(db.reviews)
    .filter(r => !q || (r.achievements + ' ' + r.magicMoments + ' ' + r.whatDidntHappen).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date)), [db.reviews, q])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="h-display text-4xl">History</h1>
        <HelpButton text={HELP} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input className="input flex-1 min-w-40" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input w-auto" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">All categories</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.juicyName || c.name}</option>)}
        </select>
        <div className="flex rounded-lg overflow-hidden border border-black/10 dark:border-white/15">
          {(['blocks', 'projects', 'reviews'] as const).map(t => (
            <button key={t} className={`px-3 py-1.5 text-sm capitalize ${tab === t ? 'bg-ink text-white' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      {tab === 'blocks' && (
        <div className="space-y-2">
          {blocks.map(b => {
            const c = b.categoryId ? db.categories[b.categoryId] : undefined
            const acts = blockActions(db, b.id)
            return (
              <details key={b.id} className="card p-3 border-l-4" style={{ borderLeftColor: c?.color ?? '#5A6B85' }}>
                <summary className="flex items-center gap-2 cursor-pointer">
                  <span className="h-display text-lg flex-1">{b.result}</span>
                  <span className="text-[11px] text-ink-mute">{c ? (c.juicyName || c.name) : ''}</span>
                  <button className="btn-ghost text-xs" onClick={e => { e.preventDefault(); cloneAsPathway('block', b.id, weekKey()) }}>⇉ Reuse</button>
                </summary>
                {b.purpose && <p className="purpose-text mt-1">“{b.purpose}”</p>}
                <ul className="mt-2 text-sm">
                  {acts.map(a => <li key={a.id} className="flex gap-2"><span className="w-4 font-bold">{markGlyph(a.status)}</span>{a.isMust && <b className="text-signal">*</b>}<span>{a.text}</span></li>)}
                </ul>
              </details>
            )
          })}
          {blocks.length === 0 && <p className="text-sm text-ink-mute">No completed Blocks match.</p>}
        </div>
      )}

      {tab === 'projects' && (
        <div className="space-y-2">
          {projects.map(p => (
            <div key={p.id} className="card p-3">
              <div className="flex items-center gap-2">
                <span className="h-display text-lg flex-1">{p.ultimateResult}</span>
                <button className="btn-ghost text-xs" onClick={() => cloneAsPathway('project', p.id, weekKey())}>⇉ Reuse</button>
              </div>
              {p.celebration && <p className="text-sm mt-1"><b>Wins:</b> {p.celebration.wins}</p>}
            </div>
          ))}
          {projects.length === 0 && <p className="text-sm text-ink-mute">No completed Projects match.</p>}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-2">
          {reviews.map(r => (
            <div key={r.id} className="card p-3 text-sm">
              <p className="label">{r.type === 'weekly' ? `Week of ${fmtDay(r.date)}` : fmtDay(r.date)} · {r.type}</p>
              {r.achievements && <p><b>Achieved:</b> {r.achievements}</p>}
              {r.magicMoments && <p><b>Magic moments:</b> {r.magicMoments}</p>}
              {r.whatDidntHappen && <p className="text-ink-mute"><b>Didn't happen:</b> {r.whatDidntHappen}</p>}
              {r.acknowledgment && <p className="text-zone"><b>Acknowledged:</b> {r.acknowledgment}</p>}
            </div>
          ))}
          {reviews.length === 0 && <p className="text-sm text-ink-mute">No reviews match.</p>}
        </div>
      )}
    </div>
  )
}
