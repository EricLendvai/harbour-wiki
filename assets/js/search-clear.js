(function () {
  "use strict";

  function refresh(input) {
    const clearButton = input.parentElement ? input.parentElement.querySelector(".hw-search-clear") : null;
    if (clearButton) {
      clearButton.classList.toggle("is-visible", input.value.length > 0);
      clearButton.disabled = input.value.length === 0;
      clearButton.tabIndex = input.value.length > 0 ? 0 : -1;
      clearButton.setAttribute("aria-hidden", input.value.length > 0 ? "false" : "true");
    }
  }

  function setup(input) {
    const group = input.closest(".hw-search-group");
    if (!group || input.dataset.searchClearReady === "1") return;

    const clearButton = group.querySelector(".hw-search-clear");
    if (!clearButton) return;

    clearButton.removeAttribute("hidden");
    clearButton.hidden = false;
    clearButton.type = "button";

    input.addEventListener("input", function () {
      refresh(input);
    });

    input.addEventListener("change", function () {
      refresh(input);
    });

    clearButton.addEventListener("click", function (event) {
      event.preventDefault();
      input.value = "";
      refresh(input);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.focus();
    });

    input.dataset.searchClearReady = "1";
    refresh(input);
  }

  function setupAll() {
    document.querySelectorAll(".hw-search-group input[type='search']").forEach(setup);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupAll);
  } else {
    setupAll();
  }
}());
