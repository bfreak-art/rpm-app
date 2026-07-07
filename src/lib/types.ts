export type ID = string

export interface Base {
  id: ID
  updatedAt: number
  deleted?: boolean
}

export interface Area extends Base {
  name: string
  sort: number
  archived?: boolean
}

export interface Magnificent7 {
  vision: string
  purpose: string
  roles: string
  threeToThrive: [string, string, string]
  resources: string
  oneYear: string
  ninetyDay: string
}

export interface Category extends Base {
  areaId: ID
  name: string
  juicyName?: string
  color: string
  roles: string[]
  sort: number
  archived?: boolean
  m7: Magnificent7
  wheel: { date: string; pct: number }[]
}

export type ProjectStatus = 'active' | 'completed' | 'abandoned'

export interface Project extends Base {
  categoryId?: ID
  ultimateResult: string
  ultimatePurpose: string
  targetDate?: string
  status: ProjectStatus
  celebration?: { wins: string; improvements: string }
  isPathway?: boolean
  sourcePathwayId?: ID
}

export type BlockScope = 'daily' | 'weekly' | 'project'

export interface Block extends Base {
  result: string
  purpose: string
  categoryId?: ID
  projectId?: ID
  scope: BlockScope
  /** yyyy-MM-dd — the day, or the Monday of the week, this block belongs to. Empty for project scope. */
  periodDate: string
  isMust?: boolean
  status: 'planned' | 'completed'
  sourcePathwayId?: ID
}

/** The workbook's marking key: ✘ done, ✔ in progress, ¡ leveraged, ➜ carried over, ■ didn't need to be done */
export type ActionStatus = 'pending' | 'done' | 'inProgress' | 'leveraged' | 'carriedOver' | 'notNeeded'

export interface Action extends Base {
  blockId: ID
  text: string
  priority: number
  isMust?: boolean
  durationMin?: number
  leverageTo?: string
  status: ActionStatus
  carriedFromId?: ID
}

export interface CaptureItem extends Base {
  text: string
  lane: 'idea' | 'comm'
  createdAt: number
  status: 'unsorted' | 'chunked' | 'dismissed'
  blockId?: ID
  projectId?: ID
}

export interface Slot extends Base {
  blockId: ID
  start: number
  end: number
  status: 'planned' | 'completed' | 'bumped'
  rescheduledTo?: ID
  gcalEventId?: string
}

export interface Review extends Base {
  type: 'daily' | 'weekly'
  /** day date, or Monday of the week */
  date: string
  achievements: string
  magicMoments: string
  whatDidntHappen: string
  acknowledgment: string
  morning?: string
  evening?: string
  gratitude?: string
  hydrated?: boolean
  moved?: boolean
}

export interface BadgeAward extends Base {
  badgeId: string
  earnedAt: number
}

export interface Settings {
  theme: 'light' | 'dark'
  rituals: boolean
  onboarded: boolean
  xp: number
  weeklyPlanDay: number // 0=Sun
  gcalConnected: boolean
  lastSyncAt: number
}

export type Kind =
  | 'area' | 'category' | 'project' | 'block' | 'action'
  | 'capture' | 'slot' | 'review' | 'badge'

export interface DB {
  areas: Record<ID, Area>
  categories: Record<ID, Category>
  projects: Record<ID, Project>
  blocks: Record<ID, Block>
  actions: Record<ID, Action>
  captures: Record<ID, CaptureItem>
  slots: Record<ID, Slot>
  reviews: Record<ID, Review>
  badges: Record<ID, BadgeAward>
}

export const KIND_TO_KEY: Record<Kind, keyof DB> = {
  area: 'areas', category: 'categories', project: 'projects', block: 'blocks',
  action: 'actions', capture: 'captures', slot: 'slots', review: 'reviews', badge: 'badges'
}

export const emptyM7 = (): Magnificent7 => ({
  vision: '', purpose: '', roles: '', threeToThrive: ['', '', ''],
  resources: '', oneYear: '', ninetyDay: ''
})
