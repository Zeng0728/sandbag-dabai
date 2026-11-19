# 部署指南

前后端**分别部署**，互不依赖。两种方案任选。

---

## 方案 A（推荐）：前端 Vercel + 后端 Render

### 第 1 步：部署后端（Render，免费）

1. 把仓库推到 GitHub（Public 或 Private 都行）
2. 打开 <https://render.com> → 注册（用 GitHub 登录）
3. **New → Blueprint** 或 **New → Web Service**
   - Render 会自动读到根目录的 `render.yaml`（已配好）
   - 若是手动建 Web Service：
     - **Root Directory**: `backend`
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
     - **Instance Type**: Free
4. **Environment Variables** 里填：

   | Key | Value |
   | --- | --- |
   | `DEEPSEEK_API_KEY` | 你的 key（没有就留空，自动走 mock） |
   | `LLM_MODEL` | `deepseek-chat` |
   | `CORS_ORIGINS` | 先填 `*`，前端部署好后再改成前端域名 |

5. 部署完成后拿到地址，形如：
   ```
   https://sandbag-dabai-api.onrender.com
   ```
6. 验证：
   - <https://sandbag-dabai-api.onrender.com/api/health> 返回 JSON
   - 末尾加 `/docs` 能看到接口文档

> ⚠️ Render 免费实例**闲置 15 分钟会休眠**，第一次访问要等 30~60 秒唤醒。

### 第 2 步：部署前端（Vercel，免费）

1. 打开 <https://vercel.com> → 用 GitHub 登录 → **Add New → Project**
2. 选这个仓库，Vercel 会自动读到根目录的 `vercel.json`（已配好）
3. **Environment Variables** 里加一条：

   | Key | Value |
   | --- | --- |
   | `VITE_API_BASE` | 第 1 步拿到的后端地址（**不要带末尾斜杠**） |

4. 点 Deploy，完成后拿到地址：
   ```
   https://sandbag-dabai.vercel.app
   ```

### 第 3 步：回填 CORS

回到 Render 的 Environment，把 `CORS_ORIGINS` 改成前端地址：
```
https://sandbag-dabai.vercel.app
```
保存后 Render 会自动重新部署（约 1 分钟）。

**这一步不做，前端会报 CORS 错误。**

---

## 方案 B：单服务器（后端顺便托管前端）

适合「只想给别人一个链接」的情况。

```bash
cd frontend
npm run build                     # 产出 dist/

cd ../backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

后端会自动检测 `../frontend/dist` 并挂载到 `/`（见 `main.py` 末尾）。
访问 `http://<服务器IP>:8000/` 就是完整应用，**不需要 VITE_API_BASE**。

> Docker 方式：`docker build -t sandbag ./backend && docker run -p 8000:8000 sandbag`

---

## 部署检查清单

| 检查项 | 命令 / 位置 |
| --- | --- |
| 后端活着 | `GET /api/health` → `{"ok":true,...}` |
| 用的是真模型还是 mock | `/api/health` 里的 `llm` 字段 |
| 前端能连后端 | 页面顶部徽章显示「后端：mock / deepseek」 |
| CORS 通 | 浏览器 Console 无 `blocked by CORS policy` |
| 上传能用 | 传一张图，`/api/upload` 返回 200 |
| 留痕在写 | 后端 `logs/*.jsonl` 有新行 |

---

## 常见问题

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 页面能开但一直「后端未连接」 | `VITE_API_BASE` 没配或配错 | 检查 Vercel 环境变量并 **Redeploy** |
| Console 报 CORS | 后端 `CORS_ORIGINS` 没改成前端域名 | Render 里改后自动重启 |
| 第一次打开很慢（30~60s） | Render 免费实例休眠 | 正常，或升级付费实例 |
| 上传 413 / 失败 | 图片超过 5MB | 前端压缩或改后端 `MAX_UPLOAD_BYTES` |
| 重启后会话丢了 | 会话存内存 | MVP 限制，后续接 Redis |
| 部署后图片 404 | 本地磁盘不持久 | 接对象存储（S3/R2）或换持久盘 |

---

## 环境变量一览

### 后端（`backend/.env`）

```env
DEEPSEEK_API_KEY=           # 留空 = 自动降级 mock
LLM_MODEL=deepseek-chat
LLM_BASE_URL=https://api.deepseek.com/chat/completions
PORT=8000
CORS_ORIGINS=*              # 生产填前端域名，逗号分隔
```

### 前端（`frontend/.env`）

```env
VITE_API_BASE=              # 留空 = 同源（方案 B）；分离部署填后端地址
```
