# 沙袋大白 MVP

把讨厌的东西（照片）变成可以打的沙袋，并和一个大模型扮演的"它"对话。

## 技术栈

| 层 | 技术 | 负责什么 |
| --- | --- | --- |
| 前端 | **React + TypeScript + Vite** | 游戏画面、头像上传、动画、按钮、聊天窗口 |
| 后端 | **Python + FastAPI** | 接收聊天请求、调用大模型、管理对话、限制请求频率 |
| 大模型 | DeepSeek API（无 key 自动降级 mock） | 角色性格、对话上下文、动态台词 |
| 部署 | 前后端分别部署 | 前端静态托管 / 后端 Python 服务器 |

## 目录结构

```
sandbag-dabai/
├── frontend/                 React + TypeScript + Vite
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx           组装：舞台 / 火气条 / 击打栏 / 聊天
│   │   ├── styles.css        全部样式（含四档受伤状态）
│   │   ├── types.ts          类型定义（HitMode / Persona / 各接口返回）
│   │   ├── api.ts            后端接口封装
│   │   ├── hooks/useGame.ts  游戏状态机（hp / 连击 / 击打 / 上传）
│   │   └── components/
│   │       ├── Dabai.tsx     大白本体 + 伤势 + 飘字碎屑
│   │       ├── HitBar.tsx    拳套 / 石块 / 重击
│   │       └── ChatPanel.tsx 气泡 + 输入 + 人格切换
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts        开发时把 /api 代理到 8000
├── backend/                  FastAPI
│   ├── main.py               6 个接口 + 限流 + 留痕
│   ├── llm.py                真模型 / mock 降级
│   ├── requirements.txt
│   └── .env.example
├── demo/punch-demo.html      纯静态可玩版（演示保险，无需后端）
└── docs/decisions.md         设计决策记录
```

## 快速开始

### 1. 后端（终端 A）

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt

# 可选：填 API Key（不填也能跑，自动降级 mock）
copy .env.example .env        # macOS/Linux: cp .env.example .env

python -m uvicorn main:app --reload --port 8000
```

验证：打开 <http://127.0.0.1:8000/docs> 可以直接点着测试所有接口。

### 2. 前端（终端 B）

```bash
cd frontend
npm install
npm run dev
```

打开 <http://127.0.0.1:5173>（手机同 WiFi 可用 `http://<你的IP>:5173`）。

### 3. 生产构建

```bash
cd frontend
npm run build      # 产出 dist/，可直接丢到任何静态托管
npm run preview    # 本地预览构建结果
```

## 接口

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查（会告诉你当前是真模型还是 mock） |
| POST | `/api/session` | 新建会话，返回初始火气值 |
| POST | `/api/upload` | 上传图片，变成"沙袋" |
| POST | `/api/chat` | 和"上传的东西"或"大白"对话（`persona` 区分） |
| POST | `/api/hit` | 记录一次击打（glove / rock / heavy） |
| GET | `/api/state` | 查会话状态（火气值、连击、历史） |

## 玩法数值

| 击打方式 | 伤害 | 设计意图 |
| --- | --- | --- |
| 👊 拳套 glove | 3 | 高频低伤，鼓励连击 |
| 🪨 石块 rock | 10 | 中伤 |
| 💥 重击 heavy | 28 | 一击破防 |

初始火气 100，打到 0 它就彻底服软。受伤分四档：

| 火气 | 视觉 |
| --- | --- |
| 100~86 | 完好 |
| 85~61 | 微肿（一只眼肿、淤青） |
| 60~31 | 鼻青脸肿（双眼肿、绷带、掉牙、鼻血） |
| 30~1 | 哭（眯眼、眼泪、冒烟、肿包） |
| 0 | 打服（XX 眼、转星星、照片裂开变灰） |

## 留痕（logs/）

所有行为写入 JSONL：

| 文件 | 内容 |
| --- | --- |
| logs/session.jsonl | 会话创建 |
| logs/upload.jsonl | 上传记录（文件名、体积） |
| logs/chat.jsonl | 每轮对话（输入、回复、情绪、耗时、当时火气） |
| logs/hit.jsonl | 每次击打（模式、伤害、连击、前后火气） |
| logs/rate.jsonl | 触发限流的记录 |

> logs/ 已在 .gitignore 中（含用户内容，不进仓库）。

## 当前限制（MVP 阶段）

- 会话状态存在内存，重启即清空（后续换 Redis）
- 图片存本地磁盘，未接对象存储
- 击打数值未做真人测试
- 未做登录、未做多人
- 真人照片的合规处理（卡通化/马赛克）尚未实现
