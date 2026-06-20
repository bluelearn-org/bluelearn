import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase, requireUser } from '../middleware/auth.middleware'
import type { Database } from '../database.types'
import type { HonoEnv } from '../types'

// Only the three grant-writable columns are accepted (see profiles migration:
// table-wide update is revoked, leaving username/display_name/bio editable).
const updateProfileSchema = z
  .object({
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, {
      message: 'Username may only contain letters, numbers, hyphens, and underscores',
    }),
    display_name: z.string().max(50).nullable(),
    bio: z.string().max(500).nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'No fields to update' })

const fetchRoles = async (supabase: SupabaseClient<Database>, userId: string) => {
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId)
  return data?.map((r) => r.role) ?? []
}

// Public badges. user_roles RLS hides other users' roles, so this reads with the
// service client (RLS bypass) and excludes admin in code.
const fetchPublicBadges = async (service: SupabaseClient<Database>, userId: string) => {
  const { data } = await service
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .neq('role', 'admin')
  return data?.map((r) => r.role) ?? []
}

// Escape LIKE metacharacters so a username containing `_` is matched literally
// rather than as a wildcard.
const escapeLike = (value: string) => value.replace(/[%_\\]/g, '\\$&')

export const meRouter = new Hono<HonoEnv>()
  // Own user's row + roles
  .get('/', requireUser, async (c) => {
    const supabase = c.get('supabase')
    const user = c.get('user')

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error || !profile) return c.json({ error: 'Profile not found' }, 404)

    const roles = await fetchRoles(supabase, user.id)
    return c.json({ profile, roles })
  })

  // Update the caller's own profile
  .patch('/', requireUser, zValidator('json', updateProfileSchema), async (c) => {
    const supabase = c.get('supabase')
    const user = c.get('user')
    const updates = c.req.valid('json')

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      // unique_violation: username (or its case-insensitive form) is taken.
      if (error.code === '23505') return c.json({ error: 'Username already taken' }, 409)
      return c.json({ error: error.message }, 500)
    }

    const roles = await fetchRoles(supabase, user.id)
    return c.json({ profile, roles })
  })

export const profilesRouter = new Hono<HonoEnv>()
  // Public profile by username + public role badges
  .get('/:username', async (c) => {
    const supabase = c.get('supabase')
    const username = c.req.param('username')

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, bio, created_at')
      .ilike('username', escapeLike(username))
      .eq('is_suspended', false) // suspended members are hidden from the public
      .maybeSingle()

    if (error) return c.json({ error: error.message }, 500)
    if (!profile) return c.json({ error: 'Profile not found' }, 404)

    const roles = await fetchPublicBadges(getServiceSupabase(c), profile.id)

    // Drop the internal id from the public payload.
    const { id: _id, ...publicProfile } = profile
    return c.json({ profile: publicProfile, roles })
  })
