# Report Generation

This directory contains the reproducible builder for the SCNU midterm report in `docs/reports`.

## Setup

Use Python 3.11 or newer.

```powershell
python -m venv .tmp\report-venv
.\.tmp\report-venv\Scripts\python.exe -m pip install -r scripts\reports\requirements.txt
```

The Codex bundled document runtime also includes these dependencies and was used to generate the checked-in DOCX/PDF artifacts.

## Regenerate DOCX

```powershell
.\.tmp\report-venv\Scripts\python.exe scripts\reports\generate_scnu_midterm_report.py
```

Output:

- `docs/reports/2026_SCNU_창업동아리_중간점검_보고서.docx`

The checked-in PDF was exported from the generated DOCX using Microsoft Word on Windows and visually verified as a single-page report.
