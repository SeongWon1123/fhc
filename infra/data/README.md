# Production Data Import

This directory contains real-data import contracts for the FastAPI/Supabase service.
The CSV files under `templates/` are header-only by design; do not add demo, sample,
or placeholder rows to this directory.

## Datasets

- `profiles.csv` imports `profiles`
- `coaches.csv` imports `coach_details`
- `bookings.csv` imports `bookings`
- `diet_logs.csv` imports `diet_logs`
- `clothing_recommendations.csv` imports `clothing_recommendations`
- `rag_documents.csv` imports `rag_documents`

Column types, required fields, and allowed enum values are defined in
`import_schema.json`.

## Validate Files

Run a dry validation pass before writing to Supabase:

```powershell
python scripts/data/import_real_data.py --input-dir path/to/filled-csvs --dry-run --require-data
```

## Import To Supabase

The import script requires real Supabase credentials:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Then run:

```powershell
python scripts/data/import_real_data.py --input-dir path/to/filled-csvs --env-file .env
```

For RAG rows, either provide a real `embedding` JSON number array in
`rag_documents.csv`, or generate missing embeddings through Ollama:

```powershell
python scripts/data/import_real_data.py --input-dir path/to/filled-csvs --env-file .env --datasets rag --generate-rag-embeddings
```

The script writes rows with primary keys by upsert and rows without primary keys by
insert so database defaults can create IDs where allowed.
