import { useState } from 'react'
import CameraSnap from './CameraSnap'
import type { FormData } from '../types'

export default function FormCard({ onReady }: { onReady: (f: FormData) => void }) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    site: '',
    about: '',
    photo: ''
  })

  const handleSubmit = () => {
    if (!formData.name || !formData.photo) {
      alert('Please provide at least your name and photo')
      return
    }
    onReady(formData)
  }

  return (
    <div className="p-4 border rounded-xl max-w-xl">
      <h2 className="text-2xl font-bold mb-4">Æternity Gatekeeper</h2>
      <input
        className="input"
        placeholder="Your name"
        onChange={e => setFormData({ ...formData, name: e.target.value })}
      />
      <input
        className="input"
        placeholder="Website or what you do"
        onChange={e => setFormData({ ...formData, site: e.target.value })}
      />
      <textarea
        className="input"
        placeholder="Describe what you do (1 line)"
        onChange={e => setFormData({ ...formData, about: e.target.value })}
      ></textarea>
      <CameraSnap onImage={(u) => setFormData({ ...formData, photo: u })} />
      <button onClick={handleSubmit} className="btn-primary mt-4">
        Start
      </button>
    </div>
  )
}
