'use client'

import ReCAPTCHA from 'react-google-recaptcha'

interface Props {
  onChange: (token: string | null) => void
}

export function ReCaptchaWidget({ onChange }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ''
  if (!siteKey) return null

  return (
    <ReCAPTCHA
      sitekey={siteKey}
      onChange={onChange}
      onExpired={() => onChange(null)}
      hl="pt-BR"
    />
  )
}
