import { NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import path from 'path'

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations')

export async function GET() {
  const configured = !!(
    process.env.SUPABASE_ACCESS_TOKEN && process.env.SUPABASE_PROJECT_REF
  )

  try {
    let files: string[] = []
    try {
      files = (await readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort()
    } catch {
      return NextResponse.json({ migrations: [], configured })
    }

    const migrations = await Promise.all(
      files.map(async (file) => {
        const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf-8')
        const description = file
          .replace(/^\d+_/, '')
          .replace(/\.sql$/, '')
          .replace(/_/g, ' ')
        return { name: file, sql, description }
      })
    )

    return NextResponse.json({ migrations, configured })
  } catch (e) {
    return NextResponse.json({ error: String(e), migrations: [], configured }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const { sql } = (await req.json()) as { sql: string }

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN
  const projectRef = process.env.SUPABASE_PROJECT_REF

  if (!accessToken || !projectRef) {
    return NextResponse.json(
      { error: 'SUPABASE_ACCESS_TOKEN ou SUPABASE_PROJECT_REF não configurados no .env.local' },
      { status: 400 }
    )
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  )

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const msg = (data as { message?: string; error?: string }).message
      ?? (data as { message?: string; error?: string }).error
      ?? `HTTP ${res.status}`
    return NextResponse.json({ error: msg }, { status: res.status })
  }

  return NextResponse.json({ ok: true, result: data })
}
