from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import time
from collections.abc import Awaitable, Callable

import websockets

from .config import settings

MessageHandler = Callable[[dict], Awaitable[None]]


class BybitWebSocketService:
    """Reconnect-capable V5 stream client; REST reconciliation remains authoritative."""

    def __init__(self, handler: MessageHandler):
        self.handler = handler
        self.stop_event = asyncio.Event()

    async def _run(self, url: str, topics: list[str], private: bool = False) -> None:
        backoff = 1
        while not self.stop_event.is_set():
            try:
                async with websockets.connect(url, ping_interval=20, ping_timeout=10, close_timeout=5) as socket:
                    if private:
                        expires = int((time.time() + 10) * 1000)
                        signature = hmac.new(
                            settings.bybit_api_secret.encode(),
                            f"GET/realtime{expires}".encode(),
                            hashlib.sha256,
                        ).hexdigest()
                        await socket.send(json.dumps({"op": "auth", "args": [settings.bybit_api_key, expires, signature]}))
                    await socket.send(json.dumps({"op": "subscribe", "args": topics}))
                    await self.handler({"topic": "system.websocket", "type": "connected", "private": private})
                    backoff = 1
                    async for raw in socket:
                        await self.handler(json.loads(raw))
                        if self.stop_event.is_set():
                            break
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                await self.handler({"topic": "system.websocket", "type": "error", "error": str(exc), "private": private})
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30)

    async def run_public(self) -> None:
        await self._run(settings.bybit_public_ws_url, ["tickers.BTCUSDT"], False)

    async def run_private(self) -> None:
        if not settings.bybit_api_key or not settings.bybit_api_secret:
            return
        await self._run(settings.bybit_private_ws_url, ["order", "execution", "position", "wallet"], True)

    def stop(self) -> None:
        self.stop_event.set()
