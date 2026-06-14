(function () {
  "use strict";

  const DATA_URLS = [
    "/api/harbour_functions_search_index.json",
    "/api/harbour_functions_part_001.json"
  ];

  const MAX_RESULTS = 100;

  const state = {
    records: [],
    filtered: [],
    loadErrors: []
  };

  const els = {
    form: document.getElementById("apiSearchForm"),
    query: document.getElementById("apiQuery"),
    clear: document.getElementById("apiSearchClear"),
    category: document.getElementById("apiCategory"),
    searchAllText: document.getElementById("searchAllText"),
    reset: document.getElementById("apiReset"),
    status: document.getElementById("apiStatus"),
    results: document.getElementById("apiResults")
  };

  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function asArray(value) {
    if (value === null || value === undefined || value === "") return [];
    return Array.isArray(value) ? value : [value];
  }

  function firstDefined(object, keys, fallback) {
    for (const key of keys) {
      if (
        object &&
        Object.prototype.hasOwnProperty.call(object, key) &&
        object[key] !== null &&
        object[key] !== undefined &&
        object[key] !== ""
      ) {
        return object[key];
      }
    }
    return fallback === undefined ? "" : fallback;
  }

  function textFromValue(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map(textFromValue).filter(Boolean).join("\n");
    if (isPlainObject(value)) return Object.values(value).map(textFromValue).filter(Boolean).join("\n");
    return "";
  }

  function inlineText(value) {
    return textFromValue(value).replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return inlineText(value).toLowerCase();
  }

  function splitList(value) {
    return asArray(value)
      .flatMap(item => String(item).split(/[,;|]/))
      .map(item => item.trim())
      .filter(Boolean);
  }

  function dedupeText(items) {
    const seen = new Set();
    const result = [];
    for (const item of items) {
      const text = inlineText(item);
      if (!text) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(text);
    }
    return result;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatText(value) {
    const text = textFromValue(value).trim();
    if (!text) return "";
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  function formatType(value) {
    const text = inlineText(value);
    if (!text) return "";
    if (text.startsWith("<") && text.endsWith(">")) return escapeHtml(text);
    return `&lt;${escapeHtml(text)}&gt;`;
  }

  function flattenPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (!isPlainObject(payload)) return [];

    const candidateKeys = ["records", "functions", "apis", "items", "data", "entries", "index", "harbour_functions"];
    for (const key of candidateKeys) {
      if (Array.isArray(payload[key])) return payload[key];
    }

    return Object.entries(payload)
      .filter(([, value]) => isPlainObject(value))
      .map(([key, value]) => Object.assign({ name: key }, value));
  }

  function slugFrom(value) {
    return normalize(value)
      .replace(/[^a-z0-9_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "unnamed";
  }

  function mergeRawObjects(existing, incoming) {
    const merged = Object.assign({}, existing);

    for (const [key, value] of Object.entries(incoming || {})) {
      const current = merged[key];
      const currentEmpty = current === null || current === undefined || current === "" ||
        (Array.isArray(current) && current.length === 0) ||
        (isPlainObject(current) && Object.keys(current).length === 0);

      if (currentEmpty) {
        merged[key] = value;
      } else if (Array.isArray(current) && Array.isArray(value)) {
        merged[key] = current.concat(value);
      } else if (isPlainObject(current) && isPlainObject(value)) {
        merged[key] = Object.assign({}, current, value);
      } else if (value !== null && value !== undefined && value !== "") {
        merged[key] = value;
      }
    }

    return merged;
  }

  function normalizeSeeAlso(value) {
    const values = [];
    for (const item of asArray(value)) {
      if (isPlainObject(item)) {
        values.push(firstDefined(item, ["name", "api", "function", "slug", "title", "id"]));
      } else {
        values.push(...String(item || "").split(/[,;]/));
      }
    }
    return dedupeText(values).sort((a, b) => a.localeCompare(b));
  }

  function normalizeExamples(value) {
    return asArray(value).map((item, index) => {
      if (isPlainObject(item)) {
        return {
          title: inlineText(firstDefined(item, ["title", "name"], `Example ${index + 1}`)) || `Example ${index + 1}`,
          code: textFromValue(firstDefined(item, ["code", "source", "example", "text"], "")).trim(),
          description: textFromValue(firstDefined(item, ["description", "desc", "notes"], "")).trim()
        };
      }

      return {
        title: `Example ${index + 1}`,
        code: textFromValue(item).trim(),
        description: ""
      };
    }).filter(example => example.code || example.description);
  }

  function normalizeParameter(parameter, index) {
    if (!isPlainObject(parameter)) {
      const text = textFromValue(parameter).trim();
      if (!text) return null;
      return {
        ordinal: String(index + 1),
        type: "",
        name: `param${index + 1}`,
        required: "",
        passedBy: "",
        defaultValue: "",
        description: text
      };
    }

    const required = firstDefined(parameter, ["required", "is_required", "mandatory"], null);
    const optional = firstDefined(parameter, ["optional", "is_optional"], null);
    let requiredText = "";
    const requiredNorm = normalize(required);
    const optionalNorm = normalize(optional);

    if (required === true || ["true", "yes", "y", "required", "req", "1"].includes(requiredNorm)) {
      requiredText = "Required";
    } else if (
      required === false ||
      ["false", "no", "n", "optional", "opt", "0"].includes(requiredNorm) ||
      optional === true ||
      ["true", "yes", "y", "optional", "opt", "1"].includes(optionalNorm)
    ) {
      requiredText = "Optional";
    }

    return {
      ordinal: inlineText(firstDefined(parameter, ["ordinal", "position", "index"], "")) || String(index + 1),
      type: inlineText(firstDefined(parameter, ["type", "types", "datatype", "data_type", "dataType", "value_type"], "")),
      name: inlineText(firstDefined(parameter, ["name", "parameter", "param", "argument", "arg", "id"], `param${index + 1}`)),
      required: requiredText,
      passedBy: inlineText(firstDefined(parameter, ["passed_by", "passedBy", "passing", "pass_by", "pass_mode", "by"], "")),
      defaultValue: inlineText(firstDefined(parameter, ["default", "default_value", "defaultValue"], "")),
      description: textFromValue(firstDefined(parameter, ["description", "desc", "text", "notes", "purpose", "doc"], "")).trim()
    };
  }

  function normalizeParameters(value) {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value.map(normalizeParameter).filter(Boolean);
    }

    if (isPlainObject(value)) {
      return Object.entries(value).map(([name, details], index) => {
        if (isPlainObject(details)) return normalizeParameter(Object.assign({ name }, details), index);
        return normalizeParameter({ name, description: details }, index);
      }).filter(Boolean);
    }

    return String(value)
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, index) => normalizeParameter(line, index))
      .filter(Boolean);
  }

  function normalizeReturn(value, record) {
    if (Array.isArray(value)) return value.map(item => normalizeReturn(item, record)).filter(Boolean);

    if (isPlainObject(value)) {
      return {
        type: inlineText(firstDefined(value, ["type", "datatype", "data_type", "dataType", "value_type"], "")),
        name: inlineText(firstDefined(value, ["name", "return_name", "result_name"], "")),
        description: textFromValue(firstDefined(value, ["description", "desc", "text", "notes", "purpose", "doc"], "")).trim()
      };
    }

    const type = firstDefined(record, ["return_type", "returnType", "returns_type", "result_type"], "");
    const name = firstDefined(record, ["return_name", "returnName", "returns_name", "result_name"], "");
    const description = firstDefined(record, ["return_description", "returnDescription", "returns_description", "result_description"], value || "");

    if (!type && !name && !description) return null;

    return {
      type: inlineText(type),
      name: inlineText(name),
      description: textFromValue(description).trim()
    };
  }

  function normalizeReturns(record) {
    const direct = firstDefined(record, ["returns", "return", "return_value", "result"], null);
    const normalized = normalizeReturn(direct, record);
    if (Array.isArray(normalized)) return normalized;
    return normalized ? [normalized] : [];
  }

  function normalizeRecord(rawRecord) {
    const raw = isPlainObject(rawRecord) ? rawRecord : {};
    const name = inlineText(firstDefined(raw, ["name", "api_name", "function_name", "harbour_name", "hl_name", "function", "symbol"], ""));
    const hnName = inlineText(firstDefined(raw, ["hn_name", "harbournova_name", "new_name"], ""));
    const displayNameFromData = inlineText(firstDefined(raw, ["display_name", "title"], ""));
    const displayName = name || displayNameFromData || hnName;

    if (!displayName) return null;

    const aliases = dedupeText(asArray(firstDefined(raw, ["aliases", "alias", "aka"], [])));
    const categories = dedupeText(splitList(firstDefined(raw, ["categories", "category", "group", "section", "module"], [])));
    const category = inlineText(firstDefined(raw, ["category"], categories[0] || "Uncategorized"));
    const platforms = dedupeText(splitList(firstDefined(raw, ["platforms", "platform", "os", "systems"], [])));
    const flags = dedupeText(splitList(firstDefined(raw, ["flags", "tags"], [])));
    const summary = textFromValue(firstDefined(raw, ["summary", "short_description", "description_short", "purpose"], "")).trim();
    const description = textFromValue(firstDefined(raw, ["description", "details", "doc", "documentation", "long_description", "desc"], "")).trim();
    const syntax = textFromValue(firstDefined(raw, ["syntax", "signature", "prototype", "usage", "declaration"], "")).trim();
    const searchText = inlineText(firstDefined(raw, ["search_text", "searchableText"], ""));

    const normalized = {
      raw,
      id: inlineText(firstDefined(raw, ["id", "slug"], "")) || slugFrom(displayName),
      name,
      hnName,
      displayName,
      displayLower: normalize(displayName),
      aliases,
      categories: categories.length ? categories : [category],
      category,
      subcategory: inlineText(firstDefined(raw, ["subcategory", "sub_category"], "")),
      platforms,
      flags,
      type: inlineText(firstDefined(raw, ["type", "kind"], "")),
      status: inlineText(firstDefined(raw, ["status", "port_status", "hn_status"], "")),
      visibility: inlineText(firstDefined(raw, ["visibility", "access"], "")),
      implementation: inlineText(firstDefined(raw, ["implementation"], "")),
      summary,
      description,
      syntax,
      parameters: normalizeParameters(firstDefined(raw, ["parameters", "params", "arguments", "args"], [])),
      returns: normalizeReturns(raw),
      examples: normalizeExamples(firstDefined(raw, ["examples", "example", "sample"], [])),
      seeAlso: normalizeSeeAlso(firstDefined(raw, ["see_also", "seealso", "seeAlso", "related"], [])),
      header: inlineText(firstDefined(raw, ["header", "include", "include_file"], "")),
      library: inlineText(firstDefined(raw, ["library", "lib", "component"], "")),
      sourceCodeFile: inlineText(firstDefined(raw, ["source_code_file", "source_file", "source", "file", "path"], "")),
      jsonSourceFile: inlineText(firstDefined(raw, ["source_file"], ""))
    };

    const nameParts = [normalized.name, normalized.hnName, normalized.displayName].concat(normalized.aliases);
    const detailParts = [
      normalized.category,
      normalized.categories.join(" "),
      normalized.subcategory,
      normalized.platforms.join(" "),
      normalized.flags.join(" "),
      normalized.summary,
      normalized.description,
      normalized.syntax,
      normalized.header,
      normalized.library,
      normalized.sourceCodeFile,
      normalized.jsonSourceFile,
      normalized.type,
      normalized.status,
      searchText,
      textFromValue(normalized.parameters),
      textFromValue(normalized.returns),
      textFromValue(normalized.examples),
      normalized.seeAlso.join(" ")
    ];

    normalized.nameSearchText = normalize(nameParts.join(" "));
    normalized.searchableText = normalize(nameParts.concat(detailParts).join(" "));
    return normalized;
  }

  function mergeRecords(payloads) {
    const byKey = new Map();

    for (const payload of payloads) {
      for (const rawRecord of flattenPayload(payload)) {
        const normalized = normalizeRecord(rawRecord);
        if (!normalized) continue;

        const key = normalized.id.toLowerCase() || normalized.displayLower;
        const existing = byKey.get(key);

        if (!existing) {
          byKey.set(key, normalized);
          continue;
        }

        const mergedRaw = mergeRawObjects(existing.raw, rawRecord);
        const merged = normalizeRecord(mergedRaw) || normalized;
        byKey.set(key, merged);
      }
    }

    return Array.from(byKey.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async function loadJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return response.json();
  }

  async function loadData() {
    const payloads = [];

    for (const url of DATA_URLS) {
      try {
        payloads.push(await loadJson(url));
      } catch (error) {
        state.loadErrors.push(error.message);
      }
    }

    state.records = mergeRecords(payloads);
    populateCategories();

    if (!state.records.length) {
      const details = state.loadErrors.length ? `<br><small>${escapeHtml(state.loadErrors.join(" | "))}</small>` : "";
      els.status.innerHTML = `API JSON was not found. Run <code>scripts\\Copy-HarbourApiJsonFromCore.cmd</code> after generating JSON from <code>R:\\HarbourNova\\core</code>.${details}`;
      els.results.innerHTML = "";
      return;
    }

    applyUrlParams();
    filterRecords();
  }

  function setPromptStatus() {
    updateClearButton();
    els.status.textContent = `${state.records.length.toLocaleString()} API records loaded. Enter an API name or choose a category to display matches.`;
  }

  function updateClearButton() {
    if (els.clear) els.clear.hidden = !els.query.value;
  }

  function clearQuery() {
    els.query.value = "";
    filterRecords(true);
    els.query.focus();
  }

  function populateCategories() {
    if (!els.category) return;

    const existing = new Set(Array.from(els.category.options).map(option => option.value));
    const categories = new Set();

    for (const record of state.records) {
      for (const category of record.categories) categories.add(category);
    }

    Array.from(categories).sort((a, b) => a.localeCompare(b)).forEach(category => {
      if (existing.has(category)) return;
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      els.category.appendChild(option);
    });
  }

  function getMatchMode() {
    return (document.querySelector("input[name='matchMode']:checked") || {}).value || "starts";
  }

  function setMatchMode(mode) {
    const allowed = new Set(["starts", "exact", "includes"]);
    const safeMode = allowed.has(mode) ? mode : "starts";
    const input = document.querySelector(`input[name='matchMode'][value='${safeMode}']`);
    if (input) input.checked = true;
  }

  function hasSearchCriteria() {
    return Boolean(els.query.value.trim() || els.category.value);
  }

  function recordMatchesQuery(record, query, mode, searchAllText) {
    if (!query) return true;
    if (searchAllText) return record.searchableText.includes(query);

    const values = [record.name, record.hnName, record.displayName].concat(record.aliases)
      .map(normalize)
      .filter(Boolean);

    if (mode === "exact") return values.some(value => value === query);
    if (mode === "includes") return values.some(value => value.includes(query));
    return values.some(value => value.startsWith(query));
  }

  function filterRecords(updateUrl) {
    updateClearButton();

    if (!hasSearchCriteria()) {
      state.filtered = [];
      setPromptStatus();
      els.results.innerHTML = "";
      if (updateUrl) syncUrl();
      return;
    }

    const query = normalize(els.query.value);
    const category = els.category.value;
    const mode = getMatchMode();
    const searchAllText = els.searchAllText.checked;

    const filtered = state.records.filter(record => {
      if (category && !record.categories.includes(category)) return false;
      return recordMatchesQuery(record, query, mode, searchAllText);
    });

    state.filtered = filtered.slice(0, MAX_RESULTS);
    const limited = filtered.length > state.filtered.length;
    els.status.textContent = `${filtered.length.toLocaleString()} match${filtered.length === 1 ? "" : "es"}${limited ? `; showing first ${MAX_RESULTS}` : ""}. Click an API row to view details.`;
    renderResults(state.filtered, filtered.length);
    if (updateUrl) syncUrl();
  }

  function syncUrl() {
    const params = new URLSearchParams();
    if (els.query.value.trim()) params.set("q", els.query.value.trim());
    if (els.category.value) params.set("category", els.category.value);
    const mode = getMatchMode();
    if (mode !== "starts") params.set("mode", mode);
    if (els.searchAllText.checked) params.set("all", "1");

    const queryString = params.toString();
    const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ""}`;
    window.history.replaceState(null, "", nextUrl);
  }

  function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("q")) els.query.value = params.get("q") || "";
    if (params.has("category")) els.category.value = params.get("category") || "";
    if (params.has("mode")) setMatchMode(params.get("mode") || "starts");
    if (params.get("all") === "1" || params.get("all") === "true") els.searchAllText.checked = true;
  }

  function renderPills(items, className) {
    const values = dedupeText(items);
    if (!values.length) return "";
    return values.map(item => `<span class="${className || "hw-api-pill"}">${escapeHtml(item)}</span>`).join("");
  }

  function renderSummary(record) {
    const summary = record.summary || record.description;
    const alias = record.hnName && record.hnName !== record.name ? `<span class="hw-api-result-alias">HN: ${escapeHtml(record.hnName)}</span>` : "";
    const syntax = record.syntax ? `<code class="hw-api-result-syntax">${escapeHtml(inlineText(record.syntax))}</code>` : "";

    return `<summary>
      <span class="hw-api-result-main">
        <span class="hw-api-result-title-row">
          <span class="hw-api-result-title">${escapeHtml(record.displayName)}</span>
          ${alias}
          ${syntax}
        </span>
        ${summary ? `<span class="hw-api-result-summary">${escapeHtml(inlineText(summary))}</span>` : ""}
      </span>
      <i class="bi bi-chevron-left hw-chevron" aria-hidden="true"></i>
    </summary>`;
  }

  function renderMetaGrid(record) {
    const visibility = inlineText(record.visibility).toLowerCase();
    const visibilityForDisplay = visibility && visibility !== "public" ? record.visibility : "";

    const rows = [
      ["HarbourNova Name", record.hnName],
      ["Aliases", record.aliases.join(", ")],
      ["Category", record.categories.join(", ")],
      ["Subcategory", record.subcategory],
      ["Type", record.type],
      ["Status", record.status],
      ["Implementation", record.implementation],
      ["Library", record.library],
      ["Header", record.header],
      ["Source Code File", record.sourceCodeFile],
      ["Platforms", record.platforms.join(", ")],
      ["Flags", record.flags.join(", ")],
      ["Visibility", visibilityForDisplay]
    ].filter(([, value]) => inlineText(value));

    if (!rows.length) return "";

    return `<div class="hw-api-detail-grid">
      ${rows.map(([label, value]) => `<div class="hw-api-detail-grid-item">
        <span class="hw-api-detail-grid-label">${escapeHtml(label)}</span>
        <span class="hw-api-detail-grid-value">${formatText(value)}</span>
      </div>`).join("")}
    </div>`;
  }

  function renderTextSection(title, value) {
    const html = formatText(value);
    if (!html) return "";
    return `<section class="hw-api-detail-section">
      <h3 class="hw-api-detail-section-title">${escapeHtml(title)}</h3>
      <p class="hw-api-detail-text">${html}</p>
    </section>`;
  }

  function renderSyntax(record) {
    if (!record.syntax) return "";
    return `<section class="hw-api-detail-section">
      <h3 class="hw-api-detail-section-title">Syntax</h3>
      <pre class="hw-api-code-pre"><code>${escapeHtml(record.syntax)}</code></pre>
    </section>`;
  }

  function renderParameters(record) {
    if (!record.parameters.length) return "";

    const rows = record.parameters.map(parameter => {
      const defaultText = parameter.defaultValue ? `<div class="hw-api-default">Default Value: ${escapeHtml(parameter.defaultValue)}</div>` : "";
      return `<tr>
        <td>${escapeHtml(parameter.ordinal)}</td>
        <td class="hw-api-detail-type">${formatType(parameter.type)}</td>
        <td class="hw-api-detail-name"><code>${escapeHtml(parameter.name)}</code></td>
        <td class="hw-api-detail-required">${escapeHtml(parameter.required)}</td>
        <td class="hw-api-detail-passby">${escapeHtml(parameter.passedBy)}</td>
        <td class="hw-api-detail-description">${formatText(parameter.description)}${defaultText}</td>
      </tr>`;
    }).join("");

    return `<section class="hw-api-detail-section">
      <h3 class="hw-api-detail-section-title">Parameters</h3>
      <div class="hw-api-detail-table-wrap">
        <table class="hw-api-detail-table hw-api-parameter-matrix">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Name</th>
              <th>Required</th>
              <th>Passed By</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
  }

  function renderReturns(record) {
    if (!record.returns.length) return "";

    const item = record.returns[0];
    const row = `<tr>
      <td class="hw-api-detail-type">${formatType(item.type)}</td>
      <td class="hw-api-detail-name">${item.name ? `<code>${escapeHtml(item.name)}</code>` : ""}</td>
      <td class="hw-api-detail-description">${formatText(item.description)}</td>
    </tr>`;

    return `<section class="hw-api-detail-section">
      <h3 class="hw-api-detail-section-title">Return</h3>
      <div class="hw-api-detail-table-wrap">
        <table class="hw-api-detail-table hw-api-return-matrix">
          <thead>
            <tr>
              <th>Type</th>
              <th>Name</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>${row}</tbody>
        </table>
      </div>
    </section>`;
  }

  function renderExamples(record) {
    if (!record.examples.length) return "";

    const cards = record.examples.map(example => `<div class="hw-api-example-card">
      ${example.title ? `<div class="hw-api-example-title">${escapeHtml(example.title)}</div>` : ""}
      ${example.description ? `<p class="hw-api-detail-text">${formatText(example.description)}</p>` : ""}
      ${example.code ? `<pre class="hw-api-code-pre"><code>${escapeHtml(example.code)}</code></pre>` : ""}
    </div>`).join("");

    return `<section class="hw-api-detail-section">
      <h3 class="hw-api-detail-section-title">Examples</h3>
      ${cards}
    </section>`;
  }

  function renderSeeAlso(record) {
    if (!record.seeAlso.length) return "";

    const links = record.seeAlso.map(item => {
      const href = `/api/?q=${encodeURIComponent(item)}&mode=exact`;
      return `<a class="hw-api-seealso-link" href="${href}" data-api-search-link="${escapeHtml(item)}">${escapeHtml(item)}</a>`;
    }).join("");

    return `<section class="hw-api-detail-section">
      <h3 class="hw-api-detail-section-title">See Also</h3>
      <div class="hw-api-seealso-list">${links}</div>
    </section>`;
  }

  function renderDetail(record) {
    const original = record.hnName && record.name && record.hnName !== record.name ? `<span class="hw-api-detail-original">Harbour: ${escapeHtml(record.name)}</span>` : "";
    const lede = record.summary && record.description && normalize(record.summary) !== normalize(record.description)
      ? `<p class="hw-api-detail-lede">${formatText(record.summary)}</p>`
      : "";

    return `<div class="hw-api-detail-body">
      <div class="hw-api-detail-title">
        <h2>${escapeHtml(record.displayName)}</h2>
        ${original}
      </div>
      ${lede}
      ${renderMetaGrid(record)}
      ${renderSyntax(record)}
      ${renderTextSection("Description", record.description || (!record.summary ? record.summary : ""))}
      ${renderParameters(record)}
      ${renderReturns(record)}
      ${renderExamples(record)}
      ${renderTextSection("Notes", firstDefined(record.raw, ["notes", "doc_notes", "remarks"], ""))}
      ${renderSeeAlso(record)}
    </div>`;
  }

  function renderResults(records, totalMatches) {
    if (!records.length) {
      els.results.innerHTML = `<div class="hw-api-empty-panel">No API records match the current search.</div>`;
      return;
    }

    els.results.innerHTML = records.map(record => `<details class="hw-api-result-row" id="api-${escapeHtml(record.id)}">
      ${renderSummary(record)}
      ${renderDetail(record)}
    </details>`).join("");

    if (records.length === 1 || totalMatches === 1) {
      const only = els.results.querySelector("details");
      if (only) only.open = true;
    }
  }

  function resetSearch() {
    els.query.value = "";
    els.category.value = "";
    els.searchAllText.checked = false;
    setMatchMode("starts");
    filterRecords(true);
    els.query.focus();
  }

  function searchSeeAlso(name) {
    els.query.value = name;
    els.category.value = "";
    els.searchAllText.checked = false;
    setMatchMode("exact");
    filterRecords(true);
    els.form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (els.form) {
    els.form.addEventListener("submit", event => {
      event.preventDefault();
      filterRecords(true);
    });
  }

  if (els.query) {
    els.query.addEventListener("input", () => filterRecords(false));
  }

  if (els.clear) {
    els.clear.addEventListener("click", clearQuery);
  }

  if (els.category) {
    els.category.addEventListener("change", () => filterRecords(true));
  }

  document.querySelectorAll("input[name='matchMode']").forEach(input => {
    input.addEventListener("change", () => filterRecords(true));
  });

  if (els.searchAllText) {
    els.searchAllText.addEventListener("change", () => filterRecords(true));
  }

  if (els.reset) {
    els.reset.addEventListener("click", resetSearch);
  }

  if (els.results) {
    els.results.addEventListener("click", event => {
      const link = event.target.closest("[data-api-search-link]");
      if (!link) return;
      event.preventDefault();
      searchSeeAlso(link.getAttribute("data-api-search-link") || link.textContent || "");
    });
  }

  loadData();
}());
