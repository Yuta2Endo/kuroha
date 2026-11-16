/* Kuroha 3.0 — local demo session */
(function () {
  "use strict";

  const KEY = "kuroha-session";
  const page = document.body.dataset.page;

  function readSession() {
    try {
      const session = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!session || typeof session.name !== "string" || !session.name.trim()) return null;
      return session;
    } catch (error) {
      return null;
    }
  }

  function initials(name) {
    return String(name || "K")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  function shortName(name) {
    const value = String(name || "").trim();
    return value.length > 16 ? value.slice(0, 15) + "…" : value;
  }

  function updateLinks(session) {
    document.querySelectorAll('a[href="auth.html"]').forEach((link) => {
      if (!session) return;
      link.href = "profile.html";
      link.textContent = shortName(session.name);
      link.setAttribute("title", "Профиль · " + session.name);
      link.setAttribute("aria-label", "Профиль " + session.name);
    });
  }

  function saveSession(name, email, provider) {
    const cleanName = String(name || "").trim().slice(0, 40) || "Читатель";
    const cleanEmail = String(email || "").trim().slice(0, 120);
    const session = {
      name: cleanName,
      email: cleanEmail,
      provider: provider || "email",
      createdAt: new Date().toISOString()
    };
    try { localStorage.setItem(KEY, JSON.stringify(session)); } catch (error) {}
    updateLinks(session);
    return session;
  }

  function clearSession() {
    try { localStorage.removeItem(KEY); } catch (error) {}
    document.querySelectorAll('a[href="profile.html"]').forEach((link) => {
      if (link.classList.contains("login")) {
        link.href = "auth.html";
        link.textContent = "Войти";
        link.removeAttribute("title");
        link.removeAttribute("aria-label");
      }
    });
  }

  const session = readSession();
  updateLinks(session);

  if (page !== "auth") {
    window.KurohaAuth = {
      read: readSession,
      login: saveSession,
      logout: clearSession
    };
    return;
  }

  const form = document.querySelector("#auth-form");
  const sessionBox = document.querySelector("#auth-session");
  const formBox = document.querySelector("#auth-form-box");
  const nameInput = document.querySelector("#auth-name");
  const emailInput = document.querySelector("#auth-email");
  const sessionName = document.querySelector("#auth-session-name");
  const sessionMeta = document.querySelector("#auth-session-meta");
  const sessionAvatar = document.querySelector("#auth-session-avatar");
  const logout = document.querySelector("#auth-logout");

  function showSession(current) {
    if (!current) return;
    if (sessionBox) sessionBox.hidden = false;
    if (formBox) formBox.hidden = true;
    if (sessionName) sessionName.textContent = current.name;
    if (sessionAvatar) sessionAvatar.textContent = initials(current.name);
    if (sessionMeta) {
      const provider = current.provider === "telegram" ? "Telegram" : current.provider === "vk" ? "VK" : "Email";
      sessionMeta.textContent = (current.email || "локальная сессия") + " · " + provider;
    }
  }

  if (session) showSession(session);

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = emailInput ? emailInput.value.trim() : "";
      if (!email || email.indexOf("@") === -1) {
        if (window.KurohaToast) window.KurohaToast("Укажи email — он нужен для демо-сессии.");
        if (emailInput) emailInput.focus();
        return;
      }
      const name = nameInput && nameInput.value.trim() ? nameInput.value.trim() : email.split("@")[0];
      const current = saveSession(name, email, "email");
      showSession(current);
      if (window.KurohaToast) window.KurohaToast("Ты вошёл в Kuroha. Сессия сохранена локально.");
    });
  }

  document.querySelectorAll("[data-auth-provider]").forEach((button) => {
    button.addEventListener("click", () => {
      const provider = button.dataset.authProvider;
      const label = provider === "telegram" ? "Telegram" : "VK";
      const current = saveSession("Гость Kuroha", "guest@kuroha.org", provider);
      showSession(current);
      if (window.KurohaToast) window.KurohaToast("Демо-вход через " + label + ". Это локальная сессия.");
    });
  });

  if (logout) {
    logout.addEventListener("click", () => {
      clearSession();
      window.location.reload();
    });
  }

  window.KurohaAuth = {
    read: readSession,
    login: saveSession,
    logout: clearSession
  };
})();
