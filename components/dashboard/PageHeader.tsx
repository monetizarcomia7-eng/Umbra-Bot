import React from 'react'

export function PageHeader({ title, subtitle, actions }: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-text">{title}</h1>
        {subtitle && (
          <p className="text-[13px] text-text-muted mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
