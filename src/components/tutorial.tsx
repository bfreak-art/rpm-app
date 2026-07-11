import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, live } from '../store/store'
import type { DB } from '../lib/types'

/**
 * Interactive walkthrough. Each step can:
 *  - navigate to a route
 *  - spotlight an element marked with data-tour="..."
 *  - wait for a REAL user action before unlocking "Next" (advanceWhen)
 * The dim layer never blocks clicks, so everything stays usable during the tour.
 * Replayable anytime from Settings → "Start interactive tutorial".
 */

interface Step {
  route?: string
  target?: string
  title: string
  body: string
  action?: string // "Try it now" instruction
  baseline?: (db: DB) => number
  advanceWhen?: (db: DB, baseline: number) => boolean
}

const STEPS: Step[] = [
  {
    title: 'Welcome — RPM in one minute',
    body: `Most planners ask "what do I need to DO today?" and bury you in tasks. RPM flips it: first WHAT RESULT do I want, then WHY does it matter, and only then WHAT ACTIONS might get me there.

Why this order? A result gives your brain a target. A purpose gives it fuel. Actions without those are just a guilt list.

This tour makes you actually use each part — nothing here is fake, everything you create is real and kept.`
  },
  {
    route: '/',
    target: 'capture',
    title: '1 · Capture — empty your head',
    body: `Your brain is for having ideas, not storing them. Every open loop ("email Anna", "fix the deck", "buy a lamp") quietly drains focus.

Capture is a dump, NOT a plan. No organizing, no judging — speed is the whole point. Each item you add appears instantly in the list with a counter, so you always see it landed.`,
    action: 'Click the Capture button and add 2–3 real things on your mind right now. Then close it.',
    baseline: db => live(db.captures).length,
    advanceWhen: (db, b) => live(db.captures).length >= b + 1
  },
  {
    route: '/inbox',
    target: 'inbox-list',
    title: '2 · The Inbox — your unsorted pile',
    body: `Everything you capture waits here. Two lanes exist: "Ideas · Wants · Needs" and "Communications" (calls, emails, follow-ups) — because those are processed differently.

Nothing is lost and nothing nags you. It sits here until you consciously decide what it's FOR.`
  },
  {
    route: '/inbox',
    target: 'chunk-targets',
    title: '3 · Chunking — turn more into less',
    body: `Here's the magic move. Look at your items and ask: which of these serve the SAME outcome? Tap them to select, then tap a Block on this side — or "New Block" to create one.

Why chunk? Ten scattered tasks feel overwhelming; the same ten grouped under 3 results feel doable. Watch the action counter on each Block tick up when you drop items in — that's your proof they arrived.

Important: your selected items BECOME the Block's action plan. They move, they don't duplicate.`,
    action: 'Select at least one item and assign it to a Block (or create a New Block with it).',
    baseline: db => live(db.captures).filter(c => c.status === 'chunked').length,
    advanceWhen: (db, b) => live(db.captures).filter(c => c.status === 'chunked').length >= b + 1
  },
  {
    title: 'The 3 Questions — always in this order',
    body: `When you created a Block you were asked, in order:

1 · RESULT — "What do I really want?" Specific and measurable. Not "work on thesis" but "Chapter 2 draft sent to supervisor".
2 · PURPOSE — "Why is it a must?" Written in words that move you. This is the fuel — on a low-energy day, the purpose is what gets you to sit down.
3 · MAP — the Massive Action Plan. A MENU of possible actions, not a checklist. You'll rarely do all of them, and that's the design: 20% of the actions usually deliver 80% of the result.`
  },
  {
    route: '/',
    target: 'today-blocks',
    title: '4 · Anatomy of a Block',
    body: `Each card is one Result. The colored ring fills as actions complete — a glance tells you where you stand. The * marks a MUST (non-negotiable today).

Click the checkbox next to any action to open the marking key: ✘ done, ✔ in progress, ¡ leveraged (delegated), ➜ carry over, ■ didn't need to be done. That last one is a WIN, not a failure — crossing out unnecessary work is the 80/20 rule in action.

The "Total / Must" line at the bottom keeps you honest about how much time your plan really asks for. Use the ⋯ next to an action to set its minutes.`
  },
  {
    route: '/',
    target: 'today-blocks',
    title: '5 · Commit Block Time',
    body: `A Result without scheduled time is a wish. "◷ Commit Block Time" puts a concrete slot on your day: "90 minutes on THIS result."

Why blocks of time instead of scheduling each tiny task? Because you protect a focused window and then work the menu inside it — far less friction than 12 micro-appointments.

And the golden rule: if life bumps a slot, it MOVES — it never silently disappears. The app will hold it in a "needs rescheduling" queue until you deal with it.`
  },
  {
    route: '/week',
    target: 'weekly-planning',
    title: '6 · The Weekly Plan — the cornerstone',
    body: `This screen groups the week's Blocks BY LIFE CATEGORY, not by date. Why? Because calendars hide neglect — a week can look "full" while your health or relationships got zero minutes. Here, an empty category stares back at you.

The ▶ Weekly Planning button runs a guided 4-step session (aim for 45–60 min, same time weekly): reconnect to your vision → ask "what needs to happen?" in EACH category → create Blocks → pick your 3-to-Thrive musts and schedule them.

One weekly hour of planning routinely saves several hours of drift.`
  },
  {
    route: '/life',
    target: 'lifeplan',
    title: '7 · Life Plan — the top of the pyramid',
    body: `Two Areas (Personal / Professional) hold your Categories — the 5–8 parts of life you commit to constantly improve. Everything below (Projects, Blocks, actions) hangs off these.

Give categories juicy nicknames ("Wealth Wizard" beats "Finances") — you spend time where you're excited to go. Each category holds a Magnificent 7: Vision, Purpose, Roles, 3-to-Thrive, Resources, 1-Year and 90-Day Results.

Try the "Wheel" slider on a category — rate how fulfilled you feel there (0–100%). You'll see why on the Progress screen.`
  },
  {
    route: '/projects',
    target: 'projects',
    title: '8 · Projects — dreams with structure',
    body: `When something needs MULTIPLE results (launch the app, finish the dissertation), it's a Project: an Ultimate Result, an Ultimate Purpose, and Key Results — each of which is a full Block.

When you complete a Project you'll celebrate it (what worked? what to improve?) and it becomes a Pathway to Power: a proven recipe you can clone next time instead of planning from scratch. Find those in History → "⇉ Reuse".`
  },
  {
    route: '/progress',
    target: 'bullseye',
    title: '9 · Progress — you can\'t manage what you don\'t measure',
    body: `The bullseye is your Time Target: the share of time in committed Block Time — important-but-not-urgent work, "the Zone". Target band: 40–70%. Below it you're reacting to life; forcing 100% is delusion.

The radar chart compares how you RATE each category (Wheel) with where your time ACTUALLY went — stated importance vs. real attention. Gaps there are the most honest feedback you'll get.

Streaks, XP and badges reward the method itself: capturing daily, planning weekly, completing musts — even marking actions "not needed".`
  },
  {
    route: '/',
    target: 'evening-review',
    title: '10 · Complete · Measure · Celebrate',
    body: `Each evening: mark your actions, carry leftovers forward (they flow to tomorrow's Inbox automatically — never retype), then answer three prompts: What did I achieve? What were the magic moments? What do I acknowledge myself for?

Why celebrate on purpose? If achievement never feels like anything, your brain stops chasing it. Two minutes of noticing wins is what makes the whole system sustainable.`
  },
  {
    title: 'You\'re ready',
    body: `The daily loop: Capture all day (press C) → chunk when convenient → work your scheduled Blocks → 2-minute evening review. Weekly: one planning session.

Three practical tips:
· Undo/redo (↶ ↷ buttons, or Ctrl+Z / Ctrl+Y) protects every move — experiment freely.
· This tutorial lives in Settings → "Start interactive tutorial" whenever you want a refresher.
· Spot a bug or an idea? Settings → Feedback — jot it instantly so it's ready to share later.`
  }
]

export default function Tutorial() {
  const tourStep = useStore(s => s.tourStep)
  const db = useStore(s => s.db)
  const { setTourStep, endTour } = useStore.getState()
  const navigate = useNavigate()
  const [rect, setRect] = useState<DOMRect | null>(null)
  const baselineRef = useRef<number>(0)
  const stepRef = useRef<number>(-1)

  const step = tourStep !== null ? STEPS[tourStep] : null

  // navigate + capture baseline when step changes
  useEffect(() => {
    if (tourStep === null || !step) return
    if (stepRef.current !== tourStep) {
      stepRef.current = tourStep
      if (step.route) navigate(step.route)
      baselineRef.current = step.baseline ? step.baseline(useStore.getState().db) : 0
    }
  }, [tourStep]) // eslint-disable-line react-hooks/exhaustive-deps

  // measure target continuously (layout shifts, route transitions)
  useEffect(() => {
    if (tourStep === null || !step) return
    let raf = 0
    const measure = () => {
      const el = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null
      if (el) {
        const r = el.getBoundingClientRect()
        if (r.width > 0) {
          if (r.top < 70 || r.bottom > window.innerHeight - 180) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
          setRect(r)
        } else setRect(null)
      } else setRect(null)
      raf = window.setTimeout(measure, 250) as unknown as number
    }
    measure()
    return () => clearTimeout(raf)
  }, [tourStep]) // eslint-disable-line react-hooks/exhaustive-deps

  if (tourStep === null || !step) return null

  const waiting = step.advanceWhen && !step.advanceWhen(db, baselineRef.current)
  const last = tourStep === STEPS.length - 1

  // tooltip placement: below target if room, else above, else centered
  const pad = 10
  let cardStyle: React.CSSProperties
  if (rect) {
    const below = rect.bottom + pad
    const spaceBelow = window.innerHeight - rect.bottom
    cardStyle = spaceBelow > 260
      ? { top: below, left: Math.min(Math.max(12, rect.left), window.innerWidth - 372) }
      : { bottom: window.innerHeight - rect.top + pad, left: Math.min(Math.max(12, rect.left), window.innerWidth - 372) }
  } else {
    cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
  }

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      {/* spotlight: the shadow dims everything else; clicks pass through */}
      {rect ? (
        <div
          className="absolute rounded-xl transition-all duration-300"
          style={{
            top: rect.top - 6, left: rect.left - 6,
            width: rect.width + 12, height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(16,30,51,.62), 0 0 0 3px #E8563F',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-ink/60" />
      )}

      {/* coach card */}
      <div
        className="absolute pointer-events-auto card p-4 w-[min(92vw,360px)] max-h-[60vh] overflow-y-auto"
        style={cardStyle}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1">
          Tutorial · {tourStep + 1} / {STEPS.length}
        </p>
        <h3 className="h-display text-xl leading-tight mb-1.5">{step.title}</h3>
        <p className="text-[13px] leading-relaxed whitespace-pre-line">{step.body}</p>

        {step.action && (
          <div className={`mt-2.5 rounded-lg px-3 py-2 text-[13px] font-medium ${waiting ? 'bg-signal-soft text-signal dark:bg-signal/20 animate-pulse' : 'bg-zone-soft text-zone dark:bg-zone/20'}`}>
            {waiting ? `👉 ${step.action}` : '✓ Done — nice. Continue below.'}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <button className="btn-ghost text-xs" onClick={endTour}>Exit tour</button>
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === tourStep ? 'bg-signal' : i < tourStep ? 'bg-ink/40 dark:bg-white/40' : 'bg-black/15 dark:bg-white/20'}`} />
            ))}
          </div>
          <div className="flex gap-1.5">
            {tourStep > 0 && <button className="btn-ghost text-xs" onClick={() => setTourStep(tourStep - 1)}>Back</button>}
            {last
              ? <button className="btn-signal text-xs" onClick={endTour}>Finish ✦</button>
              : <button className="btn-primary text-xs" disabled={!!waiting}
                  onClick={() => setTourStep(tourStep + 1)}>
                  {waiting ? 'Waiting…' : 'Next'}
                </button>}
          </div>
        </div>
      </div>
    </div>
  )
}
