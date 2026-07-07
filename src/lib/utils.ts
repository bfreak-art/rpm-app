import { format, startOfWeek, addDays, parseISO, isSameDay } from 'date-fns'

export const uid = () => crypto.randomUUID()
export const now = () => Date.now()

export const dayKey = (d: Date = new Date()) => format(d, 'yyyy-MM-dd')
export const weekKey = (d: Date = new Date()) => format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
export const weekDays = (wk: string) => Array.from({ length: 7 }, (_, i) => addDays(parseISO(wk), i))
export const sameDay = (ts: number, key: string) => isSameDay(new Date(ts), parseISO(key))
export const fmtTime = (ts: number) => format(ts, 'HH:mm')
export const fmtDay = (key: string) => format(parseISO(key), 'EEE d MMM')

export function fmtDur(min: number): string {
  if (!min) return '—'
  const h = Math.floor(min / 60), m = min % 60
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

/* ---------- Gamification ---------- */

export const LEVELS = ['Capturer', 'Chunker', 'Block Builder', 'Zone Dweller', 'Pathway Maker', 'RPM Master']

export function levelFor(xp: number) {
  // thresholds: 0, 100, 300, 700, 1500, 3000
  const t = [0, 100, 300, 700, 1500, 3000]
  let i = 0
  for (let k = 0; k < t.length; k++) if (xp >= t[k]) i = k
  const nextAt = t[Math.min(i + 1, t.length - 1)]
  const prevAt = t[i]
  const pct = i === t.length - 1 ? 100 : Math.round(((xp - prevAt) / (nextAt - prevAt)) * 100)
  return { index: i, name: LEVELS[i], nextAt, pct }
}

export const XP = {
  captureFirstOfDay: 5,
  mustDone: 10,
  actionDone: 3,
  notNeededOnCompleted: 5, // the 80/20 reward
  blockCompleted: 25,
  dailyReview: 15,
  weeklyPlan: 40,
  m7Complete: 30,
  projectComplete: 100,
  wheelRated: 10
}

export interface BadgeDef { id: string; name: string; desc: string; icon: string }
export const BADGES: BadgeDef[] = [
  { id: 'first-block', name: 'First Block', desc: 'Created your first RPM Block — Result, Purpose, MAP.', icon: '◎' },
  { id: 'first-project', name: 'Dream → Reality', desc: 'Completed your first Project.', icon: '▲' },
  { id: 'm7-complete', name: 'Unstoppable Momentum', desc: 'Filled out a full Magnificent 7 for a category.', icon: '7' },
  { id: 'wheel-rated', name: 'Wheel of Life', desc: 'Rated every active category on the Wheel.', icon: '◯' },
  { id: 'plan-streak-4', name: 'Cornerstone', desc: '4 weekly planning sessions in a row.', icon: '∎' },
  { id: 'pathway-used', name: 'Pathway to Power', desc: 'Reused a completed plan as a template.', icon: '⇉' },
  { id: 'celebrant-10', name: 'Celebrant', desc: '10 daily reviews in a row with a Magic Moment.', icon: '✦' },
  { id: 'eighty-twenty', name: '80/20 Thinker', desc: 'Completed a Block with actions consciously marked "not needed".', icon: '%' }
]

export const DEFAULT_CATEGORY_COLORS = ['#2E7D6B', '#3B6FB5', '#B5652E', '#7C4DA0', '#C13B5E', '#4C7A2E', '#946200', '#376E7D']

export const DEFAULT_PERSONAL = ['Physical Vitality', 'Emotional Juice', 'Family & Relationship', 'Finances', 'Friends & Fun', 'Growth & Spirit']
export const DEFAULT_PROFESSIONAL = ['Startup Builder', 'Dissertation Finisher', 'Learning & Craft', 'Network & Allies']
