from app.services import classify_full_risk_loss

def test_only_full_risk_counts():
    assert classify_full_risk_loss(-9,10)
    assert not classify_full_risk_loss(-8.99,10)
    assert not classify_full_risk_loss(-0.1,10)
    assert not classify_full_risk_loss(1,10)
