'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import {
  Clock, PlayCircle, Play, Pause, CheckCircle2, Check, GraduationCap,
  HelpCircle, File, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Award, ExternalLink, Volume2, Maximize2, ArrowUpRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/* ── Types ─────────────────────────────────────────────────────── */

interface Lesson {
  id: string
  title: string
  durationSec: number
  done: boolean
  type: 'video' | 'quiz' | 'file'
  current?: boolean
}

interface Module {
  id: string
  title: string
  lessons: Lesson[]
}

interface Course {
  id: string
  title: string
  subtitle: string
  instructor: string
  instructorRole: string
  instructorAvatar: string
  level: string
  durationMin: number
  coverAccent: string
  coverPattern: 'wave' | 'grid' | 'rays' | 'dots' | 'mesh'
  featured: boolean
  enrolledAt: number | null
  modules: Module[]
}

interface FlatLesson extends Lesson {
  moduleId: string
  moduleTitle: string
}

/* ── Helpers ────────────────────────────────────────────────────── */

const fmtNum = (n: number) => n.toLocaleString('pt-BR')
const fmtPct = (n: number, dec = 1) => `${n.toFixed(dec)}%`

function makeShortCourse(totalCount: number, doneCount: number): Module[] {
  const titles = [
    'Visão geral', 'O básico que ninguém te conta', 'Estudo de caso real',
    'Setup passo a passo', 'Quando não fazer', 'Templates prontos',
    'Métricas que importam', 'Quiz · valide o aprendizado', 'Próximos passos',
    'Erros mais comuns', 'Sessão ao vivo (gravada)', 'Material complementar',
    'Bônus: 30 perguntas',
  ]
  const result: Module[] = []
  let lessonIdx = 0
  let doneRemaining = doneCount
  for (let m = 0; m < 4 && lessonIdx < totalCount; m++) {
    const lessons: Lesson[] = []
    const count = Math.min(Math.ceil((totalCount - lessonIdx) / (4 - m)), 5)
    for (let i = 0; i < count && lessonIdx < totalCount; i++) {
      const done = doneRemaining > 0
      if (done) doneRemaining--
      lessons.push({
        id: `l_${m}_${i}`,
        title: titles[(m * 3 + i) % titles.length],
        durationSec: 240 + (lessonIdx % 4) * 120,
        done,
        type: i === count - 1 ? 'quiz' : 'video',
      })
      lessonIdx++
    }
    result.push({ id: `m_${m}`, title: `Módulo ${m + 1}`, lessons })
  }
  return result
}

const NOW_E = new Date('2026-05-18T15:30:00').getTime()

const MOCK_COURSES: Course[] = [
  {
    id: 'c01',
    title: 'Vendas no Telegram do zero ao 100k',
    subtitle: 'Do primeiro bot ao primeiro 6 dígitos · 9 horas',
    instructor: 'Ana Souza',
    instructorRole: 'Fundadora · Umbra Bot',
    instructorAvatar: 'AS',
    level: 'Iniciante → Intermediário',
    durationMin: 540,
    coverAccent: 'var(--primary)',
    coverPattern: 'wave',
    featured: true,
    enrolledAt: NOW_E - 18 * 24 * 3600 * 1000,
    modules: [
      { id: 'm1', title: 'Bem-vindo & mindset', lessons: [
        { id: 'l1',  title: 'O que você vai aprender',               durationSec: 240, done: true,  type: 'video' },
        { id: 'l2',  title: 'Como o Telegram virou canal de venda',   durationSec: 360, done: true,  type: 'video' },
        { id: 'l3',  title: 'Sua bússola de métricas',                durationSec: 420, done: true,  type: 'video' },
      ]},
      { id: 'm2', title: 'Configurando o bot', lessons: [
        { id: 'l4',  title: 'Criando seu bot no @BotFather',          durationSec: 540, done: true,  type: 'video' },
        { id: 'l5',  title: 'Conectando ao Umbra Bot',                durationSec: 320, done: true,  type: 'video' },
        { id: 'l6',  title: 'Personalizando o bot e mensagens',       durationSec: 600, done: true,  type: 'video' },
        { id: 'l7',  title: 'Quiz · você entendeu?',                  durationSec: 180, done: false, type: 'quiz'  },
      ]},
      { id: 'm3', title: 'Criando seu primeiro funil', lessons: [
        { id: 'l8',  title: 'Anatomia de um funil que vende',         durationSec: 720, done: false, type: 'video', current: true },
        { id: 'l9',  title: 'Configurando o fluxo no editor visual',  durationSec: 840, done: false, type: 'video' },
        { id: 'l10', title: 'Variáveis e personalização dinâmica',    durationSec: 480, done: false, type: 'video' },
        { id: 'l11', title: 'Material complementar: templates',       durationSec: 0,   done: false, type: 'file'  },
      ]},
      { id: 'm4', title: 'Pagamentos e split', lessons: [
        { id: 'l12', title: 'Como funciona o split do Umbra Bot',     durationSec: 540, done: false, type: 'video' },
        { id: 'l13', title: 'Conectando seu primeiro gateway',        durationSec: 420, done: false, type: 'video' },
        { id: 'l14', title: 'Testando uma cobrança real',              durationSec: 360, done: false, type: 'video' },
      ]},
      { id: 'm5', title: 'Tráfego e remarketing', lessons: [
        { id: 'l15', title: 'Pixel + UTMs: atribuição que funciona',  durationSec: 660, done: false, type: 'video' },
        { id: 'l16', title: 'Carrinho abandonado em 24 h',             durationSec: 480, done: false, type: 'video' },
        { id: 'l17', title: 'Disparo segmentado por tag',              durationSec: 540, done: false, type: 'video' },
      ]},
    ],
  },
  {
    id: 'c02',
    title: 'Funis avançados para infoprodutos',
    subtitle: 'Estrutura completa do lançamento clássico ao perpétuo · 6 horas',
    instructor: 'Bruno Tavares',
    instructorRole: 'Head of Growth · Tribo',
    instructorAvatar: 'BT',
    level: 'Intermediário',
    durationMin: 360,
    coverAccent: 'oklch(0.62 0.16 240)',
    coverPattern: 'grid',
    featured: false,
    enrolledAt: NOW_E - 9 * 24 * 3600 * 1000,
    modules: makeShortCourse(20, 4),
  },
  {
    id: 'c03',
    title: 'Copywriting para o Telegram',
    subtitle: 'Mensagens que abrem, retêm e convertem · 4 horas',
    instructor: 'Camila Oliveira',
    instructorRole: 'Copywriter sênior',
    instructorAvatar: 'CO',
    level: 'Iniciante',
    durationMin: 240,
    coverAccent: 'oklch(0.66 0.18 50)',
    coverPattern: 'rays',
    featured: false,
    enrolledAt: NOW_E - 32 * 24 * 3600 * 1000,
    modules: makeShortCourse(14, 5),
  },
  {
    id: 'c04',
    title: 'Análises: lendo os dados certos',
    subtitle: 'KPIs, funil de conversão e cohort na prática · 3 horas',
    instructor: 'Diego Antunes',
    instructorRole: 'Data Lead · Umbra Bot',
    instructorAvatar: 'DA',
    level: 'Intermediário',
    durationMin: 180,
    coverAccent: 'oklch(0.65 0.18 320)',
    coverPattern: 'dots',
    featured: false,
    enrolledAt: null,
    modules: makeShortCourse(12, 0),
  },
  {
    id: 'c05',
    title: 'Operação 24/7: bots de suporte',
    subtitle: 'Atendimento humano + automação em escala · 4 horas',
    instructor: 'Letícia Costa',
    instructorRole: 'CX · Tribo',
    instructorAvatar: 'LC',
    level: 'Avançado',
    durationMin: 240,
    coverAccent: 'oklch(0.62 0.18 145)',
    coverPattern: 'mesh',
    featured: false,
    enrolledAt: null,
    modules: makeShortCourse(16, 0),
  },
]

function cTotalLessons(c: Course) { return c.modules.reduce((s, m) => s + m.lessons.length, 0) }
function cDoneLessons(c: Course)  { return c.modules.reduce((s, m) => s + m.lessons.filter(l => l.done).length, 0) }
function progressPct(c: Course)   { const t = cTotalLessons(c); return t === 0 ? 0 : (cDoneLessons(c) / t) * 100 }
function formatDur(sec: number)   { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}:${String(s).padStart(2, '0')}` }

function currentLesson(c: Course): { module: Module; lesson: Lesson } | null {
  for (const m of c.modules) for (const l of m.lessons) if (l.current) return { module: m, lesson: l }
  for (const m of c.modules) for (const l of m.lessons) if (!l.done) return { module: m, lesson: l }
  return null
}

/* ── Icon ───────────────────────────────────────────────────────── */

const ICON_MAP: Record<string, React.ElementType> = {
  clock: Clock,
  'play-circle': PlayCircle,
  play: Play,
  pause: Pause,
  'check-circle-2': CheckCircle2,
  check: Check,
  'graduation-cap': GraduationCap,
  'help-circle': HelpCircle,
  file: File,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  award: Award,
  'external-link': ExternalLink,
  'volume-2': Volume2,
  'maximize-2': Maximize2,
  'arrow-up-right': ArrowUpRight,
}

function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const C = ICON_MAP[name] ?? Clock
  return <C size={size} className={className} />
}

/* ── Btn ────────────────────────────────────────────────────────── */

function Btn({
  children, onClick, variant = 'secondary', icon, iconRight, disabled,
}: {
  children?: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  icon?: string
  iconRight?: string
  disabled?: boolean
}) {
  const base = 'inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary h-9 px-3.5'
  const styles: Record<string, string> = {
    primary: 'bg-primary text-primary-fg hover:opacity-90',
    secondary: 'bg-surface-2 text-text border border-border hover:border-border-strong',
    ghost: 'text-text-muted hover:text-text hover:bg-surface-2',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
      {iconRight && <Icon name={iconRight} size={14} />}
    </button>
  )
}

/* ── Badge ──────────────────────────────────────────────────────── */

function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'primary' }) {
  const cls = tone === 'primary'
    ? 'bg-primary-soft text-primary'
    : 'bg-surface-2 text-text-muted'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${cls}`}>
      {children}
    </span>
  )
}

/* ── CourseCover ────────────────────────────────────────────────── */

function CourseCover({ course, height = 160, large }: { course: Course; height?: number; large?: boolean }) {
  const a = course.coverAccent
  return (
    <div
      className="relative overflow-hidden"
      style={{
        height,
        background: `linear-gradient(135deg, ${a}, color-mix(in oklab, ${a} 60%, var(--surface)))`,
      }}
    >
      {course.coverPattern === 'wave' && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 160" preserveAspectRatio="none">
          <path d="M 0 100 C 80 60, 160 140, 240 90 S 400 80, 400 100 L 400 160 L 0 160 Z" fill="white" opacity="0.10" />
          <path d="M 0 130 C 100 100, 200 160, 300 120 S 400 110, 400 130 L 400 160 L 0 160 Z" fill="white" opacity="0.12" />
        </svg>
      )}
      {course.coverPattern === 'grid' && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 160" preserveAspectRatio="none">
          <defs>
            <pattern id={`g-${course.id}`} width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="white" strokeOpacity="0.18" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="400" height="160" fill={`url(#g-${course.id})`} />
        </svg>
      )}
      {course.coverPattern === 'rays' && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 160">
          {Array.from({ length: 14 }, (_, i) => (
            <line
              key={i}
              x1={400} y1={160}
              x2={400 - Math.cos((i / 14) * Math.PI) * 600}
              y2={160 - Math.sin((i / 14) * Math.PI) * 600}
              stroke="white" strokeOpacity="0.10" strokeWidth="40"
            />
          ))}
        </svg>
      )}
      {course.coverPattern === 'dots' && (
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1.5px)',
          backgroundSize: '20px 20px',
          opacity: 0.18,
        }} />
      )}
      {course.coverPattern === 'mesh' && (
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(circle at 20% 30%, white 0%, transparent 25%), radial-gradient(circle at 80% 60%, white 0%, transparent 30%)',
          opacity: 0.12,
        }} />
      )}
      <div className="relative h-full flex flex-col justify-end p-4">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-white/80">{course.level}</div>
        {large && (
          <h3 className="text-[20px] font-bold tracking-tight text-white leading-tight mt-1.5 max-w-md">{course.title}</h3>
        )}
      </div>
    </div>
  )
}

/* ── CourseCard ─────────────────────────────────────────────────── */

function CourseCard({ course, onOpen }: { course: Course; onOpen: () => void }) {
  const pct    = progressPct(course)
  const done   = cDoneLessons(course)
  const total  = cTotalLessons(course)
  const enrolled = course.enrolledAt !== null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="group bg-surface border border-border rounded-xl overflow-hidden hover:border-border-strong transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <CourseCover course={course} height={140} />
      <div className="p-4">
        <h3 className="text-[14.5px] font-semibold text-text leading-snug">{course.title}</h3>
        <p className="text-[12px] text-text-muted mt-1 leading-snug line-clamp-2">{course.subtitle}</p>

        <div className="mt-3 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary text-primary-fg text-[10px] font-bold flex items-center justify-center">
            {course.instructorAvatar}
          </div>
          <div className="min-w-0">
            <div className="text-[11.5px] font-medium text-text leading-tight truncate">{course.instructor}</div>
            <div className="text-[10.5px] text-text-muted leading-tight truncate">{course.instructorRole}</div>
          </div>
          <div className="ml-auto flex items-center gap-1 text-[10.5px] text-text-muted tabular-nums">
            <Icon name="clock" size={10} />
            {Math.round(course.durationMin / 60)} h
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border">
          {enrolled ? (
            <>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-text-muted">{done}/{total} aulas</span>
                <span className="tabular-nums font-semibold text-text">{fmtPct(pct, 0)}</span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between text-[11.5px]">
              <span className="text-text-muted">{total} aulas · não iniciado</span>
              <span className="inline-flex items-center gap-1 text-primary font-medium group-hover:underline">
                Começar
                <Icon name="arrow-up-right" size={11} />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── VideoPlayer ────────────────────────────────────────────────── */

function VideoPlayer({ lesson }: { lesson: FlatLesson | undefined }) {
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const total = lesson?.durationSec ?? 0

  useEffect(() => {
    setPlaying(false)
    setPosition(0)
  }, [lesson?.id])

  useEffect(() => {
    if (!playing || total === 0) return
    const t = setInterval(() => {
      setPosition((p) => {
        if (p >= total) { setPlaying(false); return total }
        return p + 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [playing, total])

  const pct = total === 0 ? 0 : (position / total) * 100

  return (
    <div
      className="mt-5 relative aspect-video rounded-xl overflow-hidden border border-border"
      style={{ background: 'linear-gradient(135deg, oklch(0.18 0.04 280), oklch(0.10 0.02 280))' }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <button
          onClick={() => setPlaying(p => !p)}
          className="w-16 h-16 rounded-full bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center text-white hover:bg-white/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name={playing ? 'pause' : 'play'} size={24} />
        </button>
      </div>

      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1.5px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2.5 text-white text-[11.5px]">
          <button
            onClick={() => setPlaying(p => !p)}
            className="w-8 h-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center"
          >
            <Icon name={playing ? 'pause' : 'play'} size={14} />
          </button>
          <span className="tabular-nums opacity-80">{formatDur(position)} / {formatDur(total)}</span>
          <div className="flex-1 mx-2">
            <div className="h-1 bg-white/15 rounded-full overflow-hidden cursor-pointer relative">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-white"
                style={{ left: `calc(${pct}% - 6px)` }}
              />
            </div>
          </div>
          <button className="w-8 h-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <Icon name="volume-2" size={13} />
          </button>
          <button className="w-8 h-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center tabular-nums text-[10.5px] font-semibold">
            1x
          </button>
          <button className="w-8 h-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <Icon name="maximize-2" size={13} />
          </button>
        </div>
      </div>

      <div className="absolute top-4 left-4">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/10 backdrop-blur text-[10.5px] font-semibold uppercase tracking-wider text-white">
          <Icon name="play-circle" size={10} />
          Aula em vídeo
        </span>
      </div>
    </div>
  )
}

/* ── CourseDetail ───────────────────────────────────────────────── */

function CourseDetail({
  course, onBack, onUpdate,
}: {
  course: Course
  onBack: () => void
  onUpdate: (id: string, updater: (c: Course) => Course) => void
}) {
  const initial = currentLesson(course)
  const [activeId, setActiveId] = useState(initial?.lesson?.id ?? course.modules[0]?.lessons[0]?.id ?? '')
  const [openModule, setOpenModule] = useState<Set<string>>(
    () => new Set([initial?.module?.id ?? course.modules[0]?.id ?? ''])
  )

  const flatLessons = useMemo<FlatLesson[]>(() => {
    const out: FlatLesson[] = []
    course.modules.forEach((m) =>
      m.lessons.forEach((l) => out.push({ ...l, moduleId: m.id, moduleTitle: m.title }))
    )
    return out
  }, [course])

  const active    = flatLessons.find(l => l.id === activeId) ?? flatLessons[0]
  const activeIdx = flatLessons.findIndex(l => l.id === activeId)
  const nextLesson = flatLessons[activeIdx + 1]
  const prevLesson = flatLessons[activeIdx - 1]

  function toggleModule(mId: string) {
    setOpenModule((s) => {
      const n = new Set(s)
      if (n.has(mId)) n.delete(mId); else n.add(mId)
      return n
    })
  }

  function openLesson(l: FlatLesson) {
    setActiveId(l.id)
    setOpenModule((s) => new Set(s).add(l.moduleId))
  }

  function toggleDone(lId: string) {
    onUpdate(course.id, (c) => ({
      ...c,
      modules: c.modules.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => l.id === lId ? { ...l, done: !l.done, current: false } : l),
      })),
    }))
  }

  function markDoneAndNext() {
    onUpdate(course.id, (c) => ({
      ...c,
      modules: c.modules.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => {
          if (l.id === activeId) return { ...l, done: true, current: false }
          if (nextLesson && l.id === nextLesson.id) return { ...l, current: true }
          return l
        }),
      })),
    }))
    if (nextLesson) setActiveId(nextLesson.id)
  }

  const pct   = progressPct(course)
  const done  = cDoneLessons(course)
  const total = cTotalLessons(course)

  const lessonIcon = (l: Lesson) =>
    l.type === 'quiz' ? 'help-circle' : l.type === 'file' ? 'file' : 'play-circle'

  return (
    <>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 h-8 px-2 text-[12px] text-text-muted hover:text-text rounded-md hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary mb-4"
      >
        <Icon name="chevron-left" size={13} />
        Voltar para meus cursos
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Player column */}
        <div className="min-w-0">
          <CourseCover course={course} height={220} large />

          <div className="mt-4">
            <div className="flex items-center gap-2 text-[11px] text-text-muted">
              <span className="uppercase tracking-wider font-semibold">{active?.moduleTitle}</span>
              <span>·</span>
              <span className="tabular-nums">{activeIdx + 1} de {flatLessons.length}</span>
            </div>
            <h1 className="text-[24px] font-semibold tracking-tight text-text leading-tight mt-1">
              {active?.title}
            </h1>
            <div className="mt-1.5 flex items-center gap-3 text-[12px] text-text-muted">
              <span className="inline-flex items-center gap-1">
                <Icon name={active ? lessonIcon(active) : 'play-circle'} size={12} />
                {active?.type === 'quiz' ? 'Quiz' : active?.type === 'file' ? 'Material' : 'Aula em vídeo'}
              </span>
              {(active?.durationSec ?? 0) > 0 && (
                <>
                  <span>·</span>
                  <span className="tabular-nums">{formatDur(active!.durationSec)}</span>
                </>
              )}
            </div>
          </div>

          <VideoPlayer lesson={active} />

          <div className="mt-5 text-[14px] text-text leading-relaxed">
            <p>
              Nesta aula, vamos cobrir o essencial sobre <strong>{active?.title?.toLowerCase()}</strong>. Use as anotações abaixo como guia rápido e marque a aula como concluída ao terminar.
            </p>
            <h3 className="text-[15px] font-semibold mt-5 mb-2">Pontos-chave</h3>
            <ul className="list-disc list-inside space-y-1.5 text-[13.5px] text-text-muted">
              <li>Contexto: por que isso importa para vendas no Telegram.</li>
              <li>Conceito principal apresentado de forma direta e prática.</li>
              <li>Exemplo real com prints do painel.</li>
              <li>Exercício rápido para você aplicar no seu workspace.</li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Btn
                variant="secondary"
                icon="chevron-left"
                onClick={() => prevLesson && setActiveId(prevLesson.id)}
                disabled={!prevLesson}
              >
                Aula anterior
              </Btn>
              <Btn
                variant="primary"
                iconRight={nextLesson ? 'chevron-right' : 'check-circle-2'}
                onClick={markDoneAndNext}
              >
                {active?.done
                  ? (nextLesson ? 'Próxima aula' : 'Concluir curso')
                  : (nextLesson ? 'Concluir e avançar' : 'Concluir curso')}
              </Btn>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!active?.done}
                onChange={() => active && toggleDone(active.id)}
                className="accent-primary"
              />
              <span className="text-[12.5px] text-text-muted">
                {active?.done ? 'Aula concluída' : 'Marcar como concluída'}
              </span>
            </label>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-muted">Seu progresso</div>
              <span className="text-[16px] font-semibold tabular-nums text-text tracking-tight">{fmtPct(pct, 0)}</span>
            </div>
            <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 text-[11.5px] text-text-muted tabular-nums">
              {done} de {total} aulas concluídas · {Math.round(course.durationMin / 60)} h de conteúdo
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-fg font-bold text-[14px] flex items-center justify-center shrink-0">
                {course.instructorAvatar}
              </div>
              <div className="min-w-0">
                <div className="text-[12px] uppercase tracking-wider font-semibold text-text-muted">Instrutor</div>
                <div className="text-[13.5px] font-semibold text-text leading-tight">{course.instructor}</div>
                <div className="text-[11px] text-text-muted leading-tight truncate">{course.instructorRole}</div>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <div className="text-[13px] font-semibold text-text">Conteúdo do curso</div>
              <div className="text-[11px] text-text-muted mt-0.5">{course.modules.length} módulos · {total} aulas</div>
            </div>
            <div className="border-t border-border">
              {course.modules.map((m, mi) => {
                const isOpen = openModule.has(m.id)
                const mDone  = m.lessons.filter(l => l.done).length
                return (
                  <div key={m.id} className="border-b border-border last:border-b-0">
                    <button
                      onClick={() => toggleModule(m.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/50 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span className="w-6 h-6 rounded-md bg-surface-2 text-text-muted text-[10.5px] font-semibold flex items-center justify-center tabular-nums shrink-0">
                        {mi + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-medium text-text truncate">{m.title}</div>
                        <div className="text-[10.5px] text-text-muted tabular-nums">{mDone}/{m.lessons.length} aulas</div>
                      </div>
                      <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={13} className="text-text-muted shrink-0" />
                    </button>
                    {isOpen && (
                      <div className="bg-surface-2/30 border-t border-border divide-y divide-border">
                        {m.lessons.map((l, li) => {
                          const isActive = l.id === activeId
                          const fl: FlatLesson = { ...l, moduleId: m.id, moduleTitle: m.title }
                          return (
                            <button
                              key={l.id}
                              onClick={() => openLesson(fl)}
                              className={[
                                'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                isActive ? 'bg-primary-soft' : 'hover:bg-surface-2/60',
                              ].join(' ')}
                            >
                              <span className={[
                                'w-5 h-5 rounded-full flex items-center justify-center shrink-0 border',
                                l.done
                                  ? 'bg-primary border-primary text-primary-fg'
                                  : isActive
                                    ? 'border-primary text-primary bg-surface'
                                    : 'border-border text-text-muted bg-surface',
                              ].join(' ')}>
                                {l.done
                                  ? <Icon name="check" size={10} />
                                  : <Icon name={l.type === 'quiz' ? 'help-circle' : l.type === 'file' ? 'file' : 'play'} size={9} />
                                }
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className={`text-[12px] truncate ${isActive ? 'text-primary font-medium' : 'text-text'}`}>
                                  {li + 1}. {l.title}
                                </div>
                                <div className="text-[10px] text-text-muted tabular-nums">
                                  {l.type === 'quiz' ? 'Quiz' : l.type === 'file' ? 'PDF' : 'Vídeo'}
                                  {l.durationSec > 0 && <> · {formatDur(l.durationSec)}</>}
                                </div>
                              </div>
                              {l.current && !isActive && (
                                <Badge tone="primary">próx.</Badge>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}

/* ── ContinueCard ───────────────────────────────────────────────── */

function ContinueCard({ course, onOpen }: { course: Course; onOpen: () => void }) {
  const cur   = currentLesson(course)
  const pct   = progressPct(course)
  const done  = cDoneLessons(course)
  const total = cTotalLessons(course)

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-[420px_1fr]">
      <CourseCover course={course} height={220} large />
      <div className="p-5 flex flex-col">
        <div className="flex items-center gap-2">
          <Badge tone="primary">Em andamento</Badge>
          <span className="text-[11px] text-text-muted tabular-nums">{course.level}</span>
        </div>
        <h2 className="text-[22px] font-semibold tracking-tight text-text leading-tight mt-2">{course.title}</h2>
        <p className="text-[13px] text-text-muted mt-1 leading-relaxed max-w-2xl">{course.subtitle}</p>

        <div className="mt-4 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-fg font-bold text-[12px] flex items-center justify-center">
            {course.instructorAvatar}
          </div>
          <div className="text-[12px]">
            <div className="text-text font-medium leading-tight">{course.instructor}</div>
            <div className="text-text-muted leading-tight">{course.instructorRole}</div>
          </div>
        </div>

        <div className="mt-auto pt-5">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[11.5px] text-text-muted">
              Próxima aula: <span className="text-text font-medium">{cur?.lesson?.title ?? 'Curso concluído'}</span>
            </span>
            <span className="text-[12px] tabular-nums font-semibold text-text">{fmtPct(pct, 0)}</span>
          </div>
          <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 text-[10.5px] text-text-muted tabular-nums">{done} de {total} aulas</div>

          <div className="mt-4 flex gap-2">
            <Btn variant="primary" icon="play" onClick={onOpen}>Continuar curso</Btn>
            <Btn variant="ghost" icon="external-link" onClick={onOpen}>Ver índice</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── EduStat ────────────────────────────────────────────────────── */

function EduStat({ label, value, icon, tone }: {
  label: string
  value: string
  icon: string
  tone?: 'primary'
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-2.5">
        <div className="text-[11.5px] text-text-muted font-medium">{label}</div>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${tone === 'primary' ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-text-muted'}`}>
          <Icon name={icon} size={14} />
        </div>
      </div>
      <div className="text-[22px] font-semibold tabular-nums tracking-tight text-text leading-none">{value}</div>
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────────────── */

export default function AcademyPage() {
  const [list, setList]         = useState<Course[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const sb = createClient()
        const { data } = await sb.from('courses').select('*')
        if (data && data.length > 0) {
          setList(data as Course[])
        } else {
          setList(MOCK_COURSES)
        }
      } catch {
        setList(MOCK_COURSES)
      }
    }
    load()
  }, [])

  function updateCourse(id: string, updater: (c: Course) => Course) {
    setList((arr) => arr.map((c) => (c.id === id ? updater(c) : c)))
  }

  const active = list.find(c => c.id === activeId)

  if (active) {
    return (
      <DashboardLayout>
        <PageHeader title={active.title} subtitle={active.subtitle} />
        <CourseDetail course={active} onBack={() => setActiveId(null)} onUpdate={updateCourse} />
      </DashboardLayout>
    )
  }

  const enrolled       = list.filter(c => c.enrolledAt !== null)
  const inProgress     = enrolled.filter(c => progressPct(c) > 0 && progressPct(c) < 100)
  const featured       = list.find(c => c.featured)
  const others         = list.filter(c => c.id !== featured?.id)
  const totalHours     = list.reduce((s, c) => s + c.durationMin / 60, 0)
  const totalDone      = enrolled.reduce((s, c) => s + cDoneLessons(c), 0)
  const totalLessonsAll = list.reduce((s, c) => s + cTotalLessons(c), 0)

  return (
    <DashboardLayout>
      <PageHeader
        title="Sistema Educacional"
        subtitle="Cursos do time Umbra Bot e do time Tribo Black — aprenda enquanto opera."
        actions={
          <div className="flex items-center gap-2">
            <Btn variant="secondary" icon="award">Meus certificados</Btn>
            <Btn variant="ghost" icon="external-link">Biblioteca completa</Btn>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <EduStat label="Cursos disponíveis" value={fmtNum(list.length)}                                       icon="graduation-cap" />
        <EduStat label="Em andamento"        value={fmtNum(inProgress.length)}                                icon="play-circle"    tone="primary" />
        <EduStat label="Aulas concluídas"    value={`${fmtNum(totalDone)}/${fmtNum(totalLessonsAll)}`}        icon="check-circle-2" />
        <EduStat label="Horas de conteúdo"   value={`${Math.round(totalHours)} h`}                           icon="clock" />
      </div>

      {featured && (
        <section className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">Continuar de onde parou</h2>
            <div className="flex-1 h-px bg-border" />
          </div>
          <ContinueCard course={featured} onOpen={() => setActiveId(featured.id)} />
        </section>
      )}

      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">Todos os cursos</h2>
          <span className="text-[10.5px] text-text-muted tabular-nums">{others.length} cursos</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {others.map(c => (
            <CourseCard key={c.id} course={c} onOpen={() => setActiveId(c.id)} />
          ))}
        </div>
      </section>
    </DashboardLayout>
  )
}
