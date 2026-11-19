import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { Damage, HitMode, HitResult } from '../types'

const INITIAL_HP = 100

export interface GameState {
  hp: number
  sessionId: string | null
  damages: Damage[]
  shakes: number
  combo: number
  cleared: boolean
  error: string | null
  ready: boolean
}

export function useGame() {
  const [state, setState] = useState<GameState>({
    hp: INITIAL_HP,
    sessionId: null,
    damages: [],
    shakes: 0,
    combo: 0,
    cleared: false,
    error: null,
    ready: false,
  })
  const seq = useRef(0)

  // 建立会话
  useEffect(() => {
    let cancelled = false
    api
      .createSession()
      .then((s) => {
        if (!cancelled) {
          setState((prev) => ({ ...prev, sessionId: s.session_id, hp: s.hp, ready: true }))
        }
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : '无法连接后端'
        if (!cancelled) setState((prev) => ({ ...prev, error: msg, ready: false }))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 每次击打后清理飘字
  useEffect(() => {
    if (state.damages.length === 0) return
    const t = setTimeout(() => {
      setState((prev) => ({ ...prev, damages: [] }))
    }, 900)
    return () => clearTimeout(t)
  }, [state.damages])

  const hit = useCallback(
    (mode: HitMode) => {
      const sid = state.sessionId
      if (!sid || state.cleared) return

      seq.current += 1
      const id = seq.current
      const amount = { glove: 3, rock: 10, heavy: 28 }[mode]

      // 先本地立即反馈（手感优先），再用服务端返回校准
      setState((prev) => ({
        ...prev,
        hp: Math.max(0, prev.hp - amount),
        shakes: prev.shakes + 1,
        damages: [{ mode, amount, at: Date.now(), id }],
        combo: mode === 'glove' ? prev.combo + 1 : 0,
      }))

      api
        .hit(sid, mode)
        .then((r: HitResult) => {
          setState((prev) => ({
            ...prev,
            hp: r.hp,
            combo: r.combo,
            cleared: r.cleared,
          }))
        })
        .catch(() => {
          /* 网络失败时保留本地状态，避免手感被打断 */
        })
    },
    [state.sessionId, state.cleared],
  )

  const upload = useCallback(
    async (file: File): Promise<string> => {
      const sid = state.sessionId
      if (!sid) throw new Error('会话还没建立')
      const r = await api.upload(sid, file)
      return r.url
    },
    [state.sessionId],
  )

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      hp: INITIAL_HP,
      damages: [],
      shakes: 0,
      combo: 0,
      cleared: false,
    }))
  }, [])

  return { state, hit, upload, reset }
}
