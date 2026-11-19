import type { CSSProperties } from 'react'
import type { Damage, HitMode } from '../types'

interface Props {
  hp: number
  photoUrl: string | null
  damages: Damage[]
  shakes: number
  onHit: () => void
}

/** 受伤阶段：100~86 完好 / 85~61 微肿 / 60~31 鼻青脸肿 / 30~1 哭 / 0 打服 */
function stageClass(hp: number): string {
  if (hp <= 0) return 's4'
  if (hp <= 30) return 's3'
  if (hp <= 60) return 's2'
  if (hp <= 85) return 's1'
  return 's0'
}

const SPARK_COLORS = ['#FF6A3D', '#FFB27A', '#FFD166', '#8d5bd0', '#7fc4f5']

export default function Dabai({ hp, photoUrl, damages, shakes, onHit }: Props) {
  const stage = stageClass(hp)

  return (
    <div className="stage">
      <div
        className={`dabai ${stage} ${shakes > 0 ? 'shake' : ''}`}
        key={`d-${shakes}`}
        onPointerDown={onHit}
        role="button"
        tabIndex={0}
        aria-label="打它"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onHit()
        }}
      >
        <div className="body">
          <div className="mouth" />
          <div className="eye l" />
          <div className="eye r" />
          <div className="blush l" />
          <div className="blush r" />

          <div className="photo">
            {photoUrl ? <img src={photoUrl} alt="沙袋" /> : (
              <div className="hint">
                上传一张
                <br />
                你讨厌的东西
              </div>
            )}
            <div className="crack" />
          </div>

          <div className="bruise b1" />
          <div className="bruise b2" />
          <div className="bruise b3" />
          <div className="bruise b4" />
          <div className="bandage a" />
          <div className="bandage b" />

          <div className="blood bl1" />
          <div className="blood bl2" />
          <div className="blood bl3" />
          <div className="tooth" />
          <div className="bump" />
          <div className="smoke">
            <i />
            <i />
            <i />
          </div>
          <div className="tear l" />
          <div className="tear r" />
          <div className="xx l" />
          <div className="xx r" />
          <div className="stars">
            <i>★</i>
            <i>☆</i>
            <i>★</i>
          </div>
        </div>
      </div>

      {/* 飘伤害数字 */}
      {damages.map((d) => (
        <div
          key={d.id}
          className="dmg"
          style={{ left: `${148 + ((d.id * 37) % 90) - 45}px`, top: `${108 + ((d.id * 53) % 60)}px` }}
        >
          -{d.amount}
        </div>
      ))}

      {/* 碎屑 */}
      {damages.map((d) =>
        Array.from({ length: d.mode === 'heavy' ? 12 : 8 }).map((_, i) => {
          const angle = ((i * 47 + d.id * 31) % 360) * (Math.PI / 180)
          const dist = 40 + ((i * 23) % 80)
          return (
            <div
              key={`${d.id}-${i}`}
              className="spark"
              style={
                {
                  left: `${158 + ((i * 17) % 60)}px`,
                  top: `${126 + ((i * 29) % 60)}px`,
                  background: SPARK_COLORS[i % SPARK_COLORS.length],
                  '--tx': `${Math.cos(angle) * dist}px`,
                  '--ty': `${Math.sin(angle) * dist + 26}px`,
                  animation: 'sparkfly 0.6s cubic-bezier(.2,.7,.3,1) forwards',
                } as CSSProperties
              }
            />
          )
        }),
      )}
    </div>
  )
}

export function modeDamage(mode: HitMode): number {
  return { glove: 3, rock: 10, heavy: 28 }[mode]
}
