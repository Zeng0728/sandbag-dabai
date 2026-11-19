import { useCallback, useEffect, useRef, useState } from 'react'
import ChatPanel from './components/ChatPanel'
import Dabai from './components/Dabai'
import HitBar from './components/HitBar'
import { useGame } from './hooks/useGame'
import { api } from './api'
import type { HealthInfo, HitMode } from './types'

/** 用 WebAudio 合成打击音，不依赖任何素材 */
function thud(strength = 1) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ac = new Ctx()
    const t = ac.currentTime

    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(150 * strength, t)
    o.frequency.exponentialRampToValueAtTime(46, t + 0.16)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.28 * strength, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    o.connect(g).connect(ac.destination)
    o.start(t)
    o.stop(t + 0.24)

    const b = ac.createBufferSource()
    const len = Math.floor(ac.sampleRate * 0.05)
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
    b.buffer = buf
    const g2 = ac.createGain()
    g2.gain.value = 0.16 * strength
    b.connect(g2).connect(ac.destination)
    b.start(t)

    setTimeout(() => void ac.close(), 500)
  } catch {
    /* 静音失败不影响游戏 */
  }
}

export default function App() {
  const { state, hit, upload, reset } = useGame()
  const [mode, setMode] = useState<HitMode>('glove')
  const [photo, setPhoto] = useState<string | null>(null)
  const [targetName, setTargetName] = useState('那个东西')
  const [health, setHealth] = useState<HealthInfo | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [flashKey, setFlashKey] = useState(0)
  const flashRef = useRef<HTMLDivElement>(null)

  // 后端状态（真模型还是 mock）
  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch(() => setHealth(null))
  }, [])

  const doHit = useCallback(
    (m: HitMode) => {
      hit(m)
      thud(m === 'heavy' ? 1.35 : m === 'rock' ? 1.05 : 0.8)
      setFlashKey((k) => k + 1)
      if (navigator.vibrate) navigator.vibrate(18)
    },
    [hit],
  )

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setErr(null)
    // 本地先预览，再上传
    setPhoto(URL.createObjectURL(f))
    setTargetName(f.name.replace(/\.[^.]+$/, '') || '那个东西')
    try {
      const url = await upload(f)
      setPhoto(url)
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : '上传失败（本地预览仍可用）')
    }
  }

  const dmgRatio = Math.max(0, Math.min(1, 1 - state.hp / 100))

  return (
    <div className="app">
      <div className="title">沙 袋 大 白</div>
      <div className="subtitle">把讨厌的东西变成沙袋</div>
      <div className="badge">
        {health ? `后端：${health.llm}　模型：${health.model}` : '后端未连接（仅本地演示）'}
      </div>

      <Dabai
        hp={state.hp}
        photoUrl={photo}
        damages={state.damages}
        shakes={state.shakes}
        onHit={() => doHit(mode)}
      />

      <div className="hpwrap">
        <div className="hphead">
          <span>火气值</span>
          <b>{Math.max(0, Math.round(state.hp))}%</b>
        </div>
        <div className={`hp ${state.cleared ? 'done' : ''}`}>
          <i style={{ width: `${Math.max(0, state.hp)}%` }} />
        </div>
        <div className="combo">
          {state.cleared ? '★ 它服软了 —— 火气清零' : state.combo >= 3 ? `连击 ×${state.combo} 🔥` : ''}
        </div>
      </div>

      <HitBar mode={mode} onSelect={setMode} disabled={state.cleared} />

      <div className="upload">
        <label htmlFor="file">📷 上传一张照片</label>
        <input id="file" type="file" accept="image/*" onChange={(e) => void onFile(e)} />
        <button type="button" onClick={() => { reset(); setPhoto(null); setErr(null) }}>
          ↺ 重来
        </button>
      </div>

      <ChatPanel
        sessionId={state.sessionId}
        targetName={targetName}
        hp={state.hp}
        onHpSync={(hp) => {
          if (hp !== state.hp) reset()
        }}
      />

      {err && <div className="err">{err}</div>}
      {state.error && <div className="err">后端：{state.error}</div>}

      {/* 全屏红闪 */}
      <div
        key={`flash-${flashKey}`}
        className={`flash ${flashKey > 0 ? 'on' : ''}`}
        ref={flashRef}
      />
      {/* 屏边血晕：越打越红 */}
      <div
        className="vig"
        style={{
          boxShadow: `inset 0 0 ${Math.round(30 + dmgRatio * 90)}px rgba(190,50,40,${(dmgRatio * 0.42).toFixed(2)})`,
        }}
      />
    </div>
  )
}
