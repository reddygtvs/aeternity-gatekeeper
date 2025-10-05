import { useRef } from 'react'

export function useSTT() {
  const recognitionRef = useRef<any>(null)
  const isListeningRef = useRef(false)

  function start(onTranscript: (text: string) => void) {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition

    if (!SpeechRecognition) {
      alert('Speech recognition not supported')
      return
    }

    // Stop any existing recognition
    stop()

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = true

    let transcript = ''

    recognition.onresult = (event: any) => {
      if (!isListeningRef.current) return

      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          transcript += text + ' '
        } else {
          interim += text
        }
      }
      onTranscript((transcript + interim).trim())
    }

    recognition.onerror = (event: any) => {
      console.error('STT error:', event.error)
    }

    recognition.onend = () => {
      isListeningRef.current = false
    }

    recognitionRef.current = recognition
    isListeningRef.current = true
    recognition.start()
  }

  function stop() {
    isListeningRef.current = false
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
  }

  return { start, stop }
}
