/* Kuroha — editable reader profile. Stores name, bio and avatar locally. */
(function () {
  const KEY = "kuroha-profile";
  const DEFAULT_PROFILE = {
    name: "Ночной читатель",
    bio: "Читаю между строк. Собираю истории, которые не отпускают, и возвращаюсь к ним, когда город засыпает.",
    avatar: "ink"
  };

  const $ = (selector) => document.querySelector(selector);
  const dialog = $("#profile-edit-dialog");
  const form = $("#profile-edit-form");
  const nameInput = $("#profile-edit-name");
  const bioInput = $("#profile-edit-bio");
  const title = $("#profile-title");
  const bio = $(".profile-bio");
  const avatar = $(".profile-avatar");
  if (!dialog || !form || !nameInput || !bioInput || !title || !bio || !avatar) return;

  const avatarImage = avatar.querySelector("img");

  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!saved || typeof saved !== "object") return { ...DEFAULT_PROFILE };
      return {
        name: String(saved.name || DEFAULT_PROFILE.name).slice(0, 32),
        bio: String(saved.bio || DEFAULT_PROFILE.bio).slice(0, 160),
        avatar: ["ink", "paper", "red"].includes(saved.avatar) ? saved.avatar : "ink"
      };
    } catch (error) {
      return { ...DEFAULT_PROFILE };
    }
  }

  function write(profile) {
    try {
      localStorage.setItem(KEY, JSON.stringify(profile));
    } catch (error) {}
  }

  function remove() {
    try {
      localStorage.removeItem(KEY);
    } catch (error) {}
  }

  function apply(profile) {
    title.textContent = profile.name || DEFAULT_PROFILE.name;
    bio.textContent = profile.bio || DEFAULT_PROFILE.bio;
    avatar.dataset.avatar = profile.avatar || "ink";
    if (avatarImage) {
      avatarImage.src =
        profile.avatar === "red"
          ? "assets/logo-symbol.svg"
          : "assets/logo-symbol-ink.svg";
    }
  }

  function fillForm() {
    const profile = read();
    nameInput.value = profile.name;
    bioInput.value = profile.bio;
    const choice = form.querySelector(
      'input[name="avatar"][value="' + profile.avatar + '"]'
    );
    if (choice) choice.checked = true;
  }

  function open() {
    fillForm();
    dialog.showModal();
    window.setTimeout(() => nameInput.focus(), 60);
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  document.querySelector("[data-profile-edit]")?.addEventListener("click", open);
  form.querySelectorAll("[data-profile-edit-close], [data-profile-edit-cancel]").forEach((button) => {
    button.addEventListener("click", close);
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const choice = form.querySelector('input[name="avatar"]:checked');
    const profile = {
      name: nameInput.value.trim().slice(0, 32) || DEFAULT_PROFILE.name,
      bio: bioInput.value.trim().slice(0, 160) || DEFAULT_PROFILE.bio,
      avatar: choice ? choice.value : "ink"
    };
    write(profile);
    apply(profile);
    close();
    if (window.KurohaToast) window.KurohaToast("Профиль обновлён.");
  });

  document.querySelector("[data-profile-reset]")?.addEventListener("click", () => {
    window.setTimeout(() => {
      remove();
      apply({ ...DEFAULT_PROFILE });
    }, 0);
  });

  window.addEventListener("storage", (event) => {
    if (event.key === KEY) apply(read());
  });

  apply(read());
})();
