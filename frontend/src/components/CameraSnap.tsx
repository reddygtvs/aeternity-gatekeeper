import { useRef, useState } from 'react'

export default function CameraSnap({ onImage }: { onImage: (dataUrl: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [snapshot, setSnapshot] = useState<string>('')

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setReady(true)
        setSnapshot('')
      }
    } catch (e) {
      console.error('Camera error:', e)
      alert('Could not access camera. Please check permissions.')
    }
  }

  function snap() {
    const v = videoRef.current!
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    const g = c.getContext('2d')!
    g.drawImage(v, 0, 0)
    const dataUrl = c.toDataURL('image/jpeg', 0.92)
    setSnapshot(dataUrl)
    onImage(dataUrl)

    // Stop video stream
    const stream = v.srcObject as MediaStream
    stream?.getTracks().forEach(track => track.stop())
    setReady(false)
  }

  function retake() {
    setSnapshot('')
    start()
  }

  return (
    <div className="p-3">
      {!snapshot ? (
        <video ref={videoRef} className="rounded-xl w-full" />
      ) : (
        <img src={snapshot} className="rounded-xl w-full" alt="Snapshot" />
      )}
      <div className="mt-2 flex gap-2">
        {!snapshot ? (
          <>
            <button onClick={start} disabled={ready}>
              Enable Camera
            </button>
            <button onClick={snap} disabled={!ready}>
              Snap Photo
            </button>
          </>
        ) : (
          <button onClick={retake}>
            Retake Photo
          </button>
        )}
      </div>
    </div>
  )
}
