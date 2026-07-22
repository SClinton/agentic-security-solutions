(function () {
  "use strict";

  const FACET_IDS = ["solution_types", "llmops_stages", "sldc_stages", "top10_2026"];

  function makeCheckbox(container, name, value, checkedValues) {
    const label = document.createElement("label");
    label.className = "checkbox-chip";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    input.value = value;
    if (checkedValues && checkedValues.includes(value)) input.checked = true;
    label.appendChild(input);
    label.appendChild(document.createTextNode(value));
    container.appendChild(label);
  }

  async function loadAllCurrentSolutions() {
    const manifestRes = await fetch("data/manifest.json");
    const metaPaths = await manifestRes.json();
    const entries = await Promise.all(
      metaPaths.map(async (metaPath) => {
        const meta = await fetch(`data/${metaPath}`).then((r) => r.json());
        const folder = metaPath.replace(/\/meta\.json$/, "");
        const current = await fetch(`data/${folder}/v${meta.current_version}.json`).then((r) => r.json());
        return { meta, current };
      })
    );
    return entries;
  }

  function getChecked(name) {
    return Array.from(
      document.querySelectorAll(`input[name="${name}"]:checked`)
    ).map((el) => el.value);
  }

  function buildIssueBody(data, target) {
    const lines = [
      `**Editing existing entry:** ${target.current.title} (slug: \`${target.meta.slug}\`, currently v${target.meta.current_version})`,
      "",
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
      `**Taxonomy Coverage:**`,
      data.characteristics || "—",
      "",
      `**Reason for this change:**`,
      data.edit_reason || "—",
      "",
      `---`,
      `Submitted by: ${data.submitter_name || "—"} (${data.submitter_affiliation || "—"})`,
      `Contact: ${data.submitter_email || "—"}`,
      "",
      `If accepted, apply with:`,
      "```",
      `python3 apply_edit.py ${target.meta.slug} --changes <changes.json>`,
      "```",
    ];
    return lines.join("\n");
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");

    const form = document.getElementById("edit-form");
    const loadError = document.getElementById("load-error");
    const editingNote = document.getElementById("editing-note");
    const note = document.getElementById("form-note");

    if (!slug) {
      loadError.hidden = false;
      return;
    }

    let entries;
    try {
      entries = await loadAllCurrentSolutions();
    } catch (err) {
      console.error("Failed to load solutions data", err);
      loadError.hidden = false;
      return;
    }

    const target = entries.find((e) => e.meta.slug === slug);
    if (!target) {
      loadError.hidden = false;
      return;
    }

    const s = target.current;
    const sldcStages = (s.agentic_sldc || []).map((st) => st.stage);
    const characteristics = (s.agentic_sldc || [])
      .map((st) => `${st.stage}: ${st.items.join(" ")}`)
      .join("\n");

    editingNote.hidden = false;
    editingNote.textContent = `Editing "${s.title}" — currently version ${target.meta.current_version} of ${target.meta.versions.length}.`;

    document.getElementById("title").value = s.title || "";
    document.getElementById("company").value = s.company || "";
    document.getElementById("description").value = s.description || "";
    document.getElementById("link").value = s.link || "";
    document.getElementById("characteristics").value = characteristics;

    const values = {
      solution_types: new Set(),
      llmops_stages: new Set(),
      sldc_stages: new Set(),
      top10_2026: new Set(),
    };
    for (const { current: c } of entries) {
      c.solution_types.forEach((v) => values.solution_types.add(v));
      c.llmops_stages.forEach((v) => values.llmops_stages.add(v));
      (c.agentic_sldc || []).forEach((st) => values.sldc_stages.add(st.stage));
      c.top10_2026.forEach((v) => values.top10_2026.add(v));
    }

    const checkedByFacet = {
      solution_types: s.solution_types,
      llmops_stages: s.llmops_stages,
      sldc_stages: sldcStages,
      top10_2026: s.top10_2026,
    };

    for (const facet of FACET_IDS) {
      const container = document.getElementById(facet);
      const sorted = Array.from(values[facet]).sort();
      sorted.forEach((v) => makeCheckbox(container, facet, v, checkedByFacet[facet]));
    }

    form.hidden = false;

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
        edit_reason: document.getElementById("edit_reason").value.trim(),
      };

      const otherType = document.getElementById("solution_types_other").value.trim();
      if (otherType) data.solution_types.push(otherType);

      const { githubOwner, githubRepo } = window.SITE_CONFIG;
      const issueUrl =
        `https://github.com/${githubOwner}/${githubRepo}/issues/new` +
        `?title=${encodeURIComponent("Edit suggestion: " + data.title)}` +
        `&labels=${encodeURIComponent("edit-suggestion")}` +
        `&body=${encodeURIComponent(buildIssueBody(data, target))}`;

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
