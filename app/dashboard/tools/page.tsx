import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ToolsClient } from './ToolsClient'

export interface RawBot {
  id:       string
  name:     string
  username: string
  status:   string
  color:    string
}

export interface RawFlow {
  id:     string
  name:   string
  status: string
  nodes:  unknown[]
  edges:  unknown[]
}

export default async function ToolsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: bots }, { data: flows }] = await Promise.all([
    supabase
      .from('bots')
      .select('id, name, username, status, color')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false }),
    supabase
      .from('flows')
      .select('id, name, status, nodes, edges')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
  ])

  return (
    <ToolsClient
      bots={(bots ?? []) as RawBot[]}
      flows={(flows ?? []) as RawFlow[]}
    />
  )
}
