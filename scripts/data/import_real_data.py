from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import urllib.request
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SCHEMA = REPO_ROOT / "infra" / "data" / "import_schema.json"
DEFAULT_INPUT_DIR = REPO_ROOT / "infra" / "data" / "templates"
PLACEHOLDER_MARKERS = (
    "your_",
    "your-",
    "your-project",
    "your_supabase",
    "replace-with",
    "change-me",
)


def load_env_file(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Env file not found: {path}")

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line.removeprefix("export ").strip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def is_placeholder(value: str) -> bool:
    normalized = (value or "").strip().lower()
    return not normalized or any(marker in normalized for marker in PLACEHOLDER_MARKERS)


def require_supabase_env() -> tuple[str, str]:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    errors: list[str] = []

    if is_placeholder(url):
        errors.append("SUPABASE_URL is missing or still uses a placeholder")
    elif not url.lower().startswith("https://"):
        errors.append("SUPABASE_URL must use https://")

    if is_placeholder(key):
        errors.append("SUPABASE_SERVICE_ROLE_KEY is missing or still uses a placeholder")

    if errors:
        raise RuntimeError("; ".join(errors))
    return url, key


def load_schema(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        schema = json.load(handle)
    if "datasets" not in schema or not isinstance(schema["datasets"], dict):
        raise ValueError("Schema must define a datasets object")
    return schema


def read_csv_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    if not path.exists():
        raise FileNotFoundError(f"Input file not found: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = reader.fieldnames or []
        rows = [dict(row) for row in reader]
    return headers, rows


def parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"true", "t", "1", "yes", "y"}:
        return True
    if normalized in {"false", "f", "0", "no", "n"}:
        return False
    raise ValueError("expected boolean")


def parse_array(value: str) -> list[str]:
    stripped = value.strip()
    if stripped.startswith("["):
        parsed = json.loads(stripped)
        if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
            raise ValueError("expected JSON string array")
        return parsed

    delimiter = ";"
    if "|" in stripped:
        delimiter = "|"
    elif "," in stripped:
        delimiter = ","
    return [item.strip() for item in stripped.split(delimiter) if item.strip()]


def parse_timestamp(value: str) -> str:
    normalized = value.strip()
    datetime.fromisoformat(normalized.replace("Z", "+00:00"))
    return normalized


def parse_json_value(value: str) -> Any:
    return json.loads(value)


def parse_vector(value: str) -> list[float]:
    parsed = json.loads(value)
    if not isinstance(parsed, list) or not all(isinstance(item, (int, float)) for item in parsed):
        raise ValueError("expected JSON number array")
    return [float(item) for item in parsed]


def parse_value(column: str, value: str | None, spec: dict[str, Any]) -> Any:
    if value is None or value.strip() == "":
        return None

    field_type = spec["type"]
    if field_type == "text":
        return value.strip()
    if field_type == "uuid":
        return str(UUID(value.strip()))
    if field_type == "boolean":
        return parse_bool(value)
    if field_type == "integer":
        return int(value.strip())
    if field_type == "decimal":
        return float(Decimal(value.strip()))
    if field_type == "timestamp":
        return parse_timestamp(value)
    if field_type == "enum":
        normalized = value.strip()
        allowed = set(spec["values"])
        if normalized not in allowed:
            raise ValueError(f"expected one of {sorted(allowed)}")
        return normalized
    if field_type == "text_array":
        return parse_array(value)
    if field_type == "json":
        return parse_json_value(value)
    if field_type == "vector":
        return parse_vector(value)

    raise ValueError(f"unsupported field type for {column}: {field_type}")


def row_has_data(row: dict[str, Any]) -> bool:
    for value in row.values():
        if isinstance(value, list):
            if any((item or "").strip() for item in value):
                return True
            continue
        if (value or "").strip():
            return True
    return False


def validate_dataset(
    name: str,
    dataset: dict[str, Any],
    input_dir: Path,
) -> tuple[list[dict[str, Any]], list[str]]:
    input_path = input_dir / dataset["file"]
    errors: list[str] = []

    try:
        headers, raw_rows = read_csv_rows(input_path)
    except Exception as exc:
        return [], [f"{name}: {exc}"]

    columns = dataset["columns"]
    unknown_headers = sorted(set(headers) - set(columns))
    missing_required_headers = sorted(set(dataset["required"]) - set(headers))

    if unknown_headers:
        errors.append(f"{name}: unknown columns: {', '.join(unknown_headers)}")
    if missing_required_headers:
        errors.append(f"{name}: missing required columns: {', '.join(missing_required_headers)}")

    rows: list[dict[str, Any]] = []
    for index, raw_row in enumerate(raw_rows, start=2):
        if not row_has_data(raw_row):
            continue

        parsed_row: dict[str, Any] = {}
        for column, column_spec in columns.items():
            raw_value = raw_row.get(column)
            try:
                parsed = parse_value(column, raw_value, column_spec)
            except Exception as exc:
                errors.append(f"{name}:{index}: {column}: {exc}")
                continue
            if parsed is not None:
                parsed_row[column] = parsed

        for required in dataset["required"]:
            if required not in parsed_row:
                errors.append(f"{name}:{index}: {required} is required")

        if parsed_row:
            rows.append(parsed_row)

    return rows, errors


def get_embedding(text: str, base_url: str, model: str) -> list[float]:
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/api/embeddings",
        data=json.dumps({"model": model, "prompt": text}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.loads(response.read().decode("utf-8"))
    embedding = payload.get("embedding")
    if not isinstance(embedding, list):
        raise RuntimeError("Ollama embedding response did not include an embedding list")
    return [float(item) for item in embedding]


def add_rag_embeddings(rows: list[dict[str, Any]]) -> None:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    model = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
    for row in rows:
        if row.get("embedding"):
            continue
        row["embedding"] = get_embedding(row["content"], base_url, model)


def create_supabase_client(url: str, key: str):
    try:
        from supabase import create_client
    except ImportError as exc:
        raise RuntimeError(
            "supabase package is required. Install services/api-fastapi/requirements.txt first."
        ) from exc

    return create_client(url, key)


def chunks(rows: list[dict[str, Any]], size: int = 250):
    for start in range(0, len(rows), size):
        yield rows[start : start + size]


def write_rows(client, dataset: dict[str, Any], rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0

    table = dataset["table"]
    primary_key = dataset.get("primary_key")
    keyed_rows = [row for row in rows if primary_key and row.get(primary_key)]
    insert_rows = [row for row in rows if not primary_key or not row.get(primary_key)]

    written = 0
    for chunk in chunks(keyed_rows):
        client.table(table).upsert(chunk, on_conflict=primary_key).execute()
        written += len(chunk)
    for chunk in chunks(insert_rows):
        client.table(table).insert(chunk).execute()
        written += len(chunk)
    return written


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate and import real production data into FitConnect Supabase."
    )
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR)
    parser.add_argument("--env-file", type=Path)
    parser.add_argument("--datasets", nargs="+", help="Dataset names to import, or 'all'.")
    parser.add_argument("--dry-run", action="store_true", help="Validate files without writing.")
    parser.add_argument("--require-data", action="store_true", help="Fail if selected files contain no rows.")
    parser.add_argument(
        "--generate-rag-embeddings",
        action="store_true",
        help="Generate missing RAG embeddings with OLLAMA_BASE_URL and OLLAMA_EMBED_MODEL.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.env_file:
        load_env_file(args.env_file)

    schema = load_schema(args.schema)
    datasets = schema["datasets"]
    selected = args.datasets or ["all"]
    if selected == ["all"]:
        selected = list(datasets.keys())

    unknown = sorted(set(selected) - set(datasets))
    if unknown:
        print(f"Unknown datasets: {', '.join(unknown)}", file=sys.stderr)
        return 2

    validated: dict[str, list[dict[str, Any]]] = {}
    all_errors: list[str] = []
    for name in selected:
        rows, errors = validate_dataset(name, datasets[name], args.input_dir)
        if args.generate_rag_embeddings and name == "rag" and not errors:
            try:
                add_rag_embeddings(rows)
            except Exception as exc:
                errors.append(f"rag: embedding generation failed: {exc}")
        if args.require_data and not rows:
            errors.append(f"{name}: no data rows found")
        validated[name] = rows
        all_errors.extend(errors)

    for name in selected:
        print(f"{name}: {len(validated[name])} row(s) ready")

    if all_errors:
        for error in all_errors:
            print(error, file=sys.stderr)
        return 2

    if args.dry_run:
        print("Dry run complete; no data was written.")
        return 0

    total_rows = sum(len(rows) for rows in validated.values())
    if total_rows == 0:
        print("No data rows found; nothing to import.")
        return 0

    try:
        url, key = require_supabase_env()
        client = create_supabase_client(url, key)
        for name in selected:
            written = write_rows(client, datasets[name], validated[name])
            print(f"{name}: wrote {written} row(s)")
    except Exception as exc:
        print(f"Import failed: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
