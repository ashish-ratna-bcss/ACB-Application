#!/usr/bin/env python3
"""
Migration script to add phase column to documents table.
Run this after updating models.py with the phase field.
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "acb_documents.db"

def add_phase_column():
    """Add phase column to documents and sub_documents tables if they don't exist."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check and add phase to documents table
        cursor.execute("PRAGMA table_info(documents)")
        doc_columns = [col[1] for col in cursor.fetchall()]

        if "phase" not in doc_columns:
            print("Adding phase column to documents table...")
            cursor.execute("ALTER TABLE documents ADD COLUMN phase VARCHAR DEFAULT NULL")
            print("✓ phase column added to documents")
        else:
            print("✓ phase column already exists in documents")

        # Check and add phase to sub_documents table
        cursor.execute("PRAGMA table_info(sub_documents)")
        subdoc_columns = [col[1] for col in cursor.fetchall()]

        if "phase" not in subdoc_columns:
            print("Adding phase column to sub_documents table...")
            cursor.execute("ALTER TABLE sub_documents ADD COLUMN phase VARCHAR DEFAULT NULL")
            print("✓ phase column added to sub_documents")
        else:
            print("✓ phase column already exists in sub_documents")

        conn.commit()
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    finally:
        conn.close()

    return True

if __name__ == "__main__":
    if DB_PATH.exists():
        success = add_phase_column()
        if success:
            print("\nMigration complete!")
    else:
        print(f"Database not found at {DB_PATH}")
        print("It will be created automatically when the app starts.")
