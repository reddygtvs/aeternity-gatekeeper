export interface FormData {
  name: string
  site: string
  about: string
  photo: string
}

export interface Score {
  pitch: number
  riddle: number
  wit: number
  fit: number
}

export type Phase = 'intro' | 'challenge1' | 'challenge2' | 'challenge3' | 'warm' | 'accept'

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}
