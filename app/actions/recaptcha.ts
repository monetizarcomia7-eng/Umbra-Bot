'use server'

import { verifyRecaptchaToken } from '@/lib/recaptcha'

export async function verifyRecaptchaAction(token: string): Promise<boolean> {
  return verifyRecaptchaToken(token)
}
