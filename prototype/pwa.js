(function () {
  const DISMISS_KEY = "kuroha-install-dismissed";
  const INSTALLED_KEY = "kuroha-installed";
  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  let deferredPrompt = null;
  let promptElement = null;
  let hideTimer = null;

  function readFlag(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeFlag(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {}
  }

  function toast(message) {
    if (window.KurohaToast) window.KurohaToast(message);
  }

  function hidePrompt(remember) {
    if (!promptElement) return;
    if (remember) writeFlag(DISMISS_KEY, "1");
    promptElement.classList.remove("is-visible");
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (promptElement) promptElement.hidden = true;
    }, 180);
  }

  function showPrompt() {
    if (!promptElement || isStandalone() || readFlag(DISMISS_KEY) === "1") return;
    window.clearTimeout(hideTimer);
    promptElement.hidden = false;
    window.requestAnimationFrame(() => {
      if (promptElement) promptElement.classList.add("is-visible");
    });
  }

  function buildPrompt() {
    if (promptElement || document.querySelector(".install-prompt")) return;

    promptElement = document.createElement("aside");
    promptElement.className = "install-prompt";
    promptElement.setAttribute("aria-labelledby", "install-title");
    promptElement.hidden = true;
    promptElement.innerHTML = `
      <img class="install-prompt__icon" src="assets/icon-192.png" alt="" width="42" height="42">
      <div class="install-prompt__body">
        <p class="install-prompt__label">Приложение</p>
        <h2 id="install-title">Kuroha рядом</h2>
        <p>Установи библиотеку — она откроется без адресной строки и сохранит твоё место.</p>
        <div class="install-prompt__actions">
          <button class="btn btn--primary btn--small" type="button" data-install-accept>Установить</button>
          <button class="btn btn--ghost btn--small" type="button" data-install-close>Позже</button>
        </div>
      </div>
      <button class="install-prompt__close" type="button" data-install-close aria-label="Закрыть предложение установки">×</button>
    `;

    promptElement.addEventListener("click", async (event) => {
      const closeButton = event.target.closest("[data-install-close]");
      if (closeButton) {
        hidePrompt(true);
        return;
      }

      const acceptButton = event.target.closest("[data-install-accept]");
      if (!acceptButton || !deferredPrompt) return;

      const prompt = deferredPrompt;
      deferredPrompt = null;
      acceptButton.disabled = true;
      prompt.prompt();

      try {
        const choice = await prompt.userChoice;
        if (choice.outcome === "accepted") {
          writeFlag(INSTALLED_KEY, "1");
          hidePrompt(true);
          toast("Kuroha установлена. Читай между строк.");
        } else {
          hidePrompt(true);
        }
      } catch (error) {
        hidePrompt(true);
      } finally {
        acceptButton.disabled = false;
      }
    });

    document.body.appendChild(promptElement);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "http:" && location.protocol !== "https:") return;

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js?v=cloud2").catch(() => {});
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    const prepare = () => {
      buildPrompt();
      showPrompt();
    };
    if (document.body) {
      prepare();
    } else {
      document.addEventListener("DOMContentLoaded", prepare, { once: true });
    }
  });

  window.addEventListener("appinstalled", () => {
    writeFlag(INSTALLED_KEY, "1");
    hidePrompt(true);
    toast("Kuroha установлена. Читай между строк.");
  });

  window.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector(".install-prompt")) return;
    buildPrompt();
  });

  window.KurohaPWA = {
    show: showPrompt,
    dismiss: () => hidePrompt(true)
  };

  registerServiceWorker();
})();

