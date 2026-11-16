/* Kuroha — quiet yearly reading goal. */
(function () {
  "use strict";

  var KEY = "kuroha-reading-goal";
  var PROGRESS_KEY = "kuroha-progress";
  var DEFAULT_TARGET = 500;
  var MIN_TARGET = 50;
  var MAX_TARGET = 5000;

  var root = document.querySelector("#profile-goal");
  if (!root) return;

  var titles = window.KUROHA_TITLES || [];
  var uploads = window.KurohaUploads;
  var bySlug = {};
  titles.forEach(function (item) {
    bySlug[item.slug] = item;
  });

  function $(selector) {
    return root.querySelector(selector);
  }

  function storageRead(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function storageWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function clamp(value, min, max, fallback) {
    if (value === null || value === undefined || value === "") return fallback;
    var number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function readGoal() {
    var saved = storageRead(KEY, null);
    return clamp(saved && saved.target, MIN_TARGET, MAX_TARGET, DEFAULT_TARGET);
  }

  function writeGoal(target) {
    storageWrite(KEY, { target: target, year: new Date().getFullYear() });
  }

  function readChapters() {
    var progress = storageRead(PROGRESS_KEY, {});
    var total = 0;
    Object.keys(progress).forEach(function (slug) {
      var item = bySlug[slug];
      if (!item) return;
      var available = uploads && typeof uploads.totalFor === "function"
        ? uploads.totalFor(slug, item.chapters)
        : item.chapters;
      total += Math.min(Number(progress[slug]) || 0, available);
    });
    return total;
  }

  function plural(number, forms) {
    var abs = Math.abs(number) % 100;
    var last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  }

  function render() {
    var chapters = readChapters();
    var target = readGoal();
    var percent = Math.min(100, Math.round((chapters / target) * 100));
    var remaining = Math.max(0, target - chapters);
    var current = $("#goal-current");
    var targetNode = $("#goal-target");
    var percentNode = $("#goal-percent");
    var bar = $("#goal-progress");
    var status = $("#goal-status");

    if (current) current.textContent = String(chapters);
    if (targetNode) targetNode.textContent = String(target);
    if (percentNode) percentNode.textContent = percent + "%";
    if (bar) bar.style.width = percent + "%";
    root.style.setProperty("--goal-progress", percent + "%");

    if (status) {
      if (chapters >= target) {
        status.textContent = "Цель закрыта. Можно поставить новую — без спешки.";
      } else {
        status.textContent = "Осталось " + remaining + " " +
          plural(remaining, ["глава", "главы", "глав"]) +
          " до конца года.";
      }
    }
  }

  function syncPresets(target) {
    document.querySelectorAll("[data-goal-preset]").forEach(function (button) {
      var active = Number(button.getAttribute("data-goal-preset")) === target;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function openDialog() {
    var dialog = document.querySelector("#goal-dialog");
    var input = document.querySelector("#goal-input");
    if (!dialog || !input) return;
    var target = readGoal();
    input.value = String(target);
    syncPresets(target);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    window.setTimeout(function () {
      input.focus();
      input.select();
    }, 20);
  }

  function closeDialog() {
    var dialog = document.querySelector("#goal-dialog");
    if (dialog && typeof dialog.close === "function") dialog.close();
  }

  function bind() {
    var dialog = document.querySelector("#goal-dialog");
    var form = document.querySelector("#goal-form");
    var input = document.querySelector("#goal-input");

    root.querySelectorAll("[data-goal-edit]").forEach(function (button) {
      button.addEventListener("click", openDialog);
    });

    document.querySelectorAll("[data-goal-close], [data-goal-cancel]").forEach(function (button) {
      button.addEventListener("click", closeDialog);
    });

    document.querySelectorAll("[data-goal-preset]").forEach(function (button) {
      button.addEventListener("click", function () {
        var value = button.getAttribute("data-goal-preset");
        if (input) input.value = value;
        syncPresets(Number(value));
      });
    });

    if (input) {
      input.addEventListener("input", function () {
        syncPresets(Number(input.value));
      });
    }

    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var target = clamp(input && input.value, MIN_TARGET, MAX_TARGET, DEFAULT_TARGET);
        writeGoal(target);
        render();
        closeDialog();
        if (window.KurohaToast) window.KurohaToast("Цель года: " + target + " глав.");
      });
    }

    if (dialog) {
      dialog.addEventListener("click", function (event) {
        if (event.target === dialog) closeDialog();
      });
    }

    document.addEventListener("click", function (event) {
      if (event.target.closest && event.target.closest("[data-profile-reset]")) {
        window.setTimeout(render, 60);
      }
    });

    window.addEventListener("kuroha:goal-reset", render);

    window.addEventListener("storage", function (event) {
      if (!event.key || event.key === KEY || event.key === PROGRESS_KEY) render();
    });
  }

  bind();
  render();
})();
