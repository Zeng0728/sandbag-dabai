import type {
  ChatResult, HealthInfo, HitMode, HitResult, Persona, SessionInfo, UploadResult,
} from './types'

/**
 * 后端地址：
 *  - 开发时留空（走 vite 代理到 127.0.0.1:8000）
 *  - 分离部署时在 .env 里设 VITE_API_BASE=https://your-api.onrender.com
 */
const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ?? ''

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      /* 忽略解析失败 */
    }
    throw new Error(detail)
  }
  return (await res.json()) as T
}

export const api = {
  health: () => jsonFetch<HealthInfo>('/api/health'),

  createSession: () => jsonFetch<SessionInfo>('/api/session', { method: 'POST' }),

  upload: (sessionId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('session_id', sessionId)
    return jsonFetch<UploadResult>('/api/upload', { method: 'POST', body: form })
  },

  chat: (sessionId: string, text: string, persona: Persona, targetName: string) =>
    jsonFetch<ChatResult>('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        text,
        persona,
        target_name: targetName,
      }),
    }),

  hit: (sessionId: string, mode: HitMode) =>
    jsonFetch<HitResult>('/api/hit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, mode }),
    }),
}