import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const keyHex = process.env.BOT_TOKEN_ENCRYPTION_KEY ?? ''
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('BOT_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(keyHex, 'hex')
}

export function encryptToken(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptToken(value: string): string {
  if (!value.startsWith('enc:')) return value // backward compat: plain-text legacy token
  const parts = value.split(':')
  const ivHex  = parts[1]
  const tagHex = parts[2]
  const ctHex  = parts[3]
  const key = getKey()
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(ctHex, 'hex')).toString('utf8') + decipher.final('utf8')
}
