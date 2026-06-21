from decimal import Decimal as D
from app.domain import Candle
from app.strategy import bullish_engulfing,bearish_engulfing,bullish_rejection,bearish_rejection,swing_high,swing_low,trend

def c(o,h,l,cl,t=0):return Candle(t,t+1,D(str(o)),D(str(h)),D(str(l)),D(str(cl)))
def test_bullish_engulfing(): assert bullish_engulfing(c(10,10.2,8.8,9),c(8.9,10.5,8.7,10.2))
def test_bearish_engulfing(): assert bearish_engulfing(c(9,10.2,8.8,10),c(10.1,10.3,8.5,8.8))
def test_rejection_symmetry():
    assert bullish_rejection(c(9.7,10,8,9.9),D('.01'))
    assert bearish_rejection(c(10.1,12,9.8,9.9),D('.01'))
def test_swing_strict_equality_fails():
    xs=[c(1,2,1,1.5),c(1,3,1,2),c(1,5,1,2),c(1,4,1,2),c(1,3,1,2)]
    assert swing_high(xs,2)
    xs[1]=c(1,5,1,2);assert not swing_high(xs,2)
def test_trend(): assert trend(D('2'),D('1'),D('.01'))=='LONG' and trend(D('1'),D('2'),D('.01'))=='SHORT'
