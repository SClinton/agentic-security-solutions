(function () {
  "use strict";

  const FACET_IDS = ["solution_types", "llmops_stages", "sldc_stages", "top10_2026"];

  function makeCheckbox(container, name, value) {
    const label = document.createElement("label");
    label.className = "checkbox-chip";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    input.value = value;
    label.appendChild(input);
    label.appendChild(document.createTextNode(value));
    container.appendChild(label);
  }

  async function loadFacetValues() {
    const manifestRes = await fetch("data/manifest.json");
    const files = await manifestRes.json();
    const solutions = await Promise.all(
      files.map((f) => fetch(`data/${f}`).then((r) => r.json()))
    );

    const values = {
      solution_types: new Set(),
      llmops_stages: new Set(),
      sldc_stages: new Set(),
      top10_2026: new Set(),
    };
    for (const s of solutions) {
      s.solution_types.forEach((v) => values.solution_types.add(v));
      s.llmops_stages.forEach((v) => values.llmops_stages.add(v));
      (s.agentic_sldc || []).forEach((st) => values.sldc_stages.add(st.stage));
      s.top10_2026.forEach((v) => values.top10_2026.add(v));
    }

    for (const facet of FACET_IDS) {
      const container = document.getElementById(facet);
      const sorted = Array.from(values[facet]).sort();
      sorted.forEach((v) => makeCheckbox(container, facet, v));
    }
  }

  function getChecked(name) {
    return Array.from(
      document.querySelectorAll(`input[name="${name}"]:checked`)
    ).map((el) => el.value);
  }

  function buildIssueBody(data) {
    const lines = [
      `**Solution / Product Name:** ${data.title}`,
      `**Company / Project Name:** ${data.company}`,
      "",
      `**Description:**`,
      data.description,
      "",
      `**Solution Link:** ${data.link}`,
      "",
      `**Solution Type:** ${data.solution_types.join(", ") || "—"}`,
      `**LLMOps Stage(s):** ${data.llmops_stages.join(", ") || "—"}`,
      `**Agentic SDLC Phase(s):** ${data.sldc_stages.join(", ") || "—"}`,
      `**Agentic Top 10 (2026):** ${data.top10_2026.join(", ") || "—"}`,
      "",
      `**Characteristics / Capabilities:**`,
      data.characteristics || "—",
      "",
      `---`,
      `Submitted by: ${data.submitter_name || "—"} (${data.submitter_affiliation || "—"})`,
      `Contact: ${data.submitter_email || "—"}`,
    ];
    return lines.join("\n");
  }

  function init() {
    loadFacetValues().catch((err) => console.error("Failed to load facet values", err));

    const form = document.getElementById("submit-form");
    const note = document.getElementById("form-note");

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const data = {
        title: document.getElementById("title").value.trim(),
        company: document.getElementById("company").value.trim(),
        description: document.getElementById("description").value.trim(),
        link: document.getElementById("link").value.trim(),
        solution_types: getChecked("solution_types"),
        llmops_stages: getChecked("llmops_stages"),
        sldc_stages: getChecked("sldc_stages"),
        top10_2026: getChecked("top10_2026"),
        characteristics: document.getElementById("characteristics").value.trim(),
        submitter_name: document.getElementById("submitter_name").value.trim(),
        submitter_affiliation: document.getElementById("submitter_affiliation").value.trim(),
        submitter_email: document.getElementById("submitter_email").value.trim(),
      };

      const otherType = document.getElementById("solution_types_other").value.trim();
      if (otherType) data.solution_types.push(otherType);

      const { githubOwner, githubRepo } = window.SITE_CONFIG;
      const issueUrl =
        `https://github.com/${githubOwner}/${githubRepo}/issues/new` +
        `?title=${encodeURIComponent("New solution: " + data.title)}` +
        `&labels=${encodeURIComponent("new-submission")}` +
        `&body=${encodeURIComponent(buildIssueBody(data))}`;

      const win = window.open(issueUrl, "_blank", "noopener,noreferrer");
      if (win) {
        note.textContent = "Opened a GitHub Issue in a new tab — submit it there to complete your request.";
      } else {
        note.innerHTML =
          'Your browser blocked the popup. <a href="' + issueUrl + '" target="_blank" rel="noopener noreferrer">Click here to open the GitHub Issue</a>.';
      }
    });
  }

  init();
})();
