from dataclasses import dataclass
from decimal import Decimal, ROUND_FLOOR, ROUND_CEILING
from typing import Literal

D=Decimal
@dataclass(frozen=True)
class Candle:
    open_time:int; close_time:int; open:D; high:D; low:D; close:D; volume:D=D('0')
    @property
    def range(self): return self.high-self.low
    @property
    def body(self): return abs(self.close-self.open)
    @property
    def upper_wick(self): return self.high-max(self.open,self.close)
    @property
    def lower_wick(self): return min(self.open,self.close)-self.low
    @property
    def body_ratio(self): return D('0') if self.range<=0 else self.body/self.range

Direction=Literal['LONG','SHORT','NEUTRAL']

def floor_step(value:D, step:D)->D:
    return (value/step).to_integral_value(rounding=ROUND_FLOOR)*step

def ceil_step(value:D, step:D)->D:
    return (value/step).to_integral_value(rounding=ROUND_CEILING)*step
