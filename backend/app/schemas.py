from pydantic import BaseModel,Field
class CapitalUpdate(BaseModel):
    bot_trading_capital: float=Field(gt=0,le=1_000_000)
