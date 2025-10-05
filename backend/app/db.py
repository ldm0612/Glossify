import os
import json
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

DB_PATH = os.environ.get("GLOSSIFY_DB_PATH", os.path.join(os.path.dirname(__file__), "glossify.db"))


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            avatar_url TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS papers (
            paper_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            domain_tags TEXT,
            glossary TEXT,
            text TEXT,
            file_path TEXT,
            pages INTEGER,
            file_size INTEGER,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """
    )
    conn.commit()
    conn.close()


def create_user(user_id: str, name: str, avatar_url: Optional[str] = None) -> Dict[str, Any]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users (id, name, avatar_url, created_at) VALUES (?, ?, ?, ?)",
        (user_id, name, avatar_url, datetime.utcnow().isoformat()),
    )
    conn.commit()
    conn.close()
    return {"id": user_id, "name": name, "avatar_url": avatar_url}


def list_users() -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, name, avatar_url, created_at FROM users ORDER BY created_at ASC")
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def upsert_paper(
    paper_id: str,
    user_id: str,
    title: str,
    domain_tags: Optional[List[str]],
    glossary: Optional[Dict[str, str]],
    text: str,
    file_path: Optional[str],
    pages: Optional[int],
    file_size: Optional[int],
) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO papers (paper_id, user_id, title, domain_tags, glossary, text, file_path, pages, file_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(paper_id) DO UPDATE SET
            title=excluded.title,
            domain_tags=excluded.domain_tags,
            glossary=excluded.glossary,
            text=excluded.text,
            file_path=excluded.file_path,
            pages=excluded.pages,
            file_size=excluded.file_size
        """,
        (
            paper_id,
            user_id,
            title,
            json.dumps(domain_tags or []),
            json.dumps(glossary or {}),
            text,
            file_path,
            pages,
            file_size,
            datetime.utcnow().isoformat(),
        ),
    )
    conn.commit()
    conn.close()


def get_paper_meta(paper_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM papers WHERE paper_id = ?", (paper_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def list_papers(user_id: str) -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT paper_id, title, file_size, pages, created_at FROM papers WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,),
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_paper(paper_id: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM papers WHERE paper_id = ?", (paper_id,))
    conn.commit()
    conn.close()


def get_user_papers_with_paths(user_id: str) -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT paper_id, file_path FROM papers WHERE user_id = ?",
        (user_id,),
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_user_and_papers(user_id: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    # Delete papers first (FK not configured for cascade)
    cur.execute("DELETE FROM papers WHERE user_id = ?", (user_id,))
    cur.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
