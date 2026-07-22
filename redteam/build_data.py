#!/usr/bin/env python3
"""Convert RedTeamSolutions.csv into one versioned folder per solution, plus a manifest.

Run whenever the source CSV changes:
    python3 build_data.py

Safe to re-run: it skips any solution folder that already has a meta.json,
so it never clobbers version history created by apply_edit.py.
"""
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "shared"))
from build_common import clean_text, split_grouped, split_simple, slugify, write_solution_folder

SRC = Path(__file__).parent / "RedTeamSolutions.csv"
DATA_DIR = Path(__file__).parent / "data" / "solutions"
MANIFEST = Path(__file__).parent / "data" / "manifest.json"


def normalize_link(value: str) -> str:
    value = clean_text(value)
    if value and not value.lower().startswith(("http://", "https://")):
        value = f"https://{value}"
    return value


def main():
    with SRC.open(encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    manifest = []
    seen_slugs = {}
    for i, r in enumerate(rows):
        title = clean_text(r.get("OSS Project / Solution Name", ""))
        company = clean_text(r.get("Company Name", ""))
        if not title and not company:
            continue

        lifecycle_stages = split_simple(r.get("Lifecycle Stage", ""), r"[|,]")
        team = split_simple(r.get("Red Team Stage - Choose 1", ""), r"[|,]")
        risk_maps = split_simple(r.get("Risk Maps Supported", ""), r"[|,]")
        solution_types = split_simple(r.get("Solution Type", ""), r"[|,]")
        coverage = split_grouped(
            r.get("Red Team Coverage", ""),
            item_splitter=lambda t: split_simple(t, r"[,]"),
        )

        slug = slugify(title, company)
        n = seen_slugs.get(slug, 0)
        seen_slugs[slug] = n + 1
        if n:
            slug = f"{slug}-{n + 1}"

        solution = {
            "id": i,
            "slug": slug,
            "title": title,
            "company": company,
            "description": clean_text(r.get("Description", "")),
            "link": normalize_link(r.get("Solution Link", "")),
            "tags": {
                "solution_types": solution_types,
                "lifecycle_stages": lifecycle_stages,
                "team": team,
                "risk_maps": risk_maps,
            },
            "coverage": coverage,
            "stars": int(r.get("GITHUB - Stars") or 0),
            "forks": int(r.get("GITHUB - Forks") or 0),
            "submitter_affiliation": clean_text(r.get("Affiliation", "")),
        }

        manifest.append(write_solution_folder(DATA_DIR, i, slug, solution))

    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {len(manifest)} solution folders under {DATA_DIR}")
    print(f"Wrote manifest with {len(manifest)} entries to {MANIFEST}")


if __name__ == "__main__":
    main()
