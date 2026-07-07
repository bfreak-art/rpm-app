# Deploying the RPM app

Three levels — each one works on its own; add the next when you want it.

---

## Level 0 · Run it locally (2 minutes)

```bash
npm install
npm run dev        # opens http://localhost:5173
```

Without any configuration the app runs in **local-only mode**: everything works
(capture, blocks, planning, reviews, charts, offline), stored in your browser's
IndexedDB on this device. No login needed.

---

## Level 1 · Deploy as an installable PWA (≈10 minutes, free)

1. Push this folder to a GitHub repository.
2. Go to **vercel.com** → Add New Project → import the repo.
   Vercel auto-detects Vite. Accept the defaults and deploy.
   *(Netlify works identically: build command `npm run build`, publish dir `dist`.)*
3. Add one rewrite so page refreshes work — create `vercel.json` in the repo root
   (already included) — nothing to do if you deploy this folder as-is.
4. Open the deployed URL on your phone:
   - **iPhone:** Safari → Share → *Add to Home Screen*
   - **Android:** Chrome → menu → *Install app*

You now have RPM as an app icon, full-screen, working offline.

---

## Level 2 · Cross-device sync with one login (≈10 minutes, free)

1. Create a free project at **supabase.com**.
2. In the Supabase dashboard: **SQL Editor** → paste the contents of
   `supabase/schema.sql` → Run.
3. **Authentication → URL Configuration**: set *Site URL* to your Vercel URL
   (e.g. `https://rpm-yourname.vercel.app`).
4. **Project Settings → API**: copy the *Project URL* and the *anon public* key.
5. In Vercel: **Project → Settings → Environment Variables**, add
   ```
   VITE_SUPABASE_URL      = https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJ...
   ```
   then **Redeploy**.
6. In the app: **Settings → Account & sync** → enter your email → click the
   link Supabase emails you. Done — you stay signed in on each device, and data
   syncs automatically (offline changes queue and reconcile on reconnect).

Repeat step 6 once per device. That's the only login you'll ever do there.

---

## Level 3 · Google Calendar sync (≈15 minutes, free)

Committed Block Time is pushed to your primary Google calendar as events
("◎ Result name", with a 10-minute popup reminder), and moves/deletes follow.

1. Go to **console.cloud.google.com** → create a project (e.g. "RPM").
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** → External → fill app name +
   your email → add scope `.../auth/calendar.events` → add yourself as a
   *Test user* → save. (Staying in "Testing" mode is fine for personal use;
   the token just re-prompts occasionally.)
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   → type *Web application* → under **Authorized JavaScript origins** add
   your Vercel URL (and `http://localhost:5173` for dev).
5. Copy the Client ID and add it in Vercel:
   ```
   VITE_GOOGLE_CLIENT_ID = 1234-abc.apps.googleusercontent.com
   ```
   Redeploy.
6. In the app: **Settings → Google Calendar → Connect**.

---

## Notes

- **Notifications:** calendar reminders (Level 3) cover "Block Time starting".
  True server push (streak nudges while the app is closed) needs a push
  backend — a clean phase-2 addition via Supabase Edge Functions if you want it later.
- **Backups:** with sync enabled, Supabase's Postgres *is* your backup.
  In local-only mode, data lives in the browser — don't clear site data.
- **Custom domain:** add it in Vercel, then update the Supabase Site URL and
  the Google OAuth origin to match.
