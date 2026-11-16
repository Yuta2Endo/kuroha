/* Kuroha 3.0 — 18+ age gate */
(function () {
  "use strict";

  const page = document.body.dataset.page;
  if (page !== "title" && page !== "reader") return;

  const TITLES = window.KUROHA_TITLES || [];
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug") || "pepel-i-luna";
  const item = TITLES.find((entry) => entry.slug === slug);
  const OK_KEY = "kuroha-age-ok";

  if (!item || !item.adult) return;
  try {
    if (localStorage.getItem(OK_KEY) === "1") return;
  } catch (error) {}

  const dialog = document.createElement("dialog");
  dialog.className = "age-gate";
  dialog.id = "age-gate";
  dialog.setAttribute("aria-labelledby", "age-gate-title");
  dialog.innerHTML = [
    '<div class="age-gate__panel">',
    '<span class="age-gate__badge" aria-hidden="true">18+</span>',
    '<p class="eyebrow">Возрастное ограничение</p>',
    '<h2 id="age-gate-title">Эта история<br>для взрослых.</h2>',
    '<p><strong>«' + escapeHTML(item.title) + '»</strong> помечена 18+. Здесь могут быть тяжёлые темы, страх и насилие. Подтверди, что тебе есть 18 лет.</p>',
    '<div class="age-gate__actions">',
    '<button class="btn btn--primary" type="button" data-age-confirm>Мне есть 18</button>',
    '<button class="btn btn--ghost" type="button" data-age-cancel>Вернуться в каталог</button>',
    '</div>',
    '<p class="age-gate__note">Отметка демонстрационная. <a href="rules.html#age">Правила для 18+</a></p>',
    '</div>'
  ].join("");
  document.body.appendChild(dialog);

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function close() {
    if (typeof dialog.close === "function") {
      try { dialog.close(); } catch (error) { dialog.removeAttribute("open"); }
    } else {
      dialog.removeAttribute("open");
    }
  }

  function confirmAge() {
    try { localStorage.setItem(OK_KEY, "1"); } catch (error) {}
    close();
    if (window.KurohaToast) window.KurohaToast("Возраст подтверждён. Приятного чтения.");
  }

  function decline() {
    close();
    window.location.href = "catalog.html?adult=blocked";
  }

  dialog.querySelector("[data-age-confirm]").addEventListener("click", confirmAge);
  dialog.querySelector("[data-age-cancel]").addEventListener("click", decline);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    decline();
  });

  if (typeof dialog.showModal === "function") {
    try { dialog.showModal(); } catch (error) { dialog.setAttribute("open", ""); }
  } else {
    dialog.setAttribute("open", "");
  }
  const confirmButton = dialog.querySelector("[data-age-confirm]");
  if (confirmButton) confirmButton.focus();

  window.KurohaAgeGate = {
    open: () => {
      if (!dialog.open) {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      }
    },
    isAllowed: () => {
      try { return localStorage.getItem(OK_KEY) === "1"; } catch (error) { return false; }
    }
  };
})();
