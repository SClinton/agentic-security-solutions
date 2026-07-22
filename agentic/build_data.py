#!/usr/bin/env python3
"""Convert AgenticSolutions.csv into one versioned folder per solution, plus a manifest.

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
from build_common import clean_text, split_grouped, split_sentence_items, split_simple, slugify, write_solution_folder

SRC = Path(__file__).parent / "AgenticSolutions.csv"
DATA_DIR = Path(__file__).parent / "data" / "solutions"
MANIFEST = Path(__file__).parent / "data" / "manifest.json"


def main():
    with SRC.open(encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    manifest = []
    seen_slugs = {}
    for i, r in enumerate(rows):
        title = clean_text(r.get("Title", ""))
        company = clean_text(r.get("company__project_name", ""))
        if not title and not company:
            continue

        llmops_stages = split_simple(r.get("LLMOps Stages", ""), r"\|")
        coverage = split_grouped(r.get("Agentic SLDC", ""), split_sentence_items)
        top10 = split_simple(r.get("Agentic Top 10 2026", ""), r"[|,]")
        solution_types = split_simple(r.get("Solution Types", ""), r"[|,]")
        sldc_stages = [g["group"] for g in coverage]
        stage = list(dict.fromkeys([*llmops_stages, *sldc_stages]))

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
            "description": clean_text(r.get("Excerpt") or r.get("Content", "")),
            "link": clean_text(r.get("solution_link", "")),
            "tags": {
                "solution_types": solution_types,
                "llmops_stages": llmops_stages,
                "stage": stage,
                "top10_2026": top10,
            },
            "coverage": coverage,
            "stars": int(r.get("stars") or 0),
            "forks": int(r.get("forks") or 0),
            "submitter_affiliation": clean_text(r.get("land_submitter_affiliation", "")),
        }

        manifest.append(write_solution_folder(DATA_DIR, i, slug, solution))

    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {len(manifest)} solution folders under {DATA_DIR}")
    print(f"Wrote manifest with {len(manifest)} entries to {MANIFEST}")


if __name__ == "__main__":
    main()
