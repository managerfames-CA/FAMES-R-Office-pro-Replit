from __future__ import annotations

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Bybit Insw Bot (B Bot)"
    environment: str = "demo"
    bybit_rest_url: str = "https://api-demo.bybit.com"
    bybit_public_ws_url: str = "wss://stream.bybit.com/v5/public/linear"
    bybit_private_ws_url: str = "wss://stream-demo.bybit.com/v5/private"
    bybit_api_key: str = ""
    bybit_api_secret: str = ""
    database_url: str = "sqlite:///./data/bbot.db"
    bot_trading_capital: float = 1000.0
    risk_fraction: float = 0.01
    taker_fee_rate_default: float = 0.0006
    max_open_trades: int = 3
    max_leverage: int = 5
    cooldown_hours: int = 4
    timezone: str = "Asia/Dhaka"
    universe_size: int = 50
    universe_refresh_hours: int = 24
    scan_interval_seconds: int = 30
    reconciliation_interval_seconds: int = 15
    frontend_origin: str = "*"
    log_level: str = "INFO"
    app_admin_token: str = ""
    real_mode_enabled: bool = False
    static_dir: str = "artifacts/trading-terminal/dist/public"

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_prefix="",
        case_sensitive=False,
        extra="ignore",
    )

    def validate_safety(self) -> None:
        if self.environment.lower() != "demo":
            raise RuntimeError("B Bot V1 permits Bybit Demo only")
        if self.real_mode_enabled:
            raise RuntimeError("Real mode is disabled in B Bot V1")
        if self.bybit_rest_url.rstrip("/") != "https://api-demo.bybit.com":
            raise RuntimeError("Private REST host must be https://api-demo.bybit.com")
        if not (1 <= self.max_leverage <= 5):
            raise RuntimeError("Maximum leverage must remain within 1x-5x")
        if not (0 < self.risk_fraction <= 0.01):
            raise RuntimeError("Risk fraction cannot exceed 1%")
        if self.max_open_trades != 3:
            raise RuntimeError("B Bot V1 maximum open trades is locked at 3")


settings = Settings()
Path("data").mkdir(exist_ok=True)
