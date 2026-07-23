window.DB_CONFIG = {
  dbKey: "redteam",
  dbName: "Red Team Solutions",
  manifestPath: "data/manifest.json",
  editBase: "edit.html",
  coverageLabel: "Red Team Coverage",

  // Sidebar filters on index.html
  facets: [
    { key: "solution_types", label: "Solution Type", tagClass: "tag-type" },
    { key: "lifecycle_stages", label: "Lifecycle Stage", tagClass: "tag-llmops" },
    { key: "team", label: "Red / Blue / Purple Team", tagClass: "tag-team" },
    { key: "risk_maps", label: "Risk Maps Supported", tagClass: "tag-risk" },
  ],

  // Tag rows shown on each card
  cardTagRows: [
    { key: "solution_types", tagClass: "tag-type" },
    { key: "lifecycle_stages", tagClass: "tag-llmops" },
    { key: "team", tagClass: "tag-team" },
    { key: "risk_maps", tagClass: "tag-risk" },
  ],

  searchKeys: ["solution_types", "lifecycle_stages", "team", "risk_maps"],

  // Checkbox groups on add.html / edit.html
  formFacets: [
    { key: "solution_types", label: "Solution Type", allowOther: true },
    { key: "lifecycle_stages", label: "Lifecycle Stage(s)" },
    { key: "team", label: "Red / Blue / Purple Team" },
    { key: "risk_maps", label: "Risk Maps Supported" },
  ],

  // Authoritative capability checklist (replaces the freeform coverage
  // textarea): fetched, grouped by Team > Stage, rendered as checkboxes.
  // Selections become the entry's "coverage" field.
  taxonomy: {
    path: "taxonomy/rt_taxonomy.json",
    containerId: "taxonomy-checklist",
  },

  issueLabelNew: "redteam-new-submission",
  issueLabelEdit: "redteam-edit-suggestion",

  // Simple math challenge on add.html / edit.html to deter bot submissions.
  captcha: true,
};
