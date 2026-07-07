# RPM — Rapid Planning

A results-focused, purpose-driven productivity PWA built on Tony Robbins'
Time of Your Life / RPM method.

**One data model, three levels:** an RPM Block (Result · Purpose · Massive
Action Plan) is the same entity whether it lives in a day, a week, or as a
Project Key Result — mirroring the method's 5 Levels of Management
(Area → Category → Project → Block → Action).

## The method, encoded
- 5 Master Steps: Capture → Create Plan → Commit Block Time / Resolve Musts → Schedule → Complete·Measure·Celebrate
- Two-lane Capture (Ideas vs. Communications), zero-friction rapid entry, voice where supported (`C` opens capture)
- Action marking key: ✘ done · ✔ in progress · ¡ leveraged · ➜ carried over · ■ didn't need it (the 80/20 win)
- Priority / Must / Duration / Leverage per action; Total Time & Total Must Time per Block
- Bumped Block Time never disappears — it demands rescheduling
- Weekly Planning wizard (Connect → Focus each Category → 3-to-Thrive → Set up to win)
- Magnificent 7 per Category, Wheel of Life, Pathways to Power (reuse completed plans)
- Zone-of-Fulfillment bullseye, category balance radar, streaks, levels, badges
- Guided onboarding that teaches RPM by doing (replayable from Settings)

## Stack
Vite · React · TypeScript · Tailwind · Zustand (+ IndexedDB) · Supabase (optional sync/auth) · Google Calendar (optional) · vite-plugin-pwa · Recharts

## Run
```bash
npm install && npm run dev
```
See **DEPLOY.md** for hosting, sync, and Google Calendar setup.
