'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import {
  Clock, PlayCircle, Play, Pause, CheckCircle2, Check, GraduationCap,
  HelpCircle, File, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Award, ExternalLink, Volume2, Maximize2, ArrowUpRight, X, Search,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAnalytics } from '@/hooks/use-analytics'

/* ── DB Row Types (exported for page.tsx) ──────────────────── */

export interface RawDbCourse {
  id: string
  title: string
  subtitle: string
  instructor: string
  instructor_role: string
  instructor_avatar: string
  level: string
  duration_min: number
  cover_accent: string
  cover_pattern: string
  featured: boolean
  modules: RawDbModule[]
  created_at: string
}

export interface RawDbModule {
  id: string
  title: string
  lessons: RawDbLesson[]
}

export interface RawDbLesson {
  id: string
  title: string
  description?: string
  durationSec?: number
  duration_min?: number
  type?: 'video' | 'quiz' | 'file'
  video_url?: string
}

export interface RawDbEnrollment {
  course_id: string
  enrolled_at: string
}

export interface RawDbProgress {
  course_id: string
  lesson_id: string
  done: boolean
  watched_sec: number
  done_at: string | null
}

export interface RawDbCertificate {
  course_id: string
  issued_at: string
  certificate_url: string | null
}

/* ── App Types ──────────────────────────────────────────────── */

interface Lesson {
  id: string
  title: string
  description: string
  durationSec: number
  done: boolean
  type: 'video' | 'quiz' | 'file'
  video_url: string
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

interface Certificate {
  courseId: string
  courseTitle: string
  issuedAt: number
  certificateUrl: string | null
}

export interface AcademyClientProps {
  userId: string
  initialCourses: RawDbCourse[]
  initialEnrollments: RawDbEnrollment[]
  initialProgress: RawDbProgress[]
  initialCertificates: RawDbCertificate[]
}

/* ── Data mapping ───────────────────────────────────────────── */

function mapCourses(
  rawCourses: RawDbCourse[],
  enrollments: RawDbEnrollment[],
  progress: RawDbProgress[],
): Course[] {
  const enrollMap = new Map(enrollments.map(e => [e.course_id, e.enrolled_at]))
  const doneMap = new Map<string, Set<string>>()
  for (const p of progress) {
    if (p.done) {
      if (!doneMap.has(p.course_id)) doneMap.set(p.course_id, new Set())
      doneMap.get(p.course_id)!.add(p.lesson_id)
    }
  }

  return rawCourses.map(raw => {
    const doneSet = doneMap.get(raw.id) ?? new Set<string>()
    const enrolledAt = enrollMap.has(raw.id)
      ? new Date(enrollMap.get(raw.id)!).getTime()
      : null

    const modules = (raw.modules ?? []).map((m: RawDbModule) => ({
      id: m.id,
      title: m.title,
      lessons: (m.lessons ?? []).map((l: RawDbLesson) => ({
        id: l.id,
        title: l.title,
        description: l.description ?? '',
        durationSec: l.durationSec ?? (l.duration_min ? l.duration_min * 60 : 0),
        done: doneSet.has(l.id),
        type: (l.type ?? 'video') as Lesson['type'],
        video_url: l.video_url ?? '',
      })),
    }))

    return {
      id: raw.id,
      title: raw.title,
      subtitle: raw.subtitle,
      instructor: raw.instructor,
      instructorRole: raw.instructor_role,
      instructorAvatar: raw.instructor_avatar,
      level: raw.level,
      durationMin: raw.duration_min,
      coverAccent: raw.cover_accent,
      coverPattern: raw.cover_pattern as Course['coverPattern'],
      featured: raw.featured,
      enrolledAt,
      modules,
    }
  })
}

/* ── Helpers ────────────────────────────────────────────────── */

const fmtNum = (n: number) => n.toLocaleString('pt-BR')
const fmtPct = (n: number, dec = 1) => `${n.toFixed(dec)}%`

function cTotalLessons(c: Course) { return c.modules.reduce((s, m) => s + m.lessons.length, 0) }
function cDoneLessons(c: Course)  { return c.modules.reduce((s, m) => s + m.lessons.filter(l => l.done).length, 0) }
function progressPct(c: Course)   { const t = cTotalLessons(c); return t === 0 ? 0 : (cDoneLessons(c) / t) * 100 }
function formatDur(sec: number)   { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}:${String(s).padStart(2, '0')}` }

function currentLesson(c: Course): { module: Module; lesson: Lesson } | null {
  for (const m of c.modules) for (const l of m.lessons) if (l.current) return { module: m, lesson: l }
  for (const m of c.modules) for (const l of m.lessons) if (!l.done)   return { module: m, lesson: l }
  return null
}

/* ── Icon ───────────────────────────────────────────────────── */

const ICON_MAP: Record<string, React.ElementType> = {
  clock: Clock, 'play-circle': PlayCircle, play: Play, pause: Pause,
  'check-circle-2': CheckCircle2, check: Check, 'graduation-cap': GraduationCap,
  'help-circle': HelpCircle, file: File, 'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight, 'chevron-up': ChevronUp, 'chevron-down': ChevronDown,
  award: Award, 'external-link': ExternalLink, 'volume-2': Volume2,
  'maximize-2': Maximize2, 'arrow-up-right': ArrowUpRight, x: X,
}

function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const C = ICON_MAP[name] ?? Clock
  return <C size={size} className={className} />
}

/* ── Btn ────────────────────────────────────────────────────── */

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

/* ── Badge ──────────────────────────────────────────────────── */

function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'primary' | 'success' }) {
  const cls =
    tone === 'primary' ? 'bg-primary-soft text-primary' :
    tone === 'success' ? 'bg-success-soft text-success' :
    'bg-surface-2 text-text-muted'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${cls}`}>
      {children}
    </span>
  )
}

/* ── CourseCover ────────────────────────────────────────────── */

function CourseCover({ course, height = 160, large }: { course: Course; height?: number; large?: boolean }) {
  const a = course.coverAccent
  return (
    <div
      className="relative overflow-hidden"
      style={{ height, background: `linear-gradient(135deg, ${a}, color-mix(in oklab, ${a} 60%, var(--surface)))` }}
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
            <line key={i} x1={400} y1={160}
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
          backgroundSize: '20px 20px', opacity: 0.18,
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

/* ── CourseCard ─────────────────────────────────────────────── */

function CourseCard({ course, hasCert, onOpen }: { course: Course; hasCert: boolean; onOpen: () => void }) {
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
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-[14.5px] font-semibold text-text leading-snug">{course.title}</h3>
          {hasCert && (
            <span title="Certificado emitido" className="shrink-0 mt-0.5">
              <Award size={14} className="text-primary" />
            </span>
          )}
        </div>
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
                Começar <Icon name="arrow-up-right" size={11} />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── VideoPlayer ────────────────────────────────────────────── */

function getVideoKind(url: string): 'youtube' | 'vimeo' | 'bunny' | 'direct' | 'empty' {
  if (!url?.trim()) return 'empty'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('vimeo.com')) return 'vimeo'
  if (url.includes('mediadelivery.net') || url.includes('bunny.net')) return 'bunny'
  return 'direct'
}

function getYoutubeId(url: string): string {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m?.[1] ?? ''
}

function getVimeoId(url: string): string {
  const m = url.match(/vimeo\.com\/(\d+)/)
  return m?.[1] ?? ''
}

function VideoPlayer({ lesson }: { lesson: FlatLesson | undefined }) {
  if (!lesson || lesson.type !== 'video') return null

  const url  = lesson.video_url ?? ''
  const kind = getVideoKind(url)

  if (kind === 'empty') {
    return (
      <div
        className="mt-5 relative aspect-video rounded-xl overflow-hidden border border-border flex flex-col items-center justify-center gap-3"
        style={{ background: 'linear-gradient(135deg, oklch(0.18 0.04 280), oklch(0.10 0.02 280))' }}
      >
        <PlayCircle size={48} className="text-white/20" />
        <p className="text-[13px] text-white/50">Vídeo em breve</p>
      </div>
    )
  }

  if (kind === 'direct') {
    return (
      <div className="mt-5 relative aspect-video rounded-xl overflow-hidden border border-border bg-black">
        <video key={url} src={url} controls className="w-full h-full" />
      </div>
    )
  }

  let embedUrl = url
  if (kind === 'youtube') embedUrl = `https://www.youtube.com/embed/${getYoutubeId(url)}?rel=0`
  if (kind === 'vimeo')   embedUrl = `https://player.vimeo.com/video/${getVimeoId(url)}`

  return (
    <div className="mt-5 relative aspect-video rounded-xl overflow-hidden border border-border bg-black">
      <iframe
        key={embedUrl}
        src={embedUrl}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        title={lesson.title}
      />
    </div>
  )
}

/* ── CertificatesPanel ──────────────────────────────────────── */

function CertificatesPanel({ certs, onClose }: { certs: Certificate[]; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl border border-border w-full max-w-lg shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Award size={18} className="text-primary" />
            <h2 className="text-[15px] font-semibold text-text">Meus Certificados</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-surface-2 flex items-center justify-center text-text-muted hover:text-text transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-5">
          {certs.length === 0 ? (
            <div className="text-center py-10">
              <Award size={40} className="text-text-muted/30 mx-auto mb-3" />
              <p className="text-[13.5px] font-medium text-text mb-1">Nenhum certificado ainda</p>
              <p className="text-[12px] text-text-muted">Conclua 100% de um curso para receber seu certificado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {certs.map(c => (
                <div key={c.courseId} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                  <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center shrink-0">
                    <Award size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-text truncate">{c.courseTitle}</div>
                    <div className="text-[11px] text-text-muted">
                      Emitido em {new Date(c.issuedAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  {c.certificateUrl ? (
                    <a
                      href={c.certificateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline"
                    >
                      Ver <ExternalLink size={11} />
                    </a>
                  ) : (
                    <Badge tone="success">Concluído</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── CourseDetail ───────────────────────────────────────────── */

function CourseDetail({
  course, hasCertificate, onBack, onUpdate, onProgress,
}: {
  course: Course
  hasCertificate: boolean
  onBack: () => void
  onUpdate: (id: string, updater: (c: Course) => Course) => void
  onProgress: (lessonId: string, done: boolean) => void
}) {
  const initial = currentLesson(course)
  const [activeId, setActiveId] = useState(initial?.lesson?.id ?? course.modules[0]?.lessons[0]?.id ?? '')
  const [openModule, setOpenModule] = useState<Set<string>>(
    () => new Set([initial?.module?.id ?? course.modules[0]?.id ?? ''])
  )

  const flatLessons = useMemo<FlatLesson[]>(() => {
    const out: FlatLesson[] = []
    course.modules.forEach(m => m.lessons.forEach(l => out.push({ ...l, moduleId: m.id, moduleTitle: m.title })))
    return out
  }, [course])

  const active    = flatLessons.find(l => l.id === activeId) ?? flatLessons[0]
  const activeIdx = flatLessons.findIndex(l => l.id === activeId)
  const nextLesson = flatLessons[activeIdx + 1]
  const prevLesson = flatLessons[activeIdx - 1]

  function toggleModule(mId: string) {
    setOpenModule(s => { const n = new Set(s); if (n.has(mId)) n.delete(mId); else n.add(mId); return n })
  }

  function openLesson(l: FlatLesson) {
    setActiveId(l.id)
    setOpenModule(s => new Set(s).add(l.moduleId))
  }

  function toggleDone(lId: string) {
    const lesson = flatLessons.find(l => l.id === lId)
    const newDone = !(lesson?.done ?? false)
    onUpdate(course.id, c => ({
      ...c,
      modules: c.modules.map(m => ({
        ...m,
        lessons: m.lessons.map(l => l.id === lId ? { ...l, done: newDone, current: false } : l),
      })),
    }))
    onProgress(lId, newDone)
  }

  function markDoneAndNext() {
    const wasAlreadyDone = active?.done ?? false
    onUpdate(course.id, c => ({
      ...c,
      modules: c.modules.map(m => ({
        ...m,
        lessons: m.lessons.map(l => {
          if (l.id === activeId) return { ...l, done: true, current: false }
          if (nextLesson && l.id === nextLesson.id) return { ...l, current: true }
          return l
        }),
      })),
    }))
    if (!wasAlreadyDone) onProgress(activeId, true)
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
                <><span>·</span><span className="tabular-nums">{formatDur(active!.durationSec)}</span></>
              )}
            </div>
          </div>

          {active?.type === 'video' && (
            <VideoPlayer lesson={active} />
          )}
          {active?.type === 'file' && (
            <div className="mt-5 rounded-xl border border-border bg-surface-2/50 p-8 flex flex-col items-center gap-3">
              <File size={32} className="text-text-muted" />
              <p className="text-[13px] text-text-muted">Material em PDF disponível nesta aula.</p>
              <Btn variant="secondary" icon="external-link">Abrir material</Btn>
            </div>
          )}
          {active?.type === 'quiz' && (
            <div className="mt-5 rounded-xl border border-border bg-surface-2/50 p-8 flex flex-col items-center gap-3">
              <HelpCircle size={32} className="text-text-muted" />
              <p className="text-[13px] text-text-muted">Quiz disponível nesta aula.</p>
              <Btn variant="primary" icon="play">Iniciar quiz</Btn>
            </div>
          )}

          <div className="mt-5 text-[14px] text-text leading-relaxed">
            {active?.description?.trim() ? (
              <p>{active.description}</p>
            ) : (
              <p>
                Nesta aula, vamos cobrir o essencial sobre <strong>{active?.title?.toLowerCase()}</strong>. Use as anotações abaixo como guia rápido e marque a aula como concluída ao terminar.
              </p>
            )}
            {!active?.description?.trim() && (
              <>
                <h3 className="text-[15px] font-semibold mt-5 mb-2">Pontos-chave</h3>
                <ul className="list-disc list-inside space-y-1.5 text-[13.5px] text-text-muted">
                  <li>Contexto: por que isso importa para vendas no Telegram.</li>
                  <li>Conceito principal apresentado de forma direta e prática.</li>
                  <li>Exemplo real com prints do painel.</li>
                  <li>Exercício rápido para você aplicar no seu workspace.</li>
                </ul>
              </>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Btn variant="secondary" icon="chevron-left" onClick={() => prevLesson && setActiveId(prevLesson.id)} disabled={!prevLesson}>
                Aula anterior
              </Btn>
              <Btn variant="primary" iconRight={nextLesson ? 'chevron-right' : 'check-circle-2'} onClick={markDoneAndNext}>
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

          {hasCertificate && (
            <div className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-primary-soft border border-primary/20">
              <Award size={20} className="text-primary shrink-0" />
              <div>
                <div className="text-[13px] font-semibold text-primary">Certificado emitido!</div>
                <div className="text-[11.5px] text-primary/80">Você concluiu este curso. Acesse em "Meus certificados".</div>
              </div>
            </div>
          )}
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
                                l.done ? 'bg-primary border-primary text-primary-fg' :
                                isActive ? 'border-primary text-primary bg-surface' : 'border-border text-text-muted bg-surface',
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
                              {l.current && !isActive && <Badge tone="primary">próx.</Badge>}
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

/* ── ContinueCard ───────────────────────────────────────────── */

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

/* ── EduStat ────────────────────────────────────────────────── */

function EduStat({ label, value, icon, tone }: {
  label: string; value: string; icon: string; tone?: 'primary'
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

/* ── AcademyClient ──────────────────────────────────────────── */

export function AcademyClient({
  userId,
  initialCourses,
  initialEnrollments,
  initialProgress,
  initialCertificates,
}: AcademyClientProps) {
  const supabase  = useMemo(() => createClient(), [])
  const { track } = useAnalytics()

  const [list, setList] = useState<Course[]>(() =>
    mapCourses(initialCourses, initialEnrollments, initialProgress)
  )
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [showCerts, setShowCerts] = useState(false)
  const [search, setSearch]           = useState('')
  const [levelFilter, setLevelFilter] = useState('Todos')

  const [certificates, setCertificates] = useState<Certificate[]>(() =>
    initialCertificates.map(c => ({
      courseId: c.course_id,
      courseTitle: initialCourses.find(r => r.id === c.course_id)?.title ?? '',
      issuedAt: new Date(c.issued_at).getTime(),
      certificateUrl: c.certificate_url,
    }))
  )

  const levels = useMemo(() => {
    const unique = Array.from(new Set(list.map(c => c.level).filter(Boolean)))
    return ['Todos', ...unique]
  }, [list])

  const filteredList = useMemo(() => {
    let out = list
    if (levelFilter !== 'Todos') out = out.filter(c => c.level === levelFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      out = out.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.subtitle.toLowerCase().includes(q) ||
        c.instructor.toLowerCase().includes(q)
      )
    }
    return out
  }, [list, search, levelFilter])

  useEffect(() => {
    if (!search.trim()) return
    track('course_searched', { query: search.trim(), results_count: filteredList.length })
  // only track on search change, not every filteredList recalc
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Enroll user when they first open a course
  const ensureEnrolled = useCallback(async (courseId: string) => {
    const course = list.find(c => c.id === courseId)
    if (!course) return
    if (course.enrolledAt !== null) return

    await supabase.rpc('enroll_in_course', { p_course_id: courseId })
    setList(arr => arr.map(c =>
      c.id === courseId && c.enrolledAt === null
        ? { ...c, enrolledAt: Date.now() }
        : c
    ))
  }, [supabase, list])

  // Persist lesson progress to DB, fire PostHog, check for certificate
  const handleProgress = useCallback(async (courseId: string, lessonId: string, done: boolean) => {
    void supabase.rpc('upsert_lesson_progress', {
      p_course_id: courseId,
      p_lesson_id: lessonId,
      p_done: done,
    })

    if (done) {
      const course = list.find(c => c.id === courseId)
      const lesson = course?.modules.flatMap(m => m.lessons).find(l => l.id === lessonId)
      const totalLessons = course ? cTotalLessons(course) : 0
      const doneLessons  = course ? cDoneLessons(course) + 1 : 0
      const pct          = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0

      if (lesson) {
        track('lesson_completed', {
          course_id:    courseId,
          lesson_id:    lessonId,
          lesson_title: lesson.title,
          progress_pct: pct,
        })
      }

      // Try to issue certificate (DB function checks 100%)
      const { data } = await supabase.rpc('issue_certificate', { p_course_id: courseId })
      if ((data as { issued?: boolean } | null)?.issued) {
        const courseTitle = course?.title ?? ''
        setCertificates(prev => {
          if (prev.some(c => c.courseId === courseId)) return prev
          return [...prev, { courseId, courseTitle, issuedAt: Date.now(), certificateUrl: null }]
        })
        track('certificate_issued', { course_id: courseId, course_title: courseTitle })
        // Activity event: course completed
        void supabase.from('activity_events').insert({
          user_id:     userId,
          type:        'courseCompleted',
          title:       'Curso concluído',
          description: `Você concluiu o curso "${courseTitle}"`,
          bot:         '',
        })
      }
    }
  }, [supabase, list, userId, track])

  function updateCourse(id: string, updater: (c: Course) => Course) {
    setList(arr => arr.map(c => c.id === id ? updater(c) : c))
  }

  async function openCourse(courseId: string) {
    const course     = list.find(c => c.id === courseId)
    const isEnrolled = course?.enrolledAt !== null
    track('course_opened', {
      course_id:    courseId,
      course_title: course?.title ?? '',
      is_enrolled:  !!isEnrolled,
    })
    setActiveCourseId(courseId)
    await ensureEnrolled(courseId)
  }

  const activeCourse = list.find(c => c.id === activeCourseId)

  if (activeCourse) {
    return (
      <DashboardLayout>
        <PageHeader title={activeCourse.title} subtitle={activeCourse.subtitle} />
        <CourseDetail
          course={activeCourse}
          hasCertificate={certificates.some(c => c.courseId === activeCourse.id)}
          onBack={() => setActiveCourseId(null)}
          onUpdate={updateCourse}
          onProgress={(lessonId, done) => handleProgress(activeCourse.id, lessonId, done)}
        />
      </DashboardLayout>
    )
  }

  const enrolled        = list.filter(c => c.enrolledAt !== null)
  const inProgress      = enrolled.filter(c => progressPct(c) > 0 && progressPct(c) < 100)
  const featured        = list.find(c => c.featured && c.enrolledAt !== null) ?? list.find(c => c.enrolledAt !== null)
  const others          = list.filter(c => c.id !== featured?.id)
  const totalHours      = list.reduce((s, c) => s + c.durationMin / 60, 0)
  const totalDone       = enrolled.reduce((s, c) => s + cDoneLessons(c), 0)
  const totalLessonsAll = list.reduce((s, c) => s + cTotalLessons(c), 0)
  const certMap         = new Set(certificates.map(c => c.courseId))

  return (
    <DashboardLayout>
      <PageHeader
        title="Sistema Educacional"
        subtitle="Cursos do time Umbra Bot — aprenda enquanto opera."
        actions={
          <div className="flex items-center gap-2">
            <Btn variant="secondary" icon="award" onClick={() => setShowCerts(true)}>
              Meus certificados
              {certificates.length > 0 && (
                <span className="ml-1 bg-primary text-primary-fg text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {certificates.length}
                </span>
              )}
            </Btn>
          </div>
        }
      />

      {showCerts && (
        <CertificatesPanel certs={certificates} onClose={() => setShowCerts(false)} />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <EduStat label="Cursos disponíveis" value={fmtNum(list.length)}                                 icon="graduation-cap" />
        <EduStat label="Em andamento"        value={fmtNum(inProgress.length)}                          icon="play-circle"    tone="primary" />
        <EduStat label="Aulas concluídas"    value={`${fmtNum(totalDone)}/${fmtNum(totalLessonsAll)}`}  icon="check-circle-2" />
        <EduStat label="Horas de conteúdo"   value={`${Math.round(totalHours)} h`}                      icon="clock" />
      </div>

      {/* Search + level filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar curso..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-surface text-[13px] text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {levels.map(lv => (
            <button
              key={lv}
              onClick={() => {
                setLevelFilter(lv)
                if (lv !== 'Todos') track('course_filtered', { level: lv })
              }}
              className={[
                'h-7 px-3 rounded-full text-[11.5px] font-medium transition-colors',
                levelFilter === lv
                  ? 'bg-primary text-primary-fg'
                  : 'bg-surface-2 text-text-muted border border-border hover:border-border-strong',
              ].join(' ')}
            >
              {lv}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <GraduationCap size={48} className="text-text-muted/30 mb-4" />
          <h3 className="text-[16px] font-semibold text-text mb-2">Nenhum curso disponível ainda</h3>
          <p className="text-[13px] text-text-muted max-w-xs">
            Os cursos serão adicionados em breve pelo time da Umbra Bot.
          </p>
        </div>
      ) : (
        <>
          {featured && !search && levelFilter === 'Todos' && (
            <section className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">Continuar de onde parou</h2>
                <div className="flex-1 h-px bg-border" />
              </div>
              <ContinueCard course={featured} onOpen={() => openCourse(featured.id)} />
            </section>
          )}

          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">
                {search || levelFilter !== 'Todos' ? 'Resultados' : 'Todos os cursos'}
              </h2>
              <span className="text-[10.5px] text-text-muted tabular-nums">{filteredList.length} cursos</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {filteredList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search size={32} className="text-text-muted/30 mb-3" />
                <p className="text-[13.5px] font-medium text-text mb-1">Nenhum curso encontrado</p>
                <p className="text-[12px] text-text-muted">Tente outros termos ou limpe os filtros.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredList.map(c => (
                  <CourseCard
                    key={c.id}
                    course={c}
                    hasCert={certMap.has(c.id)}
                    onOpen={() => openCourse(c.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </DashboardLayout>
  )
}
