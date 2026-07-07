import { useMemo } from 'react'
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts'
import { useStore, live, streaks } from '../store/store'
import { Bullseye, HelpButton } from '../components/ui'
import { levelFor, BADGES, weekKey, fmtDay } from '../lib/utils'
import { startOfWeek, subWeeks, format } from 'date-fns'

const HELP = `You can't manage what you don't measure.

The bullseye is the Time Target: the share of your scheduled hours that went into committed Block Time — important-but-not-urgent work, the Zone of Fulfillment. Target: 40–70%.

The radar compares how you rate each life Category (Wheel of Life) with where your Block Time actually went — stated importance vs. real attention.`

export default function Progress() {
  const db = useStore(s => s.db)
  const settings = useStore(s => s.settings)
  const st = streaks(db)
  const lvl = levelFor(settings.xp)

  // Zone %: completed slot hours this week vs a 40h attention budget (bounded 0-100)
  const zonePct = useMemo(() => {
    const wkStart = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime()
    const mins = live(db.slots)
      .filter(s => s.start >= wkStart && (s.status === 'completed' || s.status === 'planned'))
      .reduce((sum, s) => sum + (s.end - s.start) / 60000, 0)
    return Math.min(100, Math.round((mins / (40 * 60)) * 100))
  }, [db.slots])

  // Radar: wheel rating vs share of block time per category
  const radarData = useMemo(() => {
    const cats = live(db.categories).filter(c => !c.archived)
    const slotMins: Record<string, number> = {}
    let total = 0
    for (const s of live(db.slots)) {
      const b = db.blocks[s.blockId]
      if (!b?.categoryId) continue
      const m = (s.end - s.start) / 60000
      slotMins[b.categoryId] = (slotMins[b.categoryId] ?? 0) + m
      total += m
    }
    return cats.map(c => ({
      name: c.juicyName || c.name,
      wheel: c.wheel.length ? c.wheel[c.wheel.length - 1].pct : 0,
      attention: total ? Math.round(((slotMins[c.id] ?? 0) / total) * 100) : 0
    }))
  }, [db])

  // Blocks completed per week (last 8)
  const weekly = useMemo(() => {
    const out: { week: string; blocks: number; musts: number }[] = []
    for (let i = 7; i >= 0; i--) {
      const wk = weekKey(subWeeks(new Date(), i))
      const done = live(db.blocks).filter(b => b.status === 'completed' && b.updatedAt >= new Date(wk).getTime() && b.updatedAt < new Date(wk).getTime() + 7 * 86400000)
      out.push({
        week: format(new Date(wk), 'd MMM'),
        blocks: done.length,
        musts: done.filter(b => b.isMust).length
      })
    }
    return out
  }, [db.blocks])

  const earned = new Set(live(db.badges).map(b => b.badgeId))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="h-display text-4xl">Progress</h1>
        <HelpButton text={HELP} />
      </div>

      {/* Level bar */}
      <div className="card p-4 mb-4 flex items-center gap-4">
        <div className="h-display text-3xl text-signal">{lvl.name}</div>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div className="h-full bg-signal transition-all" style={{ width: `${lvl.pct}%` }} />
          </div>
          <p className="text-[11px] text-ink-mute mt-1">{settings.xp} XP{lvl.pct < 100 ? ` · next level at ${lvl.nextAt}` : ' · max level'}</p>
        </div>
      </div>

      {/* Streaks */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { n: st.capture, l: 'Capture streak', u: 'days' },
          { n: st.dailyReview, l: 'Review streak', u: 'days' },
          { n: st.weeklyPlanning, l: 'Planning streak', u: 'weeks' }
        ].map(x => (
          <div key={x.l} className="card p-3 text-center">
            <p className="h-display text-4xl">{x.n}</p>
            <p className="text-[11px] text-ink-mute">{x.l} · {x.u}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <div className="card p-4 flex flex-col items-center">
          <p className="label self-start">Time Target — week of {fmtDay(weekKey())}</p>
          <Bullseye zonePct={zonePct} />
        </div>
        <div className="card p-4">
          <p className="label">Wheel of Life vs. real attention</p>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData} outerRadius="75%">
              <PolarGrid />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
              <Radar name="Wheel rating %" dataKey="wheel" stroke="#2E7D6B" fill="#2E7D6B" fillOpacity={0.35} />
              <Radar name="Attention %" dataKey="attention" stroke="#E8563F" fill="#E8563F" fillOpacity={0.25} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <p className="label">Blocks completed per week</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weekly}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24} />
            <Tooltip />
            <Bar dataKey="blocks" name="Blocks" fill="#101E33" radius={[3, 3, 0, 0]} />
            <Bar dataKey="musts" name="Must Results" fill="#E8563F" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-4">
        <p className="label">Badges</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGES.map(b => (
            <div key={b.id} className={`rounded-lg p-3 text-center border ${earned.has(b.id) ? 'border-signal bg-signal-soft dark:bg-signal/15' : 'border-black/10 dark:border-white/10 opacity-45'}`}>
              <p className="text-2xl font-display">{b.icon}</p>
              <p className="text-xs font-semibold mt-0.5">{b.name}</p>
              <p className="text-[10px] text-ink-mute mt-0.5 leading-tight">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
