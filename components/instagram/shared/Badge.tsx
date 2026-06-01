type Tone = 'success' | 'danger' | 'warning' | 'muted' | 'info' | 'primary'

const TONES: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: 'color-mix(in oklab, var(--success) 12%, transparent)', fg: 'var(--success)' },
  danger:  { bg: 'color-mix(in oklab, var(--danger) 12%, transparent)',  fg: 'var(--danger)' },
  warning: { bg: 'color-mix(in oklab, var(--warning) 12%, transparent)', fg: 'var(--warning)' },
  info:    { bg: 'color-mix(in oklab, var(--info) 12%, transparent)',    fg: 'var(--info)' },
  primary: { bg: 'color-mix(in oklab, var(--primary) 12%, transparent)', fg: 'var(--primary)' },
  muted:   { bg: 'var(--surface-2)',                                       fg: 'var(--text-muted)' },
}

export default function Badge({
  children, tone = 'muted',
}: {
  children: React.ReactNode
  tone?: Tone
}) {
  const c = TONES[tone]
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
      style={{ background: c.bg, color: c.fg }}
    >
      {children}
    </span>
  )
}
