#!/usr/bin/env python3
"""Convert rt_taxonomy.md into rt_taxonomy.json for the "Suggest an Edit" /
"Submit a Solution" capability checklist.

Run whenever rt_taxonomy.md changes:
    python3 build_taxonomy.py

Output shape:
    {
      "Red": {
        "Scope / Plan": [ {"name": "...", "description": "..."}, ... ],
        "Test & Evaluation": [ ... ]
      },
      "Blue": { ... },
      "Purple": { ... },
      "Shared": { ... }
    }
"""
import json
import re
from pathlib import Path

SRC = Path(__file__).parent / "rt_taxonomy.md"
OUT = Path(__file__).parent / "rt_taxonomy.json"

TEAM_HEADING_RE = re.compile(r"^\*{0,2}(.+?)\s+Capabilities\*{0,2}$", re.IGNORECASE)
# "* **Capability name;** Description text" - semicolon inside the bold close is how
# this doc marks the end of the name; be lenient about the exact punctuation.
BULLET_RE = re.compile(r"^\*\s+\*\*(.+?)\*\*\s*[:;]?\s*(.*)$")


def normalize_team(raw: str) -> str:
    name = raw.strip().strip("*").strip()
    name = re.sub(r"\s+Teaming$", "", name, flags=re.IGNORECASE)
    return name


def main():
    lines = SRC.read_text(encoding="utf-8").splitlines()

    taxonomy = {}
    current_team = None
    current_stage = None

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        heading_match = re.match(r"^(#{2,3})\s+(.*)$", line)
        if heading_match:
            text = heading_match.group(2).strip()
            team_match = TEAM_HEADING_RE.match(text)
            if team_match:
                current_team = normalize_team(team_match.group(1))
                taxonomy.setdefault(current_team, {})
                current_stage = None
            elif current_team:
                current_stage = text.strip("*").strip()
                taxonomy[current_team].setdefault(current_stage, [])
            continue

        bullet_match = BULLET_RE.match(line)
        if bullet_match and current_team and current_stage:
            name = bullet_match.group(1).strip().rstrip(";").strip()
            description = bullet_match.group(2).strip()
            taxonomy[current_team][current_stage].append({
                "name": name,
                "description": description,
            })

    OUT.write_text(json.dumps(taxonomy, indent=2, ensure_ascii=False), encoding="utf-8")

    total = sum(len(items) for stages in taxonomy.values() for items in stages.values())
    print(f"Parsed {total} capabilities across {len(taxonomy)} teams into {OUT}")
    for team, stages in taxonomy.items():
        counts = ", ".join(f"{stage} ({len(items)})" for stage, items in stages.items())
        print(f"  {team}: {counts}")


if __name__ == "__main__":
    main()
