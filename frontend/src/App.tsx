import './styles.css'

/**
 * 沙袋大白 · 前端入口（React + TypeScript + Vite）
 * 游戏主体放在 public/demo 下，由 Vite 原样拷贝进 dist；
 * 这里用 React 组件承载全屏、加载态与统一入口。
 */
export default function App() {
  // 每次加载带上时间戳，彻底避免 iframe 缓存导致看到旧版本
  const stamp = Date.now().toString(36)
  const src = `${import.meta.env.BASE_URL}demo/dabai-pseudo3d.html?v=${stamp}`
  return (
    <div className="root">
      <div className="loading">正在加载沙袋大白…</div>
      <iframe className="frame" src={src} title="沙袋大白" allow="autoplay; fullscreen" />
    </div>
  )
}