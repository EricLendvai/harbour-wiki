(function () {
  "use strict";

  const ARTICLES_URL = "/articles/articles.json";

  let loadedArticleCount = 0;

  const els = {
    nav: document.getElementById("articleCategoryNav"),
    container: document.getElementById("articlesIndex"),
    list: document.getElementById("articlesList"),
    search: document.getElementById("articleSearch"),
    clear: document.getElementById("articleSearchClear"),
    searchButton: document.getElementById("articleSearchButton"),
    status: document.getElementById("articlesStatus"),
    empty: document.querySelector("[data-filter-empty]")
  };

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function articleUrl(article) {
    const explicit = String(article.url || "").trim();
    if (explicit) return explicit;
    return `/articles/${encodeURIComponent(article.slug || "")}/`;
  }

  function categoryArticles(data) {
    return Array.isArray(data.categories) ? data.categories : [];
  }

  function uniqueArticles(categories) {
    const bySlug = new Map();
    for (const category of categories) {
      for (const article of Array.isArray(category.articles) ? category.articles : []) {
        const key = String(article.slug || article.url || article.title || "").trim().toLowerCase();
        if (!key || bySlug.has(key)) continue;
        bySlug.set(key, Object.assign({}, article, { categories: [category.title] }));
      }
    }
    return Array.from(bySlug.values()).sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
  }

  function renderSidebar(categories) {
    els.nav.innerHTML = categories
      .map(category => `<a href="#${escapeHtml(category.id)}">${escapeHtml(category.title)}</a>`)
      .join("") + `<a href="#alphabetical-articles">Alphabetical</a>`;
  }

  function articleKey(article) {
    return String(article.slug || article.url || article.title || "").trim().toLowerCase();
  }

  function renderArticleRow(article, categoryTitle) {
    const url = articleUrl(article);
    const key = articleKey(article);
    const summary = String(article.summary || "").trim();
    const status = String(article.status || "").trim();
    const filterText = [categoryTitle, article.title, article.slug, summary, status].filter(Boolean).join(" ");

    return `<a class="hw-list-row hw-article-row" href="${escapeHtml(url)}" target="_blank" data-article-link data-filter-item data-article-key="${escapeHtml(key)}" data-filter-text="${escapeHtml(filterText)}">
      <span class="hw-row-text">
        <span class="hw-article-title-line"><span>${escapeHtml(article.title)}</span></span>
      </span>
    </a>`;
  }

  function renderCategorySection(category) {
    const articles = Array.isArray(category.articles) ? category.articles : [];
    if (!articles.length) return "";

    return `<section class="hw-section" id="${escapeHtml(category.id)}" data-filter-section>
      <h2 class="hw-section-title">${escapeHtml(category.title)}</h2>
      <div class="hw-list">
        ${articles.map(article => renderArticleRow(article, category.title)).join("")}
      </div>
    </section>`;
  }

  function renderAlphabeticalSection(categories) {
    const articles = uniqueArticles(categories);
    if (!articles.length) return "";

    return `<section class="hw-section hw-article-alpha-section" id="alphabetical-articles" data-filter-section>
      <h2 class="hw-section-title">Alphabetical Articles</h2>
      <div class="hw-list">
        ${articles.map(article => renderArticleRow(article, (article.categories || []).join(" "))).join("")}
      </div>
    </section>`;
  }

  function setLoadedStatus() {
    if (!els.status) return;
    els.status.textContent = `${loadedArticleCount.toLocaleString()} article${loadedArticleCount === 1 ? "" : "s"} loaded. Click an article to open it in a new tab.`;
  }

  function setMatchStatus(matchCount) {
    if (!els.status) return;
    els.status.textContent = `${matchCount.toLocaleString()} matching article${matchCount === 1 ? "" : "s"}. Click an article to open it in a new tab.`;
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
    const rows = Array.from(els.container.querySelectorAll("[data-filter-item]"));
    const sections = Array.from(els.container.querySelectorAll("[data-filter-section]"));
    const visibleArticleKeys = new Set();

    rows.forEach(row => {
      const haystack = normalize(row.getAttribute("data-filter-text") || row.textContent);
      const visible = !query || haystack.includes(query);
      row.hidden = !visible;
      if (visible) {
        visibleArticleKeys.add(row.getAttribute("data-article-key") || haystack);
      }
    });

    sections.forEach(section => {
      const hasVisibleRows = Array.from(section.querySelectorAll("[data-filter-item]")).some(row => !row.hidden);
      section.hidden = !hasVisibleRows;
    });

    const visibleArticleCount = visibleArticleKeys.size;
    if (els.empty) els.empty.hidden = visibleArticleCount !== 0;
    els.container.classList.toggle("hw-filter-empty", visibleArticleCount === 0);

    if (query) {
      setMatchStatus(visibleArticleCount);
    } else {
      setLoadedStatus();
    }
  }

  function openArticle(event) {
    const link = event.target.closest("[data-article-link]");
    if (!link) return;

    event.preventDefault();
    const articleWindow = window.open(link.href, "_blank");
    if (articleWindow) {
      articleWindow.focus();
    } else {
      window.location.href = link.href;
    }
  }

  async function loadArticles() {
    try {
      const response = await fetch(ARTICLES_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`${ARTICLES_URL} returned HTTP ${response.status}`);
      const data = await response.json();
      const categories = categoryArticles(data);
      loadedArticleCount = uniqueArticles(categories).length;

      renderSidebar(categories);
      els.list.innerHTML = categories.map(renderCategorySection).join("") + renderAlphabeticalSection(categories);
      setLoadedStatus();
      applyFilter();
    } catch (error) {
      els.nav.innerHTML = "";
      els.list.innerHTML = "";
      els.status.innerHTML = `Article JSON was not found or could not be read. <small>${escapeHtml(error.message)}</small>`;
    }
  }

  if (!els.container || !els.list || !els.search || !els.nav) return;

  els.search.addEventListener("input", applyFilter);
  if (els.clear) els.clear.addEventListener("click", clearSearch);
  if (els.searchButton) els.searchButton.addEventListener("click", applyFilter);
  els.list.addEventListener("click", openArticle);
  loadArticles();
}());
