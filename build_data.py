#!/usr/bin/env python3
"""Convert AgenticSolutions.csv into one versioned folder per solution, plus a manifest.

Each solution lives at data/solutions/<folder>/ as:
    v1.json    - the initial version (immutable once written)
    meta.json  - {"slug", "id", "current_version", "versions": [1, ...]}

Run whenever the source CSV changes:
    python3 build_data.py

This only (re)builds v1 for solutions sourced from the CSV. It never
touches a folder that already has a meta.json, so it will not clobber
version history created by apply_edit.py for entries edited since the
last CSV import. To force a full rebuild from scratch (discarding all
edit history), delete data/solutions/ first.
"""
import csv
import html
import json
import re
from pathlib import Path

SRC = Path(__file__).parent / "AgenticSolutions.csv"
DATA_DIR = Path(__file__).parent / "data" / "solutions"
MANIFEST = Path(__file__).parent / "data" / "manifest.json"


def clean_text(value: str) -> str:
    if not value:
        return ""
    value = value.replace("�", "—").replace("\xd0", "—")
    value = html.unescape(value)
    return value.strip()


ITEM_SPLIT_RE = re.compile(r"\.,?\s+(?=[A-Z(])")


def split_items(text: str):
    """Split a run-on 'item one. Item two, with commas.' string into items.

    Source data separates distinct characteristics with '. ' (period + space)
    followed by a capital letter, not with commas (commas appear inside items).
    """
    text = text.strip()
    if not text:
        return []
    parts = [p.strip() for p in ITEM_SPLIT_RE.split(text)]
    items = []
    for i, p in enumerate(parts):
        if not p:
            continue
        # re-attach the trailing period the split regex consumed, except
        # for the last part which may legitimately lack one.
        if i < len(parts) - 1 and not p.endswith("."):
            p += "."
        items.append(p)
    return items


def split_top_level(value: str):
    """Split a '|' separated 'Stage>details' string into [{stage, items}]."""
    result = []
    if not value:
        return result
    for chunk in value.split("|"):
        chunk = clean_text(chunk)
        if not chunk:
            continue
        if ">" in chunk:
            stage, items = chunk.split(">", 1)
            item_list = split_items(items)
        else:
            stage, item_list = chunk, []
        result.append({"stage": stage.strip(), "items": item_list})
    return result


def split_simple(value: str, sep_regex=r"[|,]"):
    if not value:
        return []
    parts = re.split(sep_regex, value)
    return [clean_text(p) for p in parts if clean_text(p)]


def slugify(*parts: str) -> str:
    text = "-".join(p for p in parts if p).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "solution"


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
        sldc = split_top_level(r.get("Agentic SLDC", ""))
        top10 = split_simple(r.get("Agentic Top 10 2026", ""), r"[|,]")
        solution_types = split_simple(r.get("Solution Types", ""), r"[|,]")

        slug = slugify(title, company)
        n = seen_slugs.get(slug, 0)
        seen_slugs[slug] = n + 1
        if n:
            slug = f"{slug}-{n + 1}"
        folder_name = f"{i:04d}-{slug}"
        folder = DATA_DIR / folder_name
        meta_path = folder / "meta.json"

        manifest.append(f"solutions/{folder_name}/meta.json")

        if meta_path.exists():
            # Already imported (and possibly edited since) - leave it alone.
            continue

        solution = {
            "id": i,
            "slug": slug,
            "title": title,
            "company": company,
            "description": clean_text(r.get("Excerpt") or r.get("Content", "")),
            "link": clean_text(r.get("solution_link", "")),
            "solution_types": solution_types,
            "llmops_stages": llmops_stages,
            "agentic_sldc": sldc,
            "top10_2026": top10,
            "stars": int(r.get("stars") or 0),
            "forks": int(r.get("forks") or 0),
            "submitter_affiliation": clean_text(r.get("land_submitter_affiliation", "")),
        }

        folder.mkdir(parents=True, exist_ok=True)
        (folder / "v1.json").write_text(
            json.dumps(solution, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        meta = {"slug": slug, "id": i, "current_version": 1, "versions": [1]}
        meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")

    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {len(manifest)} solution folders under {DATA_DIR}")
    print(f"Wrote manifest with {len(manifest)} entries to {MANIFEST}")


if __name__ == "__main__":
    main()
