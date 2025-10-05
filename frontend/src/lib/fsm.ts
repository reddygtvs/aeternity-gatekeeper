import type { Phase, Score } from '../types'

export function nextPhase(turn: number): Phase {
  if (turn < 2) return 'intro'
  if (turn < 5) return 'challenge1'
  if (turn < 8) return 'challenge2'
  if (turn < 10) return 'challenge3'
  if (turn < 12) return 'warm'
  return 'accept'
}

export function shouldAccept(score: Score, turns: number) {
  const total = score.pitch * 0.4 + score.riddle * 0.25 + score.wit * 0.2 + score.fit * 0.15
  return total >= 0.65 || turns >= 12
}
