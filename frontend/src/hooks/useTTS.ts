export function useTTS() {
  function speak(text: string) {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported')
      return
    }

    const u = new SpeechSynthesisUtterance(text)

    // Get available voices
    const voices = window.speechSynthesis.getVoices()

    // Try to find a better quality voice
    // Prefer: Samantha, Google US English, Alex, or any English voice that's not default
    const preferredVoice = voices.find(v =>
      v.name.includes('Samantha') ||
      v.name.includes('Google') && v.lang.startsWith('en') ||
      v.name.includes('Alex') ||
      v.name.includes('Daniel') ||
      v.name.includes('Karen')
    ) || voices.find(v => v.lang.startsWith('en-'))

    if (preferredVoice) {
      u.voice = preferredVoice
    }

    u.rate = 0.95  // Slightly slower for clarity
    u.pitch = 1
    u.volume = 1

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }
  return { speak }
}
