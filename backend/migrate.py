"""Create the namespaced B Bot schema on the configured database."""

from sqlalchemy import inspect

from backend.app.config import settings
from backend.app.database import Base, engine
from backend.app import models  # noqa: F401  # register metadata


def main() -> None:
    settings.validate_safety()
    Base.metadata.create_all(engine)
    tables = sorted(name for name in inspect(engine).get_table_names() if name.startswith("bbot_"))
    print(f"B Bot schema ready: {len(tables)} tables")
    for table in tables:
        print(f"- {table}")


if __name__ == "__main__":
    main()
