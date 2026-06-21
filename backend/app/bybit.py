from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import time
from decimal import Decimal
from urllib.parse import urlencode

import httpx

from .config import settings

D = Decimal


class BybitError(RuntimeError):
    pass


class BybitClient:
    """Small V5 client with bounded retry and deterministic client order IDs."""

    def __init__(self) -> None:
        settings.validate_safety()
        self.base = settings.bybit_rest_url.rstrip("/")
        self.key = settings.bybit_api_key
        self.secret = settings.bybit_api_secret
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(12.0, connect=8.0))
        self._limit = asyncio.Semaphore(8)

    async def close(self) -> None:
        await self.client.aclose()

    def _require_credentials(self) -> None:
        if not self.key or not self.secret:
            raise BybitError("Bybit Demo API credentials are not configured")

    def _get_headers(self, params: dict) -> dict[str, str]:
        self._require_credentials()
        ts = str(int(time.time() * 1000))
        recv = "5000"
        query = urlencode(sorted((k, str(v)) for k, v in params.items() if v is not None))
        sig = hmac.new(
            self.secret.encode(),
            f"{ts}{self.key}{recv}{query}".encode(),
            hashlib.sha256,
        ).hexdigest()
        return {
            "X-BAPI-API-KEY": self.key,
            "X-BAPI-TIMESTAMP": ts,
            "X-BAPI-RECV-WINDOW": recv,
            "X-BAPI-SIGN": sig,
            "Content-Type": "application/json",
        }

    def _post_headers(self, raw: str) -> dict[str, str]:
        self._require_credentials()
        ts = str(int(time.time() * 1000))
        recv = "5000"
        sig = hmac.new(
            self.secret.encode(),
            f"{ts}{self.key}{recv}{raw}".encode(),
            hashlib.sha256,
        ).hexdigest()
        return {
            "X-BAPI-API-KEY": self.key,
            "X-BAPI-TIMESTAMP": ts,
            "X-BAPI-RECV-WINDOW": recv,
            "X-BAPI-SIGN": sig,
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, path: str, params: dict | None = None, body: dict | None = None) -> dict:
        params = params or {}
        for attempt in range(4):
            try:
                async with self._limit:
                    if method == "GET":
                        headers = self._get_headers(params) if path.startswith("/v5/account") or path.startswith("/v5/position") or path.startswith("/v5/order") or path.startswith("/v5/execution") else None
                        response = await self.client.get(self.base + path, params=params, headers=headers)
                    else:
                        raw = json.dumps(body or {}, separators=(",", ":"), sort_keys=True)
                        response = await self.client.post(self.base + path, content=raw, headers=self._post_headers(raw))
                response.raise_for_status()
                data = response.json()
                code = data.get("retCode")
                if code == 0:
                    return data
                if code == 10006 and attempt < 3:
                    await asyncio.sleep(0.5 * (2**attempt))
                    continue
                raise BybitError(f"{path}: {data.get('retMsg')} ({code})")
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                if attempt >= 3:
                    raise BybitError(f"{path}: network failure: {exc}") from exc
                await asyncio.sleep(0.5 * (2**attempt))
        raise BybitError(f"{path}: request failed")

    async def public_get(self, path: str, params: dict | None = None) -> dict:
        # Public endpoints must not require credentials.
        async with self._limit:
            response = await self.client.get(self.base + path, params=params or {})
        response.raise_for_status()
        data = response.json()
        if data.get("retCode") != 0:
            raise BybitError(f"{path}: {data}")
        return data

    async def private_get(self, path: str, params: dict | None = None) -> dict:
        self._require_credentials()
        return await self._request("GET", path, params=params)

    async def private_post(self, path: str, body: dict) -> dict:
        self._require_credentials()
        return await self._request("POST", path, body=body)

    async def server_time(self) -> dict:
        return await self.public_get("/v5/market/time")

    async def instruments(self, cursor: str | None = None) -> dict:
        params = {"category": "linear", "limit": 1000}
        if cursor:
            params["cursor"] = cursor
        return await self.public_get("/v5/market/instruments-info", params)

    async def tickers(self, symbol: str | None = None) -> dict:
        params = {"category": "linear"}
        if symbol:
            params["symbol"] = symbol
        return await self.public_get("/v5/market/tickers", params)

    async def klines(self, symbol: str, interval: str, limit: int = 200) -> dict:
        return await self.public_get(
            "/v5/market/kline",
            {"category": "linear", "symbol": symbol, "interval": interval, "limit": limit},
        )

    async def wallet(self) -> dict:
        return await self.private_get("/v5/account/wallet-balance", {"accountType": "UNIFIED"})

    async def account_info(self) -> dict:
        return await self.private_get("/v5/account/info", {})

    async def fee_rate(self, symbol: str) -> dict:
        return await self.private_get(
            "/v5/account/fee-rate",
            {"category": "linear", "symbol": symbol},
        )

    async def set_margin_mode(self, mode: str = "ISOLATED_MARGIN") -> dict:
        return await self.private_post("/v5/account/set-margin-mode", {"setMarginMode": mode})

    async def positions(self, symbol: str | None = None) -> dict:
        params = {"category": "linear", "settleCoin": "USDT"}
        if symbol:
            params = {"category": "linear", "symbol": symbol}
        return await self.private_get("/v5/position/list", params)

    async def switch_one_way(self, symbol: str | None = None) -> dict:
        body: dict[str, object] = {"category": "linear", "mode": 0}
        if symbol:
            body["symbol"] = symbol
        else:
            body["coin"] = "USDT"
        return await self.private_post("/v5/position/switch-mode", body)

    async def set_auto_add_margin(self, symbol: str, enabled: bool = False) -> dict:
        return await self.private_post(
            "/v5/position/set-auto-add-margin",
            {"category": "linear", "symbol": symbol, "autoAddMargin": 1 if enabled else 0, "positionIdx": 0},
        )

    async def set_leverage(self, symbol: str, leverage: int) -> dict:
        return await self.private_post(
            "/v5/position/set-leverage",
            {
                "category": "linear",
                "symbol": symbol,
                "buyLeverage": str(leverage),
                "sellLeverage": str(leverage),
            },
        )

    async def open_orders(self, symbol: str | None = None, order_link_id: str | None = None, open_only: int = 0) -> dict:
        params: dict[str, object] = {"category": "linear", "settleCoin": "USDT", "openOnly": open_only, "limit": 50}
        if symbol:
            params["symbol"] = symbol
            params.pop("settleCoin", None)
        if order_link_id:
            params["orderLinkId"] = order_link_id
        return await self.private_get("/v5/order/realtime", params)

    async def order_history(self, symbol: str | None = None, order_link_id: str | None = None) -> dict:
        params: dict[str, object] = {"category": "linear", "limit": 50}
        if symbol:
            params["symbol"] = symbol
        if order_link_id:
            params["orderLinkId"] = order_link_id
        return await self.private_get("/v5/order/history", params)

    async def executions(self, order_link_id: str | None = None, symbol: str | None = None, order_id: str | None = None) -> dict:
        params: dict[str, object] = {"category": "linear", "limit": 100}
        if order_id:
            params["orderId"] = order_id
        elif order_link_id:
            params["orderLinkId"] = order_link_id
        elif symbol:
            params["symbol"] = symbol
        return await self.private_get("/v5/execution/list", params)

    async def closed_pnl(self, symbol: str | None = None, limit: int = 100) -> dict:
        params: dict[str, object] = {"category": "linear", "limit": limit}
        if symbol:
            params["symbol"] = symbol
        return await self.private_get("/v5/position/closed-pnl", params)

    async def place_market(
        self,
        symbol: str,
        side: str,
        qty: D,
        order_link_id: str,
        reduce_only: bool = False,
        slippage: str = "0.30",
    ) -> dict:
        return await self.private_post(
            "/v5/order/create",
            {
                "category": "linear",
                "symbol": symbol,
                "side": side,
                "orderType": "Market",
                "qty": str(qty),
                "positionIdx": 0,
                "orderLinkId": order_link_id,
                "reduceOnly": reduce_only,
                "closeOnTrigger": reduce_only,
                "slippageToleranceType": "Percent",
                "slippageTolerance": slippage,
            },
        )

    async def place_conditional_market(
        self,
        symbol: str,
        side: str,
        qty: D,
        trigger_price: D,
        trigger_direction: int,
        order_link_id: str,
    ) -> dict:
        return await self.private_post(
            "/v5/order/create",
            {
                "category": "linear",
                "symbol": symbol,
                "side": side,
                "orderType": "Market",
                "qty": str(qty),
                "triggerPrice": str(trigger_price),
                "triggerDirection": trigger_direction,
                "triggerBy": "MarkPrice",
                "positionIdx": 0,
                "orderLinkId": order_link_id,
                "reduceOnly": True,
                "closeOnTrigger": True,
            },
        )

    async def cancel_order(self, symbol: str, order_id: str | None = None, order_link_id: str | None = None) -> dict:
        body: dict[str, object] = {"category": "linear", "symbol": symbol}
        if order_id:
            body["orderId"] = order_id
        if order_link_id:
            body["orderLinkId"] = order_link_id
        return await self.private_post("/v5/order/cancel", body)
