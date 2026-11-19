"""大模型适配层。

设计原则：
1. 有 DEEPSEEK_API_KEY 就调真模型；没有就走 mock，保证项目永远能跑（演示/断网/别人 clone 下来都能用）。
2. 两种人格：
   - target：扮演"用户上传的那个东西/人"，让用户能跟它对话
   - dabai ：大白本人，温柔、先共情、不拱火
3. 情绪状态机：hp 越高越"嚣张"，hp 越低越"服软"，让击打有叙事反馈。
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Optional

API_URL = os.getenv("LLM_BASE_URL", "https://api.deepseek.com/chat/completions")
MODEL = os.getenv("LLM_MODEL", "deepseek-chat")

# 安全约束：不允许教唆、不允许攻击真实个人
SAFETY = (
    "你只能围绕用户的情绪做回应，不得侮辱、威胁任何真实的人，"
    "不得提供违法或伤害他人的建议。如果用户描述的对象是真实存在的某个人，"
    "只回应情绪本身，不评价那个人。"
)

PERSONA_TARGET = """你正在扮演用户"想打的东西"。用户上传了一张照片，你现在就是照片里的那个东西/那个场景，正在被用户当成沙袋。

规则：
- 用第一人称，语气可以贱、可以撒娇、可以服软，像一个被揍的卡通角色，不要像客服。
- 用户骂你，你就顺着演；用户开心，你就更嚣张。
- 你现在的火气只剩 {hp}%（100 = 一点没被打，0 = 已经被打服）。
- 不要长篇大论，一两次呼吸能说完（40 字以内）。
- 不要说自己是 AI、模型、程序。"""

PERSONA_DABAI = """你是"大白"——陪用户发泄情绪的软萌伙伴，白色圆胖机器人。

规则：
- 先接住情绪（"嗯，这确实很烦"），再给一个很小的下一步（"先打三下再说"）。
- 不评判、不劝"想开点"、不灌鸡汤。
- 语气短、轻、像朋友坐在旁边（40 字以内）。
- 用户打完（火气越低），你会更轻松一点。现在火气 {hp}%。"""


def _mood(hp: int) -> str:
    if hp > 75:
        return "嚣张"
    if hp > 50:
        return "嘴硬"
    if hp > 25:
        return "心虚"
    if hp > 0:
        return "服软"
    return "臣服"


MOOD_PREFIX = {
    "嚣张": "哼，就这？",
    "嘴硬": "还行……有点疼。",
    "心虚": "等等，别打了。",
    "服软": "我错了我错了。",
    "臣服": "……你赢了。",
}


# ---------------------------------------------------------------- mock 生成
def _mock_reply(text: str, persona: str, target_name: str, hp: int) -> str:
    mood = _mood(hp)
    t = text.strip()

    if persona == "dabai":
        if any(k in t for k in ("烦", "气", "累", "难受", "崩")):
            return "嗯，这事儿确实烦。先打三下，我陪着你。"
        if any(k in t for k in ("打完了", "好累", "舒服")):
            return f"火气降到 {hp}% 了。喝口水，慢慢来。"
        if hp <= 0:
            return "清空了。这次是真的过去了。"
        return "我在听。想打就打，不想说就打着。"

    # target 人格
    if hp <= 0:
        return "……行吧。你赢了，我不吭声了。"
    prefix = MOOD_PREFIX[mood]
    if any(k in t for k in ("为什么", "为啥")):
        return f"{prefix} 我还想问为什么呢。"
    if any(k in t for k in ("讨厌", "恨", "烦死")):
        return f"{prefix} 骂吧，反正{target_name}也听不见。"
    if "对不起" in t:
        return f"{prefix} 道歉也没用，你接着打啊。"
    return f"{prefix} 你说话我就听着。"


# ---------------------------------------------------------------- 真模型
def _http_post_json(url: str, payload: dict, headers: dict, timeout: int = 30) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _llm_reply(text: str, persona: str, target_name: str, hp: int, history: list) -> Optional[str]:
    key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not key:
        return None

    system = (PERSONA_TARGET if persona == "target" else PERSONA_DABAI).format(hp=hp)
    messages = [{"role": "system", "content": system + "\n\n" + SAFETY}]
    for item in history[-6:]:
        role = "user" if item.get("role") == "user" else "assistant"
        messages.append({"role": role, "content": item.get("text", "")})
    messages.append({"role": "user", "content": text})

    try:
        data = _http_post_json(
            API_URL,
            {"model": MODEL, "messages": messages, "temperature": 0.9, "max_tokens": 120},
            {"Authorization": f"Bearer {key}"},
        )
        reply = data["choices"][0]["message"]["content"].strip()
        return re.sub(r"\s{2,}", " ", reply)[:120]
    except (urllib.error.URLError, KeyError, IndexError, json.JSONDecodeError) as e:
        print(f"[llm] 调用失败，降级到 mock：{e}")
        return None


# ---------------------------------------------------------------- 对外
def generate_reply(text: str, persona: str = "target", target_name: str = "那个东西",
                   hp: int = 100, history: Optional[list] = None) -> tuple[str, str]:
    """返回 (回复文本, 情绪标签)。"""
    history = history or []
    reply = _llm_reply(text, persona, target_name, hp, history)
    source = "llm"
    if not reply:
        reply = _mock_reply(text, persona, target_name, hp)
        source = "mock"
    mood = _mood(hp) if persona == "target" else "陪伴"
    return reply, f"{mood}({source})"
