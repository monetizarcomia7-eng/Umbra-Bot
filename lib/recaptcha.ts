export async function verifyRecaptchaToken(token: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY
  // Se a chave não estiver configurada (dev sem recaptcha), não bloqueia
  if (!secret) return true

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }).toString(),
  })
  const data = await res.json() as { success: boolean }
  return data.success === true
}
