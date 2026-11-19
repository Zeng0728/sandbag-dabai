import { useState } from 'react'
import { api } from '../api'
import type { Persona } from '../types'

interface Props {
  sessionId: string | null
  targetName: string
  hp: number
  onHpSync: (hp: number) => void
}

const PERSONA_LABEL: Record<Persona, string> = {
  target: '打的那个东西',
  dabai: '大白',
}

export default function ChatPanel({ sessionId, targetName, hp, onHpSync }: Props) {
  const [persona, setPersona] = useState<Persona>('target')
  const [text, setText] = useState('')
  const [reply, setReply] = useState('你上传的那张照片，就是你今天要打的东西。')
  const [mood, setMood] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    const v = text.trim()
    if (!v || !sessionId || busy) return
    setBusy(true)
    setError(null)
    setText('')
    try {
      const r = await api.chat(sessionId, v, persona, targetName)
      setReply(r.reply)
      setMood(r.mood)
      onHpSync(r.hp)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '发送失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="talk">
      <div className="bubble">
        <div className="who">
          <span>{persona === 'target' ? (targetName || '它') : '大白'} 说</span>
          <span className="tabs">
            {(['target', 'dabai'] as Persona[]).map((p) => (
              <button
                key={p}
                type="button"
                className={persona === p ? 'on' : ''}
                onClick={() => setPersona(p)}
              >
                {PERSONA_LABEL[p]}
              </button>
            ))}
          </span>
        </div>
        <div>{reply}</div>
        {mood && <div style={{ fontSize: 10.5, color: '#b09a89', marginTop: 6 }}>情绪：{mood}</div>}
      </div>

      <div className="row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send()
          }}
          placeholder={`跟${persona === 'target' ? '它' : '大白'}说两句…`}
          maxLength={60}
          disabled={!sessionId || busy}
        />
        <button type="button" onClick={() => void send()} disabled={!sessionId || busy}>
          {busy ? '…' : '发送'}
        </button>
      </div>

      {error && <div className="err">{error}</div>}
      <div className="tip">
        👊 连点最快　🪨 伤害中等　💥 一下破防（-28）<br />
        打到 0%，它就彻底服软了　·　当前火气 {Math.max(0, Math.round(hp))}%
      </div>
    </div>
  )
}
