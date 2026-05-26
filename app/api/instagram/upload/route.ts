import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

const ALLOWED_TYPES = new Set<string>([
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4',  'video/quicktime',
])

const MAX_IMAGE = 8  * 1024 * 1024     // 8 MB
const MAX_VIDEO = 500 * 1024 * 1024   // 500 MB

// POST /api/instagram/upload  (multipart/form-data: file)
// Faz upload para o bucket Supabase Storage 'instagram-medias'
// Estrutura de pastas: {user_id}/{uuid}.{ext}
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const rl = await rateLimit(`ig-upload:${user.id}`, 30, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'Muitos uploads. Aguarde 1 minuto.' }, { status: 429 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Multipart inválido.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 400 })

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Tipo de arquivo não suportado.' }, { status: 400 })
  }

  const isVideo = file.type.startsWith('video/')
  const maxSize = isVideo ? MAX_VIDEO : MAX_IMAGE
  if (file.size > maxSize) {
    return NextResponse.json({
      error: `Arquivo muito grande. Máx ${isVideo ? '500 MB (vídeo)' : '8 MB (imagem)'}.`,
    }, { status: 400 })
  }

  const ext = file.type.split('/')[1].replace('quicktime', 'mov')
  const uuid = crypto.randomUUID()
  const path = `${user.id}/${uuid}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('instagram-medias')
    .upload(path, file, {
      contentType:   file.type,
      cacheControl:  '3600',
      upsert:        false,
    })

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('instagram-medias')
    .getPublicUrl(path)

  return NextResponse.json({
    url:      publicUrl,
    path,
    size:     file.size,
    type:     file.type,
    isVideo,
  })
}
