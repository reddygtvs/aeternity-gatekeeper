import { useEffect, useState } from 'react'
import { makeQR } from '../lib/qr'

interface BadgeProps {
  name: string
  tagline: string
  portrait: string
  verifyUrl: string
  score: number
}

export default function Badge({ name, tagline, portrait, verifyUrl, score }: BadgeProps) {
  const [qr, setQr] = useState('')

  useEffect(() => {
    makeQR(verifyUrl).then(setQr)
  }, [verifyUrl])

  return (
    <div className="p-4 border rounded-xl w-[360px] bg-white shadow-lg">
      <img src={portrait} className="w-full rounded-xl" alt="Portrait" />
      <div className="mt-2 font-bold text-lg">{name}</div>
      <div className="opacity-80 text-sm">{tagline}</div>
      <div className="mt-1 text-sm">Score: {(score * 100).toFixed(0)}</div>
      <div className="mt-2 flex items-center gap-2">
        {qr && <img src={qr} className="w-28" alt="QR Code" />}
        <button onClick={() => window.print()} className="ml-auto">
          Print Badge
        </button>
      </div>
    </div>
  )
}
