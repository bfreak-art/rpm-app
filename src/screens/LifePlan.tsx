import { useState } from 'react'
import { useStore, live } from '../store/store'
import { HelpButton, Modal } from '../components/ui'
import { Area, Category, Magnificent7 } from '../lib/types'
import { uid, now, DEFAULT_CATEGORY_COLORS } from '../lib/utils'
import { emptyM7 } from '../lib/types'

const HELP = `Your Life Plan is the top of the RPM pyramid: Areas of Management (Personal / Professional), each holding your Categories of Improvement — 5–8 areas you commit to constantly improve.

Give each Category a juicy nickname and Roles that make you want to spend time there ("Wealth Wizard" beats "finances").

The Magnificent 7 turns each Category into a vision you revisit every weekly planning: Vision · Purpose · Roles · 3-to-Thrive · Resources · 1-Year Results · 90-Day Results.`

const M7_FIELDS: { key: keyof Magnificent7; label: string; hint: string; area?: boolean }[] = [
  { key: 'vision', label: '1 · Vision', hint: 'What does my ideal, happiest life look like in this area?', area: true },
  { key: 'purpose', label: '2 · Purpose', hint: "Why is success here an absolute must? How will it make me feel?", area: true },
  { key: 'roles', label: '3 · Roles', hint: 'Who do I want to be here — for myself and others?' },
  { key: 'resources', label: '5 · Resources', hint: 'Who or what do I have access to that can help?', area: true },
  { key: 'oneYear', label: '6a · 1-Year Results', hint: 'What am I committed to achieve within a year?', area: true },
  { key: 'ninetyDay', label: '6b · 90-Day Results', hint: 'And in the next 90 days?', area: true }
]

function M7Editor({ cat, onClose }: { cat: Category; onClose: () => void }) {
  const upsert = useStore(s => s.upsert)
  const checkM7Complete = useStore(s => s.checkM7Complete)
  const [m7, setM7] = useState<Magnificent7>({ ...cat.m7, threeToThrive: [...cat.m7.threeToThrive] as [string, string, string] })
  const [rolesStr, setRolesStr] = useState(cat.roles.join(', '))

  const save = () => {
    const roles = rolesStr.split(',').map(r => r.trim()).filter(Boolean)
    // Roles live in ONE place: the category chips. m7.roles mirrors them for completeness tracking.
    upsert<Category>('category', { ...cat, roles, m7: { ...m7, roles: roles.join(', ') } })
    checkM7Complete(cat.id)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Magnificent 7 — ${cat.juicyName || cat.name}`} wide>
      <div className="space-y-3">
        {M7_FIELDS.slice(0, 2).map(f => (
          <div key={f.key}>
            <span className="label">{f.label}</span>
            <p className="text-xs text-ink-mute mb-1">{f.hint}</p>
            <textarea className="input min-h-16" value={m7[f.key] as string} onChange={e => setM7({ ...m7, [f.key]: e.target.value })} />
          </div>
        ))}
        <div>
          <span className="label">3 · Roles</span>
          <p className="text-xs text-ink-mute mb-1">Who do I want to be here? These are the same role chips shown on the category card — one place, always in sync.</p>
          <input className="input" value={rolesStr} onChange={e => setRolesStr(e.target.value)} placeholder="comma-separated, e.g. Healthy strongman, Happy eater" />
        </div>
        <div>
          <span className="label">4 · 3-to-Thrive</span>
          <p className="text-xs text-ink-mute mb-1">The 3 focus areas with the biggest impact.</p>
          {[0, 1, 2].map(i => (
            <input key={i} className="input mb-1.5" placeholder={`Focus ${i + 1}`} value={m7.threeToThrive[i]}
              onChange={e => {
                const t = [...m7.threeToThrive] as [string, string, string]
                t[i] = e.target.value
                setM7({ ...m7, threeToThrive: t })
              }} />
          ))}
        </div>
        {M7_FIELDS.slice(3).map(f => (
          <div key={f.key}>
            <span className="label">{f.label}</span>
            <p className="text-xs text-ink-mute mb-1">{f.hint}</p>
            <textarea className="input min-h-14" value={m7[f.key] as string} onChange={e => setM7({ ...m7, [f.key]: e.target.value })} />
          </div>
        ))}
        <p className="text-xs text-ink-mute">7 · RPM Action Plans — the Projects and Blocks you create from this Category <i>are</i> step 7. They live on the Projects and Week screens, linked by color.</p>
      </div>
      <button className="btn-signal w-full mt-4" onClick={save}>Save Magnificent 7</button>
    </Modal>
  )
}

/** The actual Wheel of Life: one segment per active category, filled to its latest rating.
 *  Rebuilds automatically as categories are added, renamed, recolored, or archived. */
function WheelOfLife({ cats }: { cats: Category[] }) {
  const rated = cats.filter(c => true)
  if (rated.length < 2) return null
  const size = 240
  const cx = size / 2, cy = size / 2
  const R = size / 2 - 8
  const n = rated.length
  const avg = Math.round(
    rated.reduce((s, c) => s + (c.wheel.length ? c.wheel[c.wheel.length - 1].pct : 0), 0) / n
  )

  const seg = (i: number, radius: number) => {
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2
    const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2
    const x0 = cx + radius * Math.cos(a0), y0 = cy + radius * Math.sin(a0)
    const x1 = cx + radius * Math.cos(a1), y1 = cy + radius * Math.sin(a1)
    const large = 1 / n > 0.5 ? 1 : 0
    return `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1} Z`
  }

  return (
    <div className="card p-4 mb-5 flex flex-col sm:flex-row items-center gap-4">
      <svg width={size} height={size} className="shrink-0" role="img" aria-label="Wheel of Life">
        {/* faint full segments as the 100% outline */}
        {rated.map((c, i) => (
          <path key={`bg-${c.id}`} d={seg(i, R)} fill={c.color} opacity={0.12}
            stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} />
        ))}
        {/* filled to the latest rating */}
        {rated.map((c, i) => {
          const pct = c.wheel.length ? c.wheel[c.wheel.length - 1].pct : 0
          return <path key={c.id} d={seg(i, R * Math.max(0.04, pct / 100))} fill={c.color} opacity={0.85} />
        })}
        {/* guide rings */}
        {[0.25, 0.5, 0.75].map(r => (
          <circle key={r} cx={cx} cy={cy} r={R * r} fill="none" stroke="currentColor" strokeOpacity={0.12} />
        ))}
        <circle cx={cx} cy={cy} r={26} className="fill-paper-card dark:fill-paper-darkcard" />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          className="fill-current font-display" fontSize={20} fontWeight={700}>{avg}%</text>
      </svg>
      <div className="flex-1 min-w-0 w-full">
        <p className="label">Wheel of Life — a balanced wheel rolls</p>
        <p className="text-xs text-ink-mute mb-2">Each slice fills to how fulfilled you rated that category. Deep dents show where life is getting crowded out. Re-rate anytime with the sliders below.</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {rated.map(c => {
            const pct = c.wheel.length ? c.wheel[c.wheel.length - 1].pct : null
            return (
              <div key={c.id} className="flex items-center gap-1.5 text-xs min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                <span className="truncate flex-1">{c.juicyName || c.name}</span>
                <b className="shrink-0">{pct !== null ? `${pct}%` : '—'}</b>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CategoryCard({ cat }: { cat: Category }) {
  const db = useStore(s => s.db)
  const upsert = useStore(s => s.upsert)
  const rateWheel = useStore(s => s.rateWheel)
  const [editing, setEditing] = useState(false)
  const [m7Open, setM7Open] = useState(false)
  const [name, setName] = useState(cat.name)
  const [juicy, setJuicy] = useState(cat.juicyName ?? '')
  const [roles, setRoles] = useState(cat.roles.join(', '))
  const [color, setColor] = useState(cat.color)

  const projects = live(db.projects).filter(p => p.categoryId === cat.id && p.status === 'active')
  const m7Filled = [cat.m7.vision, cat.m7.purpose, cat.m7.roles, cat.m7.resources, cat.m7.oneYear, cat.m7.ninetyDay, ...cat.m7.threeToThrive].filter(x => x.trim()).length
  const lastWheel = cat.wheel.length ? cat.wheel[cat.wheel.length - 1].pct : null

  return (
    <div className="card p-3 sm:p-4 border-l-4 min-w-0 overflow-hidden" style={{ borderLeftColor: cat.color }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="h-display text-xl sm:text-2xl leading-tight break-words">{cat.juicyName || cat.name}</h3>
          {cat.juicyName && <p className="text-xs text-ink-mute">{cat.name}</p>}
          {cat.roles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {cat.roles.map(r => <span key={r} className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${cat.color}22`, color: cat.color }}>{r}</span>)}
            </div>
          )}
        </div>
        <button className="btn-ghost text-xs shrink-0" onClick={() => setEditing(true)}>Edit</button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-mute">
        <button className="btn-ghost text-xs px-2" onClick={() => setM7Open(true)}>
          <b className={m7Filled === 9 ? 'text-zone' : ''}>7</b>&nbsp;Magnificent 7 · {m7Filled}/9
        </button>
        <span>{projects.length} active project{projects.length === 1 ? '' : 's'}</span>
        <label className="sm:ml-auto flex items-center gap-1.5">
          Wheel
          <input type="range" min={0} max={100} step={5} defaultValue={lastWheel ?? 50}
            onMouseUp={e => rateWheel(cat.id, parseInt((e.target as HTMLInputElement).value))}
            onTouchEnd={e => rateWheel(cat.id, parseInt((e.target as HTMLInputElement).value))}
            className="accent-current w-16 sm:w-20" style={{ color: cat.color }} />
          <b>{lastWheel !== null ? `${lastWheel}%` : '—'}</b>
        </label>
      </div>

      {cat.m7.vision && <p className="purpose-text mt-2 line-clamp-2">“{cat.m7.vision}”</p>}

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit Category">
        <span className="label">Name</span>
        <input className="input mb-2" value={name} onChange={e => setName(e.target.value)} />
        <span className="label">Juicy nickname (optional — make it exciting)</span>
        <input className="input mb-2" value={juicy} onChange={e => setJuicy(e.target.value)} placeholder="e.g. Wealth Wizard" />
        <span className="label">Roles (comma-separated)</span>
        <input className="input mb-2" value={roles} onChange={e => setRoles(e.target.value)} placeholder="e.g. Explorer, Deal Maker" />
        <span className="label">Color</span>
        <div className="flex gap-1.5 mb-3">
          {DEFAULT_CATEGORY_COLORS.map(c => (
            <button key={c} className={`w-7 h-7 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-ink' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={() => {
            upsert<Category>('category', { ...cat, name, juicyName: juicy || undefined, roles: roles.split(',').map(r => r.trim()).filter(Boolean), color })
            setEditing(false)
          }}>Save</button>
          <button className="btn-ghost text-signal" onClick={() => { upsert<Category>('category', { ...cat, archived: true }); setEditing(false) }}>Archive</button>
        </div>
      </Modal>

      {m7Open && <M7Editor cat={cat} onClose={() => setM7Open(false)} />}
    </div>
  )
}

export default function LifePlan() {
  const db = useStore(s => s.db)
  const upsert = useStore(s => s.upsert)
  const areas = live(db.areas).filter(a => !a.archived).sort((a, b) => a.sort - b.sort)
  const cats = live(db.categories).filter(c => !c.archived)

  const addCategory = (areaId: string) => {
    const name = prompt('Category name (an area you commit to constantly improve):')
    if (!name?.trim()) return
    upsert<Category>('category', {
      id: uid(), updatedAt: now(), areaId, name: name.trim(),
      color: DEFAULT_CATEGORY_COLORS[cats.length % DEFAULT_CATEGORY_COLORS.length],
      roles: [], sort: cats.length, m7: emptyM7(), wheel: []
    })
  }

  const addArea = () => {
    const name = prompt('Area of Management name:')
    if (!name?.trim()) return
    upsert<Area>('area', { id: uid(), updatedAt: now(), name: name.trim(), sort: areas.length })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="h-display text-4xl">Life Plan</h1>
        <HelpButton text={HELP} />
      </div>
      <WheelOfLife cats={cats} />
      {areas.map((area, ai) => (
        <section key={area.id} className="mb-6" data-tour={ai === 0 ? 'lifeplan' : undefined}>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="h-display text-2xl sm:text-3xl text-ink-mute">{area.name}</h2>
            <button className="btn-ghost text-xs" onClick={() => addCategory(area.id)}>＋ Category</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 min-w-0">
            {cats.filter(c => c.areaId === area.id).sort((a, b) => a.sort - b.sort).map(c => <CategoryCard key={c.id} cat={c} />)}
          </div>
        </section>
      ))}
      <button className="btn-ghost" onClick={addArea}>＋ Area of Management</button>
    </div>
  )
}
