import React from 'react'
import {
  Download, Plus, Upload, Edit, Trash2, RefreshCw, Search, Filter,
  Settings, Save, X, Check, ArrowLeft, ArrowRight, ChevronDown,
  Eye, EyeOff, Copy, ExternalLink, Link,
  AlertTriangle, Info, Zap, Send, BarChart3, Users, Bot, Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const iconMap: Record<string, LucideIcon> = {
  'download': Download,
  'plus': Plus,
  'upload': Upload,
  'edit': Edit,
  'trash-2': Trash2,
  'refresh-cw': RefreshCw,
  'search': Search,
  'filter': Filter,
  'settings': Settings,
  'save': Save,
  'x': X,
  'check': Check,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'chevron-down': ChevronDown,
  'eye': Eye,
  'eye-off': EyeOff,
  'copy': Copy,
  'external-link': ExternalLink,
  'link': Link,
  'alert-triangle': AlertTriangle,
  'info': Info,
  'zap': Zap,
  'send': Send,
  'bar-chart-3': BarChart3,
  'users': Users,
  'bot': Bot,
  'wallet': Wallet,
}

export function Button({
  variant = 'primary',
  icon,
  children,
  onClick,
  type = 'button',
  className,
}: {
  variant?: 'primary' | 'secondary'
  icon?: string
  children?: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  className?: string
}) {
  const Icon = icon ? (iconMap[icon] ?? null) : null

  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium rounded-lg transition-colors',
        variant === 'primary'
          ? 'bg-primary text-primary-fg hover:opacity-90'
          : 'border border-border bg-surface text-text hover:bg-surface-2',
        className,
      )}
    >
      {Icon && <Icon size={14} className="shrink-0" />}
      {children}
    </button>
  )
}
