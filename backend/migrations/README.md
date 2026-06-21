# B Bot schema initialization

B Bot V1.1 uses new `bbot_*` table names to avoid altering the previous Replit app tables.

The application calls `Base.metadata.create_all()` at startup. The same operation can be run explicitly with:

```bash
python -m backend.migrate
```

This release is a new namespaced baseline. Future column/table changes should use versioned Alembic migrations rather than relying on `create_all()`.
