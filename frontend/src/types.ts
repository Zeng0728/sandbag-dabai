export type HitMode = 'glove' | 'rock' | 'heavy'
export type Persona = 'target' | 'dabai'

export interface HealthInfo {
  ok: boolean
  llm: 'deepseek' | 'mock' | string
  model: string
  sessions: number
  time: string
}

export interface SessionInfo {
  session_id: string
  hp: number
}

export interface UploadResult {
  file_id: string
  url: string
  name: string
  size: number
}

export interface ChatResult {
  reply: string
  mood: string
  ms: number
  hp: number
}

export interface HitResult {
  hp: number
  damage: number
  combo: number
  max_combo: number
  cleared: boolean
}

export interface Damage {
  mode: HitMode
  amount: number
  at: number
  id: number
}

export const MODE_LABEL: Record<HitMode, string> = {
  glove: '拳套',
  rock: '石块',
  heavy: '重击',
}

export const MODE_ICON: Record<HitMode, string> = {
  glove: '👊',
  rock: '🪨',
  heavy: '💥',
}

export const MODE_DAMAGE: Record<HitMode, number> = {
  glove: 3,
  rock: 10,
  heavy: 28,
}