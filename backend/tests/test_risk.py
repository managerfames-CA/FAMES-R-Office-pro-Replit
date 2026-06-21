from decimal import Decimal as D
from app.risk import size_position,stop_distance_valid,split_quantity,select_leverage

def test_risk_basis_is_minimum():
    r=size_position(D('1000'),D('5000'),D('100'),D('98'),D('.01'),D('1000'))
    assert r.risk_basis==D('1000') and r.max_risk==D('10')
def test_stop_distance_bounds():
    assert stop_distance_valid(D('100'),D('99.8')) is None
    assert stop_distance_valid(D('100'),D('99.81'))=='REJECT_STOP_BELOW_MIN_DISTANCE'
    assert stop_distance_valid(D('100'),D('97')) is None
    assert stop_distance_valid(D('100'),D('96.99'))=='REJECT_STOP_ABOVE_MAX_DISTANCE'
def test_leverage_lowest_affordable(): assert select_leverage(D('1000'),D('600'),D('10'))==2
def test_split_residual_to_runner():
    a,b,r=split_quantity(D('10'),D('1'),D('1'),D('1'),D('100'))
    assert a==5 and b==3 and r==2
def test_small_runner_merged_tp2():
    a,b,r=split_quantity(D('10'),D('1'),D('1'),D('300'),D('100'))
    assert r==0 and a+b==D('10')
