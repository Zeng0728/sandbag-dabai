"""沙袋大白 · 后端 MVP

接口：
  GET  /api/health          健康检查
  POST /api/session         新建会话
  POST /api/upload          上传图片（变成"沙袋"）
  POST /api/chat            和"上传的东西"或"大白"对话（大模型 / mock 降级）
  POST /api/hit             记录一次击打
  GET  /api/state           查当前会话状态（火气值、历史）

所有请求都会写进 logs/*.jsonl（留痕）。
"""
from __future__ import annotations

import json
import os
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from llm import generate_reply

BASE = Path(__file__).parent
UPLOAD_DIR = BASE / "storage" / "uploads"
LOG_DIR = BASE / "logs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024      # 5MB
RATE_LIMIT = 20                          # 每分钟每 IP 最多 20 次 /api 请求

app = FastAPI(title="沙袋大白 API", version="0.1.0")

# CORS：生产环境用 CORS_ORIGINS 指定前端域名（逗号分隔），留空=允许所有
_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------- .env 读取（无额外依赖）
def _load_dotenv() -> None:
    """读取同目录下的 .env；已存在的环境变量优先，不会被覆盖。"""
    p = Path(__file__).parent / ".env"
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()

# ---------------------------------------------------------------- 留痕
def _now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def log_event(stream: str, payload: dict) -> None:
    """把一条事件追加到 logs/<stream>.jsonl。"""
    record = {"ts": _now(), **payload}
    path = LOG_DIR / f"{stream}.jsonl"
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


# ---------------------------------------------------------------- 会话状态（内存版，MVP 够用）
SESSION_HITS = 100         # 初始火气值（与前端四档视觉对齐）
DAMAGE = {"glove": 3, "rock": 10, "heavy": 28}
SESSIONS: dict[str, dict] = {}


def new_session() -> dict:
    sid = uuid.uuid4().hex[:12]
    SESSIONS[sid] = {
        "id": sid,
        "created": _now(),
        "hp": SESSION_HITS,
        "hits": 0,
        "combo": 0,
        "max_combo": 0,
        "uploads": [],
        "persona": "",
        "history": [],
    }
    log_event("session", {"action": "create", "session": sid})
    return SESSIONS[sid]


def get_session(sid: str) -> dict:
    s = SESSIONS.get(sid)
    if not s:
        raise HTTPException(status_code=404, detail="会话不存在，请先调用 /api/session")
    return s


# ---------------------------------------------------------------- 限流（每 IP 每分钟 N 次）
_BUCKETS: dict[str, list[float]] = {}


def check_rate(ip: str) -> None:
    now = time.time()
    window = [t for t in _BUCKETS.get(ip, []) if now - t < 60]
    if len(window) >= RATE_LIMIT:
        log_event("rate", {"ip": ip, "action": "blocked", "count": len(window)})
        raise HTTPException(status_code=429, detail=f"请求太频繁（每分钟最多 {RATE_LIMIT} 次）")
    window.append(now)
    _BUCKETS[ip] = window


@app.middleware("http")
async def rate_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        client = request.client.host if request.client else "unknown"
        try:
            check_rate(client)
        except HTTPException as e:
            return JSONResponse(status_code=e.status_code, content={"detail": e.detail})
    return await call_next(request)


# ---------------------------------------------------------------- 接口
@app.get("/api/health")
def health():
    key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    return {
        "ok": True,
        "llm": "deepseek" if key else "mock",
        "model": os.getenv("LLM_MODEL", "deepseek-chat"),
        "sessions": len(SESSIONS),
        "time": _now(),
    }


@app.post("/api/session")
def create_session():
    s = new_session()
    return {"session_id": s["id"], "hp": s["hp"]}


@app.post("/api/upload")
async def upload(file: UploadFile = File(...), session_id: str = Form(...)):
    s = get_session(session_id)

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"只支持 {', '.join(sorted(ALLOWED_EXT))}")

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="图片不能超过 5MB")
    if not data:
        raise HTTPException(status_code=400, detail="文件是空的")

    fid = uuid.uuid4().hex[:12] + ext
    (UPLOAD_DIR / fid).write_bytes(data)

    item = {"file_id": fid, "url": f"/storage/uploads/{fid}", "name": file.filename, "size": len(data)}
    s["uploads"].append(item)
    log_event("upload", {"session": s["id"], **item})
    return item


@app.post("/api/chat")
def chat(payload: dict):
    sid = payload.get("session_id", "")
    text = (payload.get("text") or "").strip()
    persona = payload.get("persona") or "target"      # target=上传的东西 / dabai=大白
    target_name = payload.get("target_name") or "那个东西"

    if not text:
        raise HTTPException(status_code=400, detail="说点什么吧")
    if len(text) > 500:
        raise HTTPException(status_code=400, detail="一次最多 500 字")

    s = get_session(sid)
    started = time.time()
    reply, mood = generate_reply(
        text=text,
        persona=persona,
        target_name=target_name,
        hp=s["hp"],
        history=s["history"][-6:],
    )
    elapsed = round((time.time() - started) * 1000)

    s["history"].append({"role": "user", "text": text, "ts": _now()})
    s["history"].append({"role": "assistant", "text": reply, "ts": _now()})
    log_event("chat", {
        "session": s["id"], "persona": persona, "target": target_name,
        "text": text, "reply": reply, "mood": mood, "hp": s["hp"], "ms": elapsed,
    })
    return {"reply": reply, "mood": mood, "ms": elapsed, "hp": s["hp"]}


@app.post("/api/hit")
def hit(payload: dict):
    sid = payload.get("session_id", "")
    mode = payload.get("mode", "glove")
    if mode not in DAMAGE:
        raise HTTPException(status_code=400, detail=f"未知击打方式：{mode}")

    s = get_session(sid)
    before = s["hp"]
    s["hp"] = max(0, s["hp"] - DAMAGE[mode])
    s["hits"] += 1
    s["combo"] = s["combo"] + 1 if mode == "glove" else 0
    s["max_combo"] = max(s["max_combo"], s["combo"])

    log_event("hit", {
        "session": s["id"], "mode": mode, "damage": DAMAGE[mode],
        "hp_before": before, "hp_after": s["hp"], "combo": s["combo"],
    })
    return {
        "hp": s["hp"],
        "damage": DAMAGE[mode],
        "combo": s["combo"],
        "max_combo": s["max_combo"],
        "cleared": s["hp"] == 0,
    }


@app.get("/api/state")
def state(session_id: str):
    s = get_session(session_id)
    return {
        "session_id": s["id"],
        "hp": s["hp"],
        "hits": s["hits"],
        "max_combo": s["max_combo"],
        "uploads": s["uploads"],
        "history": s["history"][-20:],
    }


# ---------------------------------------------------------------- 静态资源
app.mount("/storage", StaticFiles(directory=str(BASE / "storage")), name="storage")

FRONTEND_DIST = BASE.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
