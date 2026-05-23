import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AcademyClient } from './AcademyClient'
import type { RawDbCourse, RawDbEnrollment, RawDbProgress, RawDbCertificate } from './AcademyClient'

export const dynamic = 'force-dynamic'

export default async function AcademyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [coursesRes, enrollRes, progressRes, certsRes] = await Promise.all([
    supabase.from('courses').select('*').order('featured', { ascending: false }),
    supabase
      .from('course_enrollments')
      .select('course_id, enrolled_at')
      .eq('user_id', user.id),
    supabase
      .from('course_progress')
      .select('course_id, lesson_id, done, watched_sec, done_at')
      .eq('user_id', user.id),
    supabase
      .from('course_certificates')
      .select('course_id, issued_at, certificate_url')
      .eq('user_id', user.id),
  ])

  return (
    <AcademyClient
      userId={user.id}
      initialCourses={(coursesRes.data ?? []) as unknown as RawDbCourse[]}
      initialEnrollments={(enrollRes.data ?? []) as unknown as RawDbEnrollment[]}
      initialProgress={(progressRes.data ?? []) as unknown as RawDbProgress[]}
      initialCertificates={(certsRes.data ?? []) as unknown as RawDbCertificate[]}
    />
  )
}
