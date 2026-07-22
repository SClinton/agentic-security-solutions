(function () {
  "use strict";

  const cfg = window.DB_CONFIG;
  if (!cfg) throw new Error("shared/form.js requires window.DB_CONFIG to be set before it loads");

  const mode = document.body.dataset.formMode === "edit" ? "edit" : "add";

  function makeCheckbox(container, name, value, isChecked) {
    const label = document.createElement("label");
    label.className = "checkbox-chip";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    input.value = value;
    if (isChecked) input.checked = true;
    label.appendChild(input);
    label.appendChild(document.createTextNode(value));
    container.appendChild(label);
  }

  async function loadAllCurrentSolutions() {
    const manifestRes = await fetch(cfg.manifestPath);
    const metaPaths = await manifestRes.json();
    const base = cfg.manifestPath.replace(/manifest\.json$/, "");
    return Promise.all(
      metaPaths.map(async (metaPath) => {
        const meta = await fetch(`${base}${metaPath}`).then((r) => r.json());
        const folder = metaPath.replace(/\/meta\.json$/, "");
        const current = await fetch(`${base}${folder}/v${meta.current_version}.json`).then((r) =>
          r.json()
        );
        const flattened = {
          ...current,
          ...(current.tags || {}),
          sldc_stages: (current.coverage || []).map((g) => g.group),
        };
        return { meta, current: flattened };
      })
    );
  }

  function buildFacetValueSets(entries) {
    const values = {};
    cfg.formFacets.forEach((f) => (values[f.key] = new Set()));
    entries.forEach(({ current }) => {
      cfg.formFacets.forEach((f) => {
        (current[f.key] || []).forEach((v) => values[f.key].add(v));
      });
    });
    return values;
  }

  function renderFacetCheckboxes(values, checkedSource) {
    cfg.formFacets.forEach((f) => {
      const container = document.getElementById(f.key);
      if (!container) return;
      const sorted = Array.from(values[f.key]).sort();
      const checkedValues = (checkedSource && checkedSource[f.key]) || [];
      sorted.forEach((v) => makeCheckbox(container, f.key, v, checkedValues.includes(v)));
    });
  }

  function getChecked(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(
      (el) => el.value
    );
  }

  function buildIssueBody(data, target) {
    const lines = [];
    if (mode === "edit") {
      lines.push(
        `**Editing existing entry:** ${target.current.title} (slug: \`${target.meta.slug}\`, currently v${target.meta.current_version})`,
        ""
      );
    }
    lines.push(
      `**Solution / Product Name:** ${data.title}`,
      `**Company / Project Name:** ${data.company}`,
      "",
      `**Description:**`,
      data.description,
      "",
      `**Solution Link:** ${data.link}`,
      ""
    );
    cfg.formFacets.forEach((f) => {
      lines.push(`**${f.label}:** ${(data[f.key] || []).join(", ") || "—"}`);
    });
    lines.push("", `**${cfg.coverageLabel}:**`, data.characteristics || "—");
    if (mode === "edit") {
      lines.push("", `**Reason for this change:**`, data.edit_reason || "—");
    }
    lines.push(
      "",
      `---`,
      `Submitted by: ${data.submitter_name || "—"} (${data.submitter_affiliation || "—"})`,
      `Contact: ${data.submitter_email || "—"}`
    );
    if (mode === "edit") {
      lines.push(
        "",
        `If accepted, apply with:`,
        "```",
        `python3 apply_edit.py ${cfg.dbKey} ${target.meta.slug} --changes <changes.json>`,
        "```"
      );
    }
    return lines.join("\n");
  }

  function collectFormData() {
    const data = {
      title: document.getElementById("title").value.trim(),
      company: document.getElementById("company").value.trim(),
      description: document.getElementById("description").value.trim(),
      link: document.getElementById("link").value.trim(),
      characteristics: document.getElementById("characteristics").value.trim(),
      submitter_name: document.getElementById("submitter_name").value.trim(),
      submitter_affiliation: document.getElementById("submitter_affiliation").value.trim(),
      submitter_email: document.getElementById("submitter_email").value.trim(),
    };
    cfg.formFacets.forEach((f) => {
      data[f.key] = getChecked(f.key);
    });
    if (mode === "edit") {
      const reasonEl = document.getElementById("edit_reason");
      data.edit_reason = reasonEl ? reasonEl.value.trim() : "";
    }
    cfg.formFacets.forEach((f) => {
      if (!f.allowOther) return;
      const otherInput = document.getElementById(`${f.key}_other`);
      if (otherInput && otherInput.value.trim()) data[f.key].push(otherInput.value.trim());
    });
    return data;
  }

  function openIssue(data, target, note) {
    const { githubOwner, githubRepo } = window.SITE_CONFIG;
    const label = mode === "edit" ? cfg.issueLabelEdit : cfg.issueLabelNew;
    const titlePrefix = mode === "edit" ? "Edit suggestion" : "New solution";
    const issueUrl =
      `https://github.com/${githubOwner}/${githubRepo}/issues/new` +
      `?title=${encodeURIComponent(`${titlePrefix}: ${data.title}`)}` +
      `&labels=${encodeURIComponent(label)}` +
      `&body=${encodeURIComponent(buildIssueBody(data, target))}`;

    const win = window.open(issueUrl, "_blank", "noopener,noreferrer");
    if (win) {
      note.textContent = "Opened a GitHub Issue in a new tab — submit it there to complete your request.";
    } else {
      note.innerHTML =
        'Your browser blocked the popup. <a href="' +
        issueUrl +
        '" target="_blank" rel="noopener noreferrer">Click here to open the GitHub Issue</a>.';
    }
  }

  async function initAdd() {
    const form = document.getElementById("submit-form");
    const note = document.getElementById("form-note");
    try {
      const entries = await loadAllCurrentSolutions();
      renderFacetCheckboxes(buildFacetValueSets(entries), null);
    } catch (err) {
      console.error("Failed to load facet values", err);
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      openIssue(collectFormData(), null, note);
    });
  }

  async function initEdit() {
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
    const characteristics = (s.coverage || [])
      .map((g) => `${g.group}: ${g.items.join(" ")}`)
      .join("\n");

    editingNote.hidden = false;
    editingNote.textContent = `Editing "${s.title}" — currently version ${target.meta.current_version} of ${target.meta.versions.length}.`;

    document.getElementById("title").value = s.title || "";
    document.getElementById("company").value = s.company || "";
    document.getElementById("description").value = s.description || "";
    document.getElementById("link").value = s.link || "";
    document.getElementById("characteristics").value = characteristics;

    renderFacetCheckboxes(buildFacetValueSets(entries), s);

    form.hidden = false;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      openIssue(collectFormData(), target, note);
    });
  }

  if (mode === "edit") {
    initEdit();
  } else {
    initAdd();
  }
})();
