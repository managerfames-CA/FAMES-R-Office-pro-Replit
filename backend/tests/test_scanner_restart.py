from app.database import Base,engine,SessionLocal
from app.models import SystemConfig
from app.services import get_config

def test_scanner_can_be_forced_stopped_on_restart():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        c=get_config(db);c.scanner_state='RUNNING';db.commit();c.scanner_state='STOPPED';db.commit();assert db.get(SystemConfig,1).scanner_state=='STOPPED'
