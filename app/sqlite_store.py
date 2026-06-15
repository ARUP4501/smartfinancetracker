import json
import os
import re
import sqlite3
import uuid
from datetime import datetime
from types import SimpleNamespace


class SQLiteStore:
    def __init__(self):
        self.path = None
        self.db = _DatabaseProxy(self)

    def init_app(self, app):
        configured = app.config.get("SQLITE_DATABASE", "finance.sqlite3")
        self.path = configured if os.path.isabs(configured) else os.path.join(app.instance_path, configured)
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    collection TEXT NOT NULL,
                    id TEXT NOT NULL,
                    data TEXT NOT NULL,
                    PRIMARY KEY (collection, id)
                )
                """
            )

    def _connect(self):
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def collection(self, name):
        return SQLiteCollection(self, name)


class _DatabaseProxy:
    def __init__(self, store):
        self._store = store

    def __getattr__(self, name):
        return self._store.collection(name)


class Cursor:
    def __init__(self, items):
        self.items = list(items)

    def sort(self, field, direction=-1):
        reverse = direction == -1
        self.items.sort(key=lambda item: item.get(field) or "", reverse=reverse)
        return self

    def skip(self, count):
        self.items = self.items[count:]
        return self

    def limit(self, count):
        self.items = self.items[:count]
        return self

    def __iter__(self):
        return iter(self.items)


class SQLiteCollection:
    def __init__(self, store, name):
        self.store = store
        self.name = name

    def insert_one(self, doc):
        document = dict(doc)
        document.setdefault("_id", uuid.uuid4().hex[:24])
        self._write(document)
        return SimpleNamespace(inserted_id=document["_id"])

    def find_one(self, query):
        for item in self.find(query):
            return item
        return None

    def find(self, query=None):
        query = query or {}
        with self.store._connect() as conn:
            rows = conn.execute("SELECT data FROM documents WHERE collection = ?", (self.name,)).fetchall()
        items = [decode(json.loads(row["data"])) for row in rows]
        return Cursor(item for item in items if matches(item, query))

    def update_one(self, query, update):
        item = self.find_one(query)
        if not item:
            return SimpleNamespace(matched_count=0, modified_count=0)
        if "$set" in update:
            item.update(update["$set"])
        if "$unset" in update:
            for key in update["$unset"]:
                item.pop(key, None)
        self._write(item)
        return SimpleNamespace(matched_count=1, modified_count=1)

    def delete_one(self, query):
        item = self.find_one(query)
        if not item:
            return SimpleNamespace(deleted_count=0)
        with self.store._connect() as conn:
            conn.execute("DELETE FROM documents WHERE collection = ? AND id = ?", (self.name, item["_id"]))
        return SimpleNamespace(deleted_count=1)

    def delete_many(self, query):
        matches_to_delete = list(self.find(query))
        with self.store._connect() as conn:
            conn.executemany("DELETE FROM documents WHERE collection = ? AND id = ?", [(self.name, item["_id"]) for item in matches_to_delete])
        return SimpleNamespace(deleted_count=len(matches_to_delete))

    def count_documents(self, query):
        return len(list(self.find(query)))

    def aggregate(self, pipeline):
        items = list(self.find({}))
        for stage in pipeline:
            if "$match" in stage:
                items = [item for item in items if matches(item, stage["$match"])]
            if "$group" in stage:
                grouped = {}
                group_spec = stage["$group"]
                group_field = group_spec["_id"].lstrip("$")
                for item in items:
                    key = item.get(group_field)
                    grouped.setdefault(key, {"_id": key})
                    for output_field, expression in group_spec.items():
                        if output_field == "_id":
                            continue
                        sum_field = expression.get("$sum")
                        grouped[key][output_field] = grouped[key].get(output_field, 0) + (item.get(sum_field.lstrip("$"), 0) if isinstance(sum_field, str) else sum_field)
                items = list(grouped.values())
            if "$sort" in stage:
                field, direction = next(iter(stage["$sort"].items()))
                items.sort(key=lambda item: item.get(field) or 0, reverse=direction == -1)
            if "$limit" in stage:
                items = items[: stage["$limit"]]
        return Cursor(items)

    def _write(self, doc):
        with self.store._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO documents (collection, id, data) VALUES (?, ?, ?)",
                (self.name, str(doc["_id"]), json.dumps(encode(doc))),
            )


def encode(value):
    if isinstance(value, datetime):
        return {"__type__": "datetime", "value": value.isoformat()}
    if isinstance(value, list):
        return [encode(item) for item in value]
    if isinstance(value, dict):
        return {key: encode(item) for key, item in value.items()}
    return value


def decode(value):
    if isinstance(value, dict) and value.get("__type__") == "datetime":
        return datetime.fromisoformat(value["value"])
    if isinstance(value, list):
        return [decode(item) for item in value]
    if isinstance(value, dict):
        return {key: decode(item) for key, item in value.items()}
    return value


def matches(item, query):
    for key, expected in (query or {}).items():
        actual = item.get(key)
        if isinstance(expected, dict):
            if "$regex" in expected:
                if not re.search(expected["$regex"], str(actual or ""), re.IGNORECASE if expected.get("$options") == "i" else 0):
                    return False
            if "$gte" in expected and (actual is None or actual < expected["$gte"]):
                return False
            if "$lt" in expected and (actual is None or actual >= expected["$lt"]):
                return False
            if "$ne" in expected and actual == expected["$ne"]:
                return False
        elif str(actual) != str(expected):
            return False
    return True
