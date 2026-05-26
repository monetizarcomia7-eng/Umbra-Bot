'use client'
import { useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'

export default function ConnectButton({ disabled }: { disabled?: boolean }) {
  const [loading, setLoading] = useState(false)

  function handleConnect() {
    if (disabled) return
    setLoading(true)
    window.location.href = '/api/auth/instagram/connect'
  }

  return (
    <button
      onClick={handleConnect}
      disabled={disabled || loading}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
      style={{
        background: 'linear-gradient(135deg, #833AB4 0%, #FD1D1D 50%, #FCAF45 100%)',
        color:      '#fff',
      }}
      title={disabled ? 'Integração Meta não configurada' : 'Conectar uma conta Instagram Business'}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
      {loading ? 'Conectando…' : 'Conectar Instagram'}
    </button>
  )
}
