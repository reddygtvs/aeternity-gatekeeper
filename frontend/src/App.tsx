import { useState } from 'react'
import FormCard from './components/FormCard'
import Gatekeeper from './components/Gatekeeper'
import type { FormData } from './types'

export default function App() {
  const [f, setF] = useState<FormData | null>(null)
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {!f ? <FormCard onReady={setF} /> : <Gatekeeper form={f} />}
    </div>
  )
}
