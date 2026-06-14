(function () {
  "use strict";

  const LINKS_URL = "/links/links.json";

  const els = {
    nav: document.getElementById("linksCategoryNav"),
    list: document.getElementById("linksList"),
    search: document.getElementById("linkSearch"),
    clear: document.getElementById("linkSearchClear"),
    searchButton: document.getElementById("linkSearchButton"),
    status: document.getElementById("linksStatus"),
    empty: document.getElementById("linksEmpty"),
    root: document.getElementById("linksIndex")
  };

  let state = {
    categories: [],
    totalLinks: 0
  };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function slugFrom(value, fallback) {
    const slug = normalize(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || fallback;
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isExternalUrl(url) {
    return /^https?:\/\//i.test(String(url || ""));
  }

  function normalizeLink(rawLink, linkIndex) {
    const link = rawLink && typeof rawLink === "object" ? rawLink : {};
    return {
      title: String(link.title || link.name || `Link ${linkIndex + 1}`).trim(),
      url: String(link.url || link.href || "#").trim(),
      description: String(link.description || link.summary || link.notes || "").trim(),
      tags: asArray(link.tags).map(tag => String(tag).trim()).filter(Boolean)
    };
  }

  function normalizeCategory(rawCategory, categoryIndex) {
    const category = rawCategory && typeof rawCategory === "object" ? rawCategory : {};
    const title = String(category.title || category.name || `Category ${categoryIndex + 1}`).trim();
    const id = String(category.id || slugFrom(title, `category-${categoryIndex + 1}`)).trim();
    const links = asArray(category.links || category.items).map(normalizeLink);

    return { id, title, links };
  }

  function normalizePayload(payload) {
    const categories = asArray(payload && payload.categories).map(normalizeCategory);
    return categories.filter(category => category.links.length > 0);
  }

  function linkSearchText(category, link) {
    return normalize([
      category.title,
      link.title,
      link.url,
      link.description,
      link.tags.join(" ")
    ].join(" "));
  }

  function renderSidebar() {
    els.nav.innerHTML = state.categories.map(category => (
      `<a href="#${escapeHtml(category.id)}">${escapeHtml(category.title)}</a>`
    )).join("");
  }

  function renderLink(category, link) {
    const external = isExternalUrl(link.url);
    const targetAttrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    const icon = external ? '<i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>' : '<i class="bi bi-chevron-left" aria-hidden="true"></i>';
    const tagHtml = link.tags.length
      ? `<div class="hw-api-meta">${link.tags.map(tag => `<span class="hw-api-pill">${escapeHtml(tag)}</span>`).join("")}</div>`
      : "";

    return `<article class="hw-link-card" data-filter-item data-filter-text="${escapeHtml(linkSearchText(category, link))}">
      <h3>${escapeHtml(link.title)}</h3>
      <p><a class="hw-link-url" href="${escapeHtml(link.url)}"${targetAttrs}><span>${escapeHtml(link.url)}</span>${icon}</a></p>
      ${link.description ? `<p>${escapeHtml(link.description)}</p>` : ""}
      ${tagHtml}
    </article>`;
  }

  function renderLinks() {
    els.list.innerHTML = state.categories.map(category => (
      `<section class="hw-section" id="${escapeHtml(category.id)}" data-filter-section>
        <h2 class="hw-section-title">${escapeHtml(category.title)}</h2>
        <div class="hw-list">
          ${category.links.map(link => renderLink(category, link)).join("")}
        </div>
      </section>`
    )).join("");
  }

  function updateSidebarActive() {
    const visibleSections = Array.from(els.list.querySelectorAll("[data-filter-section]")).filter(section => !section.hidden);
    const visibleIds = new Set(visibleSections.map(section => section.id));

    Array.from(els.nav.querySelectorAll("a")).forEach(link => {
      const id = String(link.getAttribute("href") || "").replace(/^#/, "");
      link.hidden = !visibleIds.has(id);
      link.classList.toggle("active", visibleSections[0] && visibleSections[0].id === id);
    });
  }

  function updateClearButton() {
    if (els.clear) els.clear.hidden = !els.search.value;
  }

  function clearSearch() {
    els.search.value = "";
    applyFilter();
    els.search.focus();
  }

  function applyFilter() {
    const query = normalize(els.search.value);
    updateClearButton();
    const sections = Array.from(els.list.querySelectorAll("[data-filter-section]"));
    const rows = Array.from(els.list.querySelectorAll("[data-filter-item]"));
    let visibleRows = 0;

    rows.forEach(row => {
      const haystack = normalize(row.getAttribute("data-filter-text") || row.textContent);
      const visible = !query || haystack.includes(query);
      row.hidden = !visible;
      if (visible) visibleRows += 1;
    });

    sections.forEach(section => {
      const hasVisibleRows = Array.from(section.querySelectorAll("[data-filter-item]")).some(row => !row.hidden);
      section.hidden = !hasVisibleRows;
    });

    els.empty.hidden = visibleRows !== 0;
    els.root.classList.toggle("hw-filter-empty", visibleRows === 0);
    els.status.textContent = query
      ? `${visibleRows.toLocaleString()} matching link${visibleRows === 1 ? "" : "s"}.`
      : `${state.totalLinks.toLocaleString()} link${state.totalLinks === 1 ? "" : "s"} loaded from links.json.`;

    updateSidebarActive();
  }

  function bindEvents() {
    els.search.addEventListener("input", applyFilter);
    if (els.clear) els.clear.addEventListener("click", clearSearch);
    if (els.searchButton) els.searchButton.addEventListener("click", applyFilter);

    els.nav.addEventListener("click", event => {
      const link = event.target.closest("a[href^='#']");
      if (!link) return;
      Array.from(els.nav.querySelectorAll("a")).forEach(item => item.classList.remove("active"));
      link.classList.add("active");
    });
  }

  async function loadLinks() {
    try {
      const response = await fetch(LINKS_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`${LINKS_URL} returned HTTP ${response.status}`);

      const payload = await response.json();
      state.categories = normalizePayload(payload);
      state.totalLinks = state.categories.reduce((total, category) => total + category.links.length, 0);

      if (!state.totalLinks) {
        els.nav.innerHTML = '<a href="#links-top" class="active">No links</a>';
        els.status.textContent = "links.json loaded, but it did not contain any links.";
        els.list.innerHTML = "";
        els.empty.hidden = false;
        return;
      }

      renderSidebar();
      renderLinks();
      bindEvents();
      applyFilter();
    } catch (error) {
      els.nav.innerHTML = '<a href="#links-top" class="active">Links unavailable</a>';
      els.status.innerHTML = `Could not load <code>${escapeHtml(LINKS_URL)}</code>. ${escapeHtml(error.message)}`;
      els.list.innerHTML = "";
      els.empty.hidden = true;
    }
  }

  if (els.nav && els.list && els.search && els.status && els.empty && els.root) {
    loadLinks();
  }
}());
