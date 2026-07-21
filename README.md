# Agentic Security Solutions

A searchable database of agentic AI security solutions, published via GitHub Pages.

- `index.html` / `styles.css` / `app.js` — the card gallery with search and facet filters.
- `add.html` / `add.js` — a submission form that opens a pre-filled GitHub Issue for review.
- `data/manifest.json` — list of per-solution JSON file paths.
- `data/solutions/*.json` — one JSON file per solution.
- `AgenticSolutions.csv` — source data.
- `build_data.py` — regenerates `data/` from the CSV.

## Updating the data

1. Edit `AgenticSolutions.csv`.
2. Run `python3 build_data.py`.
3. Commit the regenerated files in `data/`.

## Reviewing submissions

Submissions via the "Submit a Solution" form arrive as GitHub Issues labeled
`new-submission`. Add an approved entry as a new row in `AgenticSolutions.csv`
(or directly as a new file in `data/solutions/`, plus an entry in
`data/manifest.json`), then rebuild.
