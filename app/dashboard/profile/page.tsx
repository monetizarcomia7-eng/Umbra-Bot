import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileClient from './ProfileClient'
import type { RawPendingInvite } from './ProfileClient'

// Exported so ProfileClient can import the types
export interface RawProfile {
  name: string
  phone: string
  avatar_url: string
  avatar_color: string
  avatar_initials: string  // added by migration 092
  timezone: string
  language: string
  workspace: string
  two_fa_enabled: boolean
  two_fa_enabled_at: number | string | null  // bigint — may arrive as string from Supabase
  created_at: string
}

export interface RawMember {
  id: string
  name: string
  email: string
  avatar: string
  color: string
  role: string
  status: string
  last_seen: number | string | null  // bigint
  joined_at: number | string         // bigint
  self: boolean
  user_id: string
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, membersRes, mfaRes, pendingInvitesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('name, phone, avatar_url, avatar_color, avatar_initials, timezone, language, workspace, two_fa_enabled, two_fa_enabled_at, created_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('team_members')
      .select('id, name, email, avatar, color, role, status, last_seen, joined_at, self, user_id')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true }),
    supabase.auth.mfa.listFactors(),
    supabase.rpc('get_pending_invites_for_user', { p_email: user.email ?? '' }),
  ])

  const verifiedTotp = mfaRes.data?.totp?.find(f => f.status === 'verified')

  return (
    <ProfileClient
      initialProfile={(profileRes.data ?? null) as RawProfile | null}
      initialMembers={(membersRes.data ?? []) as RawMember[]}
      initialPendingInvites={(pendingInvitesRes.data ?? []) as RawPendingInvite[]}
      userId={user.id}
      userEmail={user.email ?? ''}
      hasMfa={!!verifiedTotp}
      mfaFactorId={verifiedTotp?.id ?? null}
    />
  )
}
