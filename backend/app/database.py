from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# WAL mode: allows concurrent reads during pipeline writes (frontend polling vs background task).
# Also speeds up bulk inserts (no fsync per page).
@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")   # safe with WAL, faster than FULL
    cursor.execute("PRAGMA busy_timeout=10000")   # 10s wait instead of instant LOCKED error
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate_schema() -> None:
    """Add columns to existing SQLite tables (create_all does not alter)."""
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    if "cases" in insp.get_table_names():
        existing = {c["name"] for c in insp.get_columns("cases")}
        alters = [
            ("tracking_id", "VARCHAR"),
            ("current_phase", "VARCHAR DEFAULT 'complaint'"),
            ("phase_substatus", "VARCHAR DEFAULT 'draft'"),
            ("priority", "VARCHAR DEFAULT 'medium'"),
            ("language", "VARCHAR DEFAULT 'en'"),
            ("complaint_id", "VARCHAR"),
            ("dsp_id", "VARCHAR"),
            ("dsp_name", "VARCHAR"),
            ("judicial_outcome", "VARCHAR"),
            ("phase_data", "TEXT"),
        ]
        with engine.begin() as conn:
            for col, col_type in alters:
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE cases ADD COLUMN {col} {col_type}"))

    if "complaints" in insp.get_table_names():
        existing_c = {c["name"] for c in insp.get_columns("complaints")}
        if "complaint_type" not in existing_c:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE complaints ADD COLUMN complaint_type VARCHAR DEFAULT 'initial'"
                ))

    # Backfill phase for legacy cases
    with engine.begin() as conn:
        conn.execute(text(
            "UPDATE cases SET current_phase = 'investigation' "
            "WHERE current_phase IS NULL OR current_phase = ''"
        ))
        conn.execute(text(
            "UPDATE cases SET phase_substatus = 'active' "
            "WHERE phase_substatus IS NULL OR phase_substatus = ''"
        ))


def init_db() -> None:
    from app import models  # noqa: F401 — ensure models are registered
    Base.metadata.create_all(bind=engine)
    _migrate_schema()
