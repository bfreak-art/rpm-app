import { createClient, SupabaseClient, Session } from '@supabase/supabase-js'
import type { Base, Kind } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const syncEnabled = !!supabase

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function signInMagicLink(email: string) {
  if (!supabase) throw new Error('Sync is not configured')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin }
  })
  if (error) throw error
}

export async function signOut() {
  await supabase?.auth.signOut()
}

/**
 * All entities live in one table:
 *   entities(id uuid pk, user_id uuid, kind text, data jsonb, updated_at bigint, deleted boolean)
 * Row-level security restricts rows to their owner. Sync is generic last-write-wins.
 */

export async function pushEntities(records: { kind: Kind; row: Base }[]) {
  if (!supabase) return
  const session = await getSession()
  if (!session) return
  const payload = records.map(({ kind, row }) => ({
    id: row.id,
    user_id: session.user.id,
    kind,
    data: row,
    updated_at: row.updatedAt,
    deleted: !!row.deleted
  }))
  // chunk to stay under payload limits
  for (let i = 0; i < payload.length; i += 200) {
    const { error } = await supabase.from('entities').upsert(payload.slice(i, i + 200))
    if (error) throw error
  }
}

export async function pullEntities(since: number): Promise<{ kind: Kind; row: Base }[]> {
  if (!supabase) return []
  const session = await getSession()
  if (!session) return []
  const out: { kind: Kind; row: Base }[] = []
  let from = 0
  const page = 1000
  for (;;) {
    const { data, error } = await supabase
      .from('entities')
      .select('kind,data,updated_at')
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .range(from, from + page - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data) out.push({ kind: r.kind as Kind, row: r.data as Base })
    if (data.length < page) break
    from += page
  }
  return out
}
