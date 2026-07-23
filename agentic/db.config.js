window.DB_CONFIG = {
  dbKey: "agentic",
  dbName: "Agentic Security Solutions",
  manifestPath: "data/manifest.json",
  editBase: "edit.html",
  coverageLabel: "Taxonomy Coverage",

  // Sidebar filters on index.html
  facets: [
    { key: "solution_types", label: "Solution Type", tagClass: "tag-type" },
    { key: "stage", label: "AI SDLC Lifecycle Stage", tagClass: "tag-llmops" },
    { key: "top10_2026", label: "Agentic Top 10 (2026)", tagClass: "tag-risk" },
  ],

  // Tag rows shown on each card
  cardTagRows: [
    { key: "solution_types", tagClass: "tag-type" },
    { key: "llmops_stages", tagClass: "tag-llmops" },
    { key: "top10_2026", tagClass: "tag-risk" },
  ],

  searchKeys: ["solution_types", "llmops_stages", "top10_2026"],

  // Checkbox groups on add.html / edit.html (more granular than the index filters)
  formFacets: [
    { key: "solution_types", label: "Solution Type", allowOther: true },
    { key: "llmops_stages", label: "LLMOps Stage(s)" },
    { key: "sldc_stages", label: "Agentic SDLC Phase(s)" },
    { key: "top10_2026", label: "Agentic Top 10 (2026) Risks Addressed" },
  ],

  issueLabelNew: "agentic-new-submission",
  issueLabelEdit: "agentic-edit-suggestion",
};
