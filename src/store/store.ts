import { create } from 'zustand'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import {
  DB, Kind, KIND_TO_KEY, Base, Settings, Area, Category, Project, Block, Action,
  CaptureItem, Slot, Review, BadgeAward, ID, ActionStatus, emptyM7
} from '../lib/types'
import { uid, now, dayKey, weekKey, XP, DEFAULT_CATEGORY_COLORS, DEFAULT_PERSONAL, DEFAULT_PROFESSIONAL, BADGES } from '../lib/utils'
import { pushEntities, pullEntities, syncEnabled } from '../lib/sync'
import { createEvent, updateEvent, deleteEvent } from '../lib/gcal'

const emptyDB = (): DB => ({
  areas: {}, categories: {}, projects: {}, blocks: {}, actions: {},
  captures: {}, slots: {}, reviews: {}, badges: {}
})

const defaultSettings = (): Settings => ({
  theme: 'light', rituals: true, onboarded: false, xp: 0,
  weeklyPlanDay: 0, gcalConnected: false, lastSyncAt: 0
})

interface StoreState {
  db: DB
  settings: Settings
  dirty: Record<string, Kind> // id -> kind
  loaded: boolean
  syncing: boolean
  toast: string | null

  load: () => Promise<void>
  persist: () => void
  syncNow: () => Promise<void>
  setToast: (t: string | null) => void
  setSettings: (patch: Partial<Settings>) => void
  addXp: (n: number, reason?: string) => void
  award: (badgeId: string) => void

  upsert: <T extends Base>(kind: Kind, row: T) => T
  softDelete: (kind: Kind, id: ID) => void

  // domain operations
  seedDefaults: () => void
  addCapture: (text: string, lane: 'idea' | 'comm') => void
  chunkCapture: (captureId: ID, blockId: ID) => void
  dismissCapture: (captureId: ID) => void
  createBlock: (b: Partial<Block> & { result: string; purpose: string }) => Block
  addAction: (blockId: ID, text: string, extra?: Partial<Action>) => Action
  setActionStatus: (id: ID, status: ActionStatus) => void
  completeBlock: (id: ID) => void
  scheduleBlock: (blockId: ID, start: number, end: number) => Promise<Slot>
  moveSlot: (slotId: ID, start: number, end: number) => Promise<void>
  completeSlot: (slotId: ID) => void
  deleteSlot: (slotId: ID) => Promise<void>
  markBumpedSlots: () => void
  carryForward: (actionId: ID, toPeriod: 'day' | 'week') => void
  saveReview: (r: Partial<Review> & { type: 'daily' | 'weekly'; date: string }) => void
  completeProject: (id: ID, wins: string, improvements: string) => void
  cloneAsPathway: (kind: 'block' | 'project', id: ID, periodDate: string) => void
  rateWheel: (categoryId: ID, pct: number) => void
  checkM7Complete: (categoryId: ID) => void
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

export const useStore = create<StoreState>((set, get) => ({
  db: emptyDB(),
  settings: defaultSettings(),
  dirty: {},
  loaded: false,
  syncing: false,
  toast: null,

  load: async () => {
    const db = (await idbGet<DB>('rpm-db')) ?? emptyDB()
    const settings = { ...defaultSettings(), ...((await idbGet<Settings>('rpm-settings')) ?? {}) }
    const dirty = (await idbGet<Record<string, Kind>>('rpm-dirty')) ?? {}
    set({ db, settings, dirty, loaded: true })
    get().markBumpedSlots()
    if (syncEnabled) get().syncNow().catch(() => {})
  },

  persist: () => {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      const { db, settings, dirty } = get()
      idbSet('rpm-db', db)
      idbSet('rpm-settings', settings)
      idbSet('rpm-dirty', dirty)
    }, 250)
  },

  syncNow: async () => {
    if (!syncEnabled || get().syncing) return
    set({ syncing: true })
    try {
      const { db, dirty, settings } = get()
      // push dirty
      const records = Object.entries(dirty).map(([id, kind]) => {
        const row = (db[KIND_TO_KEY[kind]] as Record<string, Base>)[id]
        return row ? { kind, row } : null
      }).filter(Boolean) as { kind: Kind; row: Base }[]
      if (records.length) await pushEntities(records)
      // pull newer
      const pulled = await pullEntities(settings.lastSyncAt)
      if (pulled.length) {
        set(s => {
          const db2 = { ...s.db }
          for (const { kind, row } of pulled) {
            const key = KIND_TO_KEY[kind]
            const bucket = { ...(db2[key] as Record<string, Base>) }
            const local = bucket[row.id]
            if (!local || row.updatedAt > local.updatedAt) bucket[row.id] = row
            ;(db2 as any)[key] = bucket
          }
          return { db: db2 }
        })
      }
      set(s => ({ dirty: {}, settings: { ...s.settings, lastSyncAt: now() } }))
      get().persist()
    } finally {
      set({ syncing: false })
    }
  },

  setToast: t => {
    set({ toast: t })
    if (t) setTimeout(() => set(s => (s.toast === t ? { toast: null } : {})), 2600)
  },

  setSettings: patch => { set(s => ({ settings: { ...s.settings, ...patch } })); get().persist() },

  addXp: (n, reason) => {
    set(s => ({ settings: { ...s.settings, xp: s.settings.xp + n } }))
    if (reason) get().setToast(`+${n} XP · ${reason}`)
    get().persist()
  },

  award: badgeId => {
    const { db } = get()
    if (Object.values(db.badges).some(b => !b.deleted && b.badgeId === badgeId)) return
    const def = BADGES.find(b => b.id === badgeId)
    get().upsert<BadgeAward>('badge', { id: uid(), updatedAt: now(), badgeId, earnedAt: now() })
    if (def) get().setToast(`${def.icon} Badge earned — ${def.name}`)
  },

  upsert: (kind, row) => {
    row.updatedAt = now()
    set(s => {
      const key = KIND_TO_KEY[kind]
      return {
        db: { ...s.db, [key]: { ...(s.db[key] as any), [row.id]: row } },
        dirty: { ...s.dirty, [row.id]: kind }
      }
    })
    get().persist()
    if (syncEnabled) queueMicrotask(() => get().syncNow().catch(() => {}))
    return row
  },

  softDelete: (kind, id) => {
    const key = KIND_TO_KEY[kind]
    const row = (get().db[key] as Record<string, Base>)[id]
    if (row) get().upsert(kind, { ...row, deleted: true })
  },

  seedDefaults: () => {
    const { db } = get()
    if (Object.values(db.areas).some(a => !a.deleted)) return
    const t = now()
    const personal: Area = { id: uid(), updatedAt: t, name: 'Personal', sort: 0 }
    const professional: Area = { id: uid(), updatedAt: t, name: 'Professional', sort: 1 }
    get().upsert('area', personal)
    get().upsert('area', professional)
    const mk = (areaId: ID, names: string[], offset: number) =>
      names.forEach((name, i) =>
        get().upsert<Category>('category', {
          id: uid(), updatedAt: now(), areaId, name, color: DEFAULT_CATEGORY_COLORS[(i + offset) % DEFAULT_CATEGORY_COLORS.length],
          roles: [], sort: i, m7: emptyM7(), wheel: []
        }))
    mk(personal.id, DEFAULT_PERSONAL, 0)
    mk(professional.id, DEFAULT_PROFESSIONAL, 3)
  },

  addCapture: (text, lane) => {
    const { db } = get()
    const today = dayKey()
    const firstToday = !Object.values(db.captures).some(c => !c.deleted && dayKey(new Date(c.createdAt)) === today)
    get().upsert<CaptureItem>('capture', {
      id: uid(), updatedAt: now(), text: text.trim(), lane, createdAt: now(), status: 'unsorted'
    })
    if (firstToday) get().addXp(XP.captureFirstOfDay, 'Capture streak')
  },

  chunkCapture: (captureId, blockId) => {
    const c = get().db.captures[captureId]
    if (!c) return
    get().upsert<CaptureItem>('capture', { ...c, status: 'chunked', blockId })
    get().addAction(blockId, c.text)
  },

  dismissCapture: captureId => {
    const c = get().db.captures[captureId]
    if (c) get().upsert<CaptureItem>('capture', { ...c, status: 'dismissed' })
  },

  createBlock: b => {
    const block: Block = {
      id: uid(), updatedAt: now(),
      result: b.result, purpose: b.purpose,
      categoryId: b.categoryId, projectId: b.projectId,
      scope: b.scope ?? 'daily',
      periodDate: b.periodDate ?? (b.scope === 'weekly' ? weekKey() : b.scope === 'project' ? '' : dayKey()),
      isMust: b.isMust, status: 'planned', sourcePathwayId: b.sourcePathwayId
    }
    get().upsert('block', block)
    const anyOther = Object.values(get().db.blocks).filter(x => !x.deleted).length
    if (anyOther === 1) get().award('first-block')
    return block
  },

  addAction: (blockId, text, extra) => {
    const priorities = Object.values(get().db.actions)
      .filter(a => !a.deleted && a.blockId === blockId)
      .map(a => a.priority)
    const action: Action = {
      id: uid(), updatedAt: now(), blockId, text: text.trim(),
      priority: (priorities.length ? Math.max(...priorities) : 0) + 1,
      status: 'pending', ...extra
    }
    return get().upsert('action', action)
  },

  setActionStatus: (id, status) => {
    const a = get().db.actions[id]
    if (!a) return
    const prev = a.status
    get().upsert<Action>('action', { ...a, status })
    if (status === 'done' && prev !== 'done') {
      get().addXp(a.isMust ? XP.mustDone : XP.actionDone, a.isMust ? 'Must complete' : undefined)
    }
  },

  completeBlock: id => {
    const b = get().db.blocks[id]
    if (!b || b.status === 'completed') return
    get().upsert<Block>('block', { ...b, status: 'completed' })
    if (b.purpose.trim()) get().addXp(XP.blockCompleted, 'Block complete')
    const acts = Object.values(get().db.actions).filter(a => !a.deleted && a.blockId === id)
    if (acts.some(a => a.status === 'notNeeded')) {
      get().addXp(XP.notNeededOnCompleted, '80/20 — less was enough')
      get().award('eighty-twenty')
    }
  },

  scheduleBlock: async (blockId, start, end) => {
    const slot: Slot = { id: uid(), updatedAt: now(), blockId, start, end, status: 'planned' }
    const b = get().db.blocks[blockId]
    if (get().settings.gcalConnected && b) {
      try {
        const evId = await createEvent({
          summary: `◎ ${b.result}`,
          description: b.purpose ? `Purpose: ${b.purpose}\n(RPM Block Time)` : '(RPM Block Time)',
          start, end
        })
        if (evId) slot.gcalEventId = evId
      } catch { get().setToast('Could not reach Google Calendar — scheduled locally') }
    }
    get().upsert('slot', slot)
    return slot
  },

  moveSlot: async (slotId, start, end) => {
    const s = get().db.slots[slotId]
    if (!s) return
    const b = get().db.blocks[s.blockId]
    get().upsert<Slot>('slot', { ...s, start, end, status: 'planned' })
    if (s.gcalEventId && b && get().settings.gcalConnected) {
      updateEvent(s.gcalEventId, { summary: `◎ ${b.result}`, start, end }).catch(() => {})
    }
  },

  completeSlot: slotId => {
    const s = get().db.slots[slotId]
    if (s) get().upsert<Slot>('slot', { ...s, status: 'completed' })
  },

  deleteSlot: async slotId => {
    const s = get().db.slots[slotId]
    if (!s) return
    if (s.gcalEventId && get().settings.gcalConnected) deleteEvent(s.gcalEventId).catch(() => {})
    get().softDelete('slot', slotId)
  },

  /** Block Time can move but never disappears: past, incomplete slots become "bumped" and demand rescheduling. */
  markBumpedSlots: () => {
    const t = now()
    for (const s of Object.values(get().db.slots)) {
      if (!s.deleted && s.status === 'planned' && s.end < t) {
        get().upsert<Slot>('slot', { ...s, status: 'bumped' })
      }
    }
  },

  carryForward: (actionId, toPeriod) => {
    const a = get().db.actions[actionId]
    if (!a) return
    get().upsert<Action>('action', { ...a, status: 'carriedOver' })
    get().upsert<CaptureItem>('capture', {
      id: uid(), updatedAt: now(), text: a.text, lane: 'idea', createdAt: now(),
      status: 'unsorted'
    })
    get().setToast(`➜ Carried to next ${toPeriod}'s Capture`)
  },

  saveReview: r => {
    const existing = Object.values(get().db.reviews)
      .find(x => !x.deleted && x.type === r.type && x.date === r.date)
    const isNew = !existing
    const review: Review = {
      id: existing?.id ?? uid(), updatedAt: now(),
      type: r.type, date: r.date,
      achievements: r.achievements ?? existing?.achievements ?? '',
      magicMoments: r.magicMoments ?? existing?.magicMoments ?? '',
      whatDidntHappen: r.whatDidntHappen ?? existing?.whatDidntHappen ?? '',
      acknowledgment: r.acknowledgment ?? existing?.acknowledgment ?? '',
      morning: r.morning ?? existing?.morning,
      evening: r.evening ?? existing?.evening,
      gratitude: r.gratitude ?? existing?.gratitude,
      hydrated: r.hydrated ?? existing?.hydrated,
      moved: r.moved ?? existing?.moved
    }
    get().upsert('review', review)
    if (isNew && r.type === 'daily' && (review.achievements || review.magicMoments || review.acknowledgment)) {
      get().addXp(XP.dailyReview, 'Complete · Measure · Celebrate')
    }
    // Celebrant badge: 10 consecutive daily reviews with a magic moment
    const dailies = Object.values(get().db.reviews)
      .filter(x => !x.deleted && x.type === 'daily' && x.magicMoments.trim())
      .map(x => x.date).sort()
    let streak = 1
    for (let i = dailies.length - 1; i > 0; i--) {
      const diff = (new Date(dailies[i]).getTime() - new Date(dailies[i - 1]).getTime()) / 86400000
      if (diff === 1) streak++
      else break
    }
    if (streak >= 10) get().award('celebrant-10')
  },

  completeProject: (id, wins, improvements) => {
    const p = get().db.projects[id]
    if (!p) return
    get().upsert<Project>('project', {
      ...p, status: 'completed', celebration: { wins, improvements }, isPathway: true
    })
    get().addXp(XP.projectComplete, 'Project complete')
    get().award('first-project')
  },

  cloneAsPathway: (kind, id, periodDate) => {
    const { db } = get()
    if (kind === 'block') {
      const src = db.blocks[id]
      if (!src) return
      const nb = get().createBlock({
        result: src.result, purpose: src.purpose, categoryId: src.categoryId,
        scope: 'weekly', periodDate, sourcePathwayId: src.id
      })
      Object.values(db.actions)
        .filter(a => !a.deleted && a.blockId === id)
        .sort((a, b) => a.priority - b.priority)
        .forEach(a => get().addAction(nb.id, a.text, { isMust: a.isMust, durationMin: a.durationMin, leverageTo: a.leverageTo }))
    } else {
      const src = db.projects[id]
      if (!src) return
      const np: Project = {
        id: uid(), updatedAt: now(), categoryId: src.categoryId,
        ultimateResult: src.ultimateResult, ultimatePurpose: src.ultimatePurpose,
        status: 'active', sourcePathwayId: src.id
      }
      get().upsert('project', np)
      for (const kb of Object.values(db.blocks).filter(b => !b.deleted && b.projectId === id)) {
        const nb = get().createBlock({
          result: kb.result, purpose: kb.purpose, categoryId: kb.categoryId,
          projectId: np.id, scope: 'project', periodDate: '', sourcePathwayId: kb.id
        })
        Object.values(db.actions)
          .filter(a => !a.deleted && a.blockId === kb.id)
          .sort((a, b) => a.priority - b.priority)
          .forEach(a => get().addAction(nb.id, a.text, { isMust: a.isMust, durationMin: a.durationMin, leverageTo: a.leverageTo }))
      }
    }
    get().award('pathway-used')
    get().setToast('⇉ Pathway to Power created')
  },

  rateWheel: (categoryId, pct) => {
    const c = get().db.categories[categoryId]
    if (!c) return
    const today = dayKey()
    const wheel = [...c.wheel.filter(w => w.date !== today), { date: today, pct }]
    get().upsert<Category>('category', { ...c, wheel })
    get().addXp(XP.wheelRated)
    const active = Object.values(get().db.categories).filter(x => !x.deleted && !x.archived)
    if (active.every(x => x.wheel.length > 0)) get().award('wheel-rated')
  },

  checkM7Complete: categoryId => {
    const c = get().db.categories[categoryId]
    if (!c) return
    const m = c.m7
    const full = [m.vision, m.purpose, m.roles, m.resources, m.oneYear, m.ninetyDay, ...m.threeToThrive]
      .every(x => x.trim().length > 0)
    if (full) {
      get().addXp(XP.m7Complete, 'Magnificent 7 complete')
      get().award('m7-complete')
    }
  }
}))

/* ---------- selectors ---------- */

export const live = <T extends Base>(rec: Record<string, T>): T[] =>
  Object.values(rec).filter(r => !r.deleted)

export function blockActions(db: DB, blockId: ID): Action[] {
  return live(db.actions).filter(a => a.blockId === blockId).sort((a, b) => a.priority - b.priority)
}

export function blockTotals(db: DB, blockId: ID) {
  const acts = blockActions(db, blockId)
  const total = acts.reduce((s, a) => s + (a.durationMin ?? 0), 0)
  const must = acts.filter(a => a.isMust).reduce((s, a) => s + (a.durationMin ?? 0), 0)
  const done = acts.filter(a => a.status === 'done' || a.status === 'notNeeded' || a.status === 'leveraged').length
  return { total, must, done, count: acts.length }
}

export function streaks(db: DB) {
  const daysWith = (dates: string[]) => {
    const set = new Set(dates)
    let n = 0
    const d = new Date()
    // allow today to be pending
    if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1)
    while (set.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1) }
    return n
  }
  const captureDays = live(db.captures).map(c => dayKey(new Date(c.createdAt)))
  const reviewDays = live(db.reviews).filter(r => r.type === 'daily').map(r => r.date)

  const weeklyDates = live(db.reviews).filter(r => r.type === 'weekly').map(r => r.date).sort()
  let planStreak = weeklyDates.length ? 1 : 0
  for (let i = weeklyDates.length - 1; i > 0; i--) {
    const diff = (new Date(weeklyDates[i]).getTime() - new Date(weeklyDates[i - 1]).getTime()) / 86400000
    if (diff === 7) planStreak++
    else break
  }
  return {
    capture: daysWith(captureDays),
    dailyReview: daysWith(reviewDays),
    weeklyPlanning: planStreak
  }
}
