/**
 * Google Calendar sync (one-way push with pull-back of moved times).
 * Uses Google Identity Services token flow — no backend needed.
 * Requires VITE_GOOGLE_CLIENT_ID (OAuth Client ID, type "Web application",
 * with your deployed origin listed under Authorized JavaScript origins).
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export const gcalAvailable = !!CLIENT_ID

let accessToken: string | null = null
let tokenExpiry = 0
let gsiLoaded = false

function loadGsi(): Promise<void> {
  if (gsiLoaded) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload = () => { gsiLoaded = true; resolve() }
    s.onerror = () => reject(new Error('Could not load Google sign-in'))
    document.head.appendChild(s)
  })
}

export async function connectGcal(interactive = true): Promise<boolean> {
  if (!CLIENT_ID) return false
  await loadGsi()
  return new Promise((resolve) => {
    // @ts-expect-error injected by GSI script
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      prompt: interactive ? 'consent' : '',
      callback: (resp: { access_token?: string; expires_in?: number }) => {
        if (resp.access_token) {
          accessToken = resp.access_token
          tokenExpiry = Date.now() + ((resp.expires_in ?? 3600) - 60) * 1000
          resolve(true)
        } else resolve(false)
      },
      error_callback: () => resolve(false)
    })
    client.requestAccessToken()
  })
}

async function token(): Promise<string | null> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken
  const ok = await connectGcal(false).catch(() => false)
  return ok ? accessToken : null
}

async function api(path: string, init?: RequestInit): Promise<any | null> {
  const t = await token()
  if (!t) return null
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Google Calendar: ${res.status}`)
  return res.status === 204 ? {} : res.json()
}

export interface GcalEventInput {
  summary: string
  description?: string
  start: number
  end: number
}

export async function createEvent(e: GcalEventInput): Promise<string | null> {
  const body = {
    summary: e.summary,
    description: e.description,
    start: { dateTime: new Date(e.start).toISOString() },
    end: { dateTime: new Date(e.end).toISOString() },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] }
  }
  const r = await api('events', { method: 'POST', body: JSON.stringify(body) })
  return r?.id ?? null
}

export async function updateEvent(id: string, e: GcalEventInput): Promise<void> {
  await api(`events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      summary: e.summary,
      description: e.description,
      start: { dateTime: new Date(e.start).toISOString() },
      end: { dateTime: new Date(e.end).toISOString() }
    })
  })
}

export async function deleteEvent(id: string): Promise<void> {
  await api(`events/${id}`, { method: 'DELETE' }).catch(() => {})
}

/** Pull back current times of an event (detects moves made inside Google Calendar). */
export async function fetchEvent(id: string): Promise<{ start: number; end: number; cancelled: boolean } | null> {
  const r = await api(`events/${id}`)
  if (!r) return null
  if (r.status === 'cancelled') return { start: 0, end: 0, cancelled: true }
  return {
    start: new Date(r.start?.dateTime ?? r.start?.date).getTime(),
    end: new Date(r.end?.dateTime ?? r.end?.date).getTime(),
    cancelled: false
  }
}
