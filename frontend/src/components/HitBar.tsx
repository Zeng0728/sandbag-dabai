import { MODE_DAMAGE, MODE_ICON, MODE_LABEL, type HitMode } from '../types'

interface Props {
  mode: HitMode
  onSelect: (m: HitMode) => void
  disabled?: boolean
}

const MODES: HitMode[] = ['glove', 'rock', 'heavy']

export default function HitBar({ mode, onSelect, disabled }: Props) {
  return (
    <div className="acts">
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          className={`act ${mode === m ? 'on' : ''}`}
          onClick={() => onSelect(m)}
          disabled={disabled}
        >
          <span>{MODE_ICON[m]}</span>
          {MODE_LABEL[m]}
          <small>-{MODE_DAMAGE[m]}</small>
        </button>
      ))}
    </div>
  )
}
