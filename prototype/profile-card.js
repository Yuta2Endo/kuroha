/* Kuroha — reader profile card, rendered locally on Canvas. */
(function () {
  "use strict";

  const PROFILE_KEY = "kuroha-profile";
  const DEFAULT_PROFILE = {
    name: "Ночной читатель",
    bio: "Читаю между строк. Собираю истории, которые не отпускают, и возвращаюсь к ним, когда город засыпает.",
    avatar: "ink"
  };
  const GENRE_LABELS = {
    fantasy: "фэнтези",
    romance: "романтика",
    drama: "драма",
    action: "экшен",
    mystery: "мистика",
    slice: "повседневность",
    history: "история",
    scifi: "фантастика",
    horror: "хоррор",
    comedy: "комедия",
    adventure: "приключения",
    thriller: "триллер"
  };
  const TYPE_LABELS = {
    manga: "манга",
    manhwa: "манхва",
    manhua: "маньхуа",
    novel: "новелла"
  };
  const COLORS = {
    ink: "#17171b",
    deep: "#0b0b0e",
    surface: "#1f1f24",
    paper: "#f5f3f0",
    red: "#e63946",
    redLight: "#ff6b73",
    muted: "#a5a3aa",
    faint: "#6f6d72"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const dialog = $("#profile-card-dialog");
  if (!dialog) return;

  const canvas = $("#profile-card-canvas");
  const stage = $("#profile-card-stage");
  const nameOutput = $("#profile-card-name");
  const openButtons = document.querySelectorAll("[data-profile-card]");
  const titles = window.KUROHA_TITLES || [];
  const bySlug = new Map(titles.map((item) => [item.slug, item]));
  const libraryApi = window.KurohaLibrary;
  const ratingsApi = window.KurohaRatings;
  const uploadsApi = window.KurohaUploads;
  const imageCache = new Map();
  let drawing = false;

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === "object" ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function getProfile() {
    const saved = readJSON(PROFILE_KEY, {});
    const name = typeof saved.name === "string" && saved.name.trim()
      ? saved.name.trim().slice(0, 32)
      : DEFAULT_PROFILE.name;
    const bio = typeof saved.bio === "string" && saved.bio.trim()
      ? saved.bio.trim().slice(0, 160)
      : DEFAULT_PROFILE.bio;
    const avatar = ["ink", "paper", "red"].includes(saved.avatar) ? saved.avatar : "ink";
    return { name, bio, avatar };
  }

  function totalChapters(item) {
    const base = Number(item && item.chapters) || 0;
    return uploadsApi && typeof uploadsApi.totalFor === "function"
      ? Math.max(base, uploadsApi.totalFor(item.slug, base))
      : base;
  }

  function getProgress() {
    const raw = readJSON("kuroha-progress", {});
    const result = {};
    Object.keys(raw).forEach((slug) => {
      const item = bySlug.get(slug);
      const value = Number(raw[slug]);
      if (!item || !Number.isFinite(value) || value < 1) return;
      result[slug] = Math.min(Math.round(value), totalChapters(item));
    });
    return result;
  }

  function getShelf() {
    const raw = libraryApi && typeof libraryApi.read === "function"
      ? libraryApi.read()
      : readJSON("kuroha-library", {});
    const result = {};
    Object.keys(raw || {}).forEach((slug) => {
      if (bySlug.has(slug)) result[slug] = raw[slug];
    });
    return result;
  }

  function getStats() {
    const shelf = getShelf();
    const progress = getProgress();
    const ratings = ratingsApi && typeof ratingsApi.read === "function"
      ? ratingsApi.read()
      : readJSON("kuroha-ratings", {});
    const ratingCount = Object.keys(ratings || {}).filter((slug) => bySlug.has(slug)).length;
    const shelfSlugs = Object.keys(shelf);
    const progressSlugs = Object.keys(progress);
    const chapters = Object.values(progress).reduce((sum, value) => sum + value, 0);

    const genreCount = {};
    const sources = Array.from(new Set(shelfSlugs.concat(progressSlugs)));
    sources.forEach((slug) => {
      const item = bySlug.get(slug);
      (item.genres || []).forEach((genre) => {
        genreCount[genre] = (genreCount[genre] || 0) + 1;
      });
    });
    const topGenres = Object.keys(genreCount)
      .sort((a, b) => genreCount[b] - genreCount[a] || a.localeCompare(b))
      .slice(0, 3)
      .map((genre) => GENRE_LABELS[genre] || genre);

    const topTitles = titles
      .slice()
      .sort((a, b) => {
        const aShelf = shelf[a.slug] === "reading" ? 4 : shelf[a.slug] ? 2 : 0;
        const bShelf = shelf[b.slug] === "reading" ? 4 : shelf[b.slug] ? 2 : 0;
        const aProgress = progress[a.slug] ? progress[a.slug] / Math.max(1, totalChapters(a)) : 0;
        const bProgress = progress[b.slug] ? progress[b.slug] / Math.max(1, totalChapters(b)) : 0;
        return bShelf + bProgress * 3 + b.rating / 20 - (aShelf + aProgress * 3 + a.rating / 20);
      })
      .slice(0, 3);

    return {
      shelf: shelfSlugs.length,
      history: progressSlugs.length,
      chapters,
      ratings: ratingCount,
      topGenres,
      topTitles
    };
  }

  function loadImage(src) {
    if (imageCache.has(src)) return imageCache.get(src);
    const promise = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
    imageCache.set(src, promise);
    return promise;
  }

  function rounded(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, maxWidth, maxLines) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth || !line) {
        line = test;
      } else {
        lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      const clipped = lines.slice(0, maxLines);
      clipped[maxLines - 1] = `${clipped[maxLines - 1].replace(/[.,;:!?]?$/, "")}…`;
      return clipped;
    }
    return lines;
  }

  function drawFallbackMark(ctx, x, y, size, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.055;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + size * 0.2, y + size * 0.29);
    ctx.quadraticCurveTo(x + size * 0.5, y + size * 0.18, x + size * 0.8, y + size * 0.29);
    ctx.moveTo(x + size * 0.23, y + size * 0.4);
    ctx.lineTo(x + size * 0.77, y + size * 0.4);
    ctx.moveTo(x + size * 0.34, y + size * 0.4);
    ctx.lineTo(x + size * 0.32, y + size * 0.78);
    ctx.moveTo(x + size * 0.66, y + size * 0.4);
    ctx.lineTo(x + size * 0.68, y + size * 0.78);
    ctx.moveTo(x + size * 0.28, y + size * 0.56);
    ctx.lineTo(x + size * 0.72, y + size * 0.56);
    ctx.stroke();
    ctx.fillStyle = COLORS.red;
    ctx.beginPath();
    ctx.arc(x + size * 0.82, y + size * 0.7, size * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  async function drawMark(ctx, x, y, size, tone = "paper") {
    const image = await loadImage(tone === "ink" ? "assets/logo-symbol-ink.svg" : "assets/logo-symbol.svg");
    if (image) {
      ctx.drawImage(image, x, y, size, size);
    } else {
      drawFallbackMark(ctx, x, y, size, tone === "ink" ? COLORS.ink : COLORS.paper);
    }
  }

  async function drawAvatar(ctx, profile, x, y, size) {
    const palette = {
      ink: { bg: COLORS.paper, ring: "rgba(23,23,27,.18)", image: "ink" },
      paper: { bg: COLORS.paper, ring: COLORS.red, image: "ink" },
      red: { bg: COLORS.red, ring: "rgba(245,243,240,.16)", image: "paper" }
    }[profile.avatar] || { bg: COLORS.paper, ring: COLORS.red, image: "ink" };
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = palette.bg;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = palette.ring;
    ctx.stroke();
    ctx.clip();
    await drawMark(ctx, x + size * 0.22, y + size * 0.22, size * 0.56, palette.image);
    ctx.restore();
  }

  function drawCover(ctx, item, x, y, width, height) {
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, item.c1 || COLORS.surface);
    gradient.addColorStop(1, item.c2 || COLORS.deep);
    ctx.save();
    rounded(ctx, x, y, width, height, 8);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = item.accent || COLORS.red;
    ctx.fillRect(x + 16, y + 18, 38, 3);
    ctx.font = "600 22px 'Exo 2', sans-serif";
    ctx.fillStyle = COLORS.paper;
    const lines = wrapText(ctx, item.title, width - 34, 3);
    lines.forEach((line, index) => ctx.fillText(line, x + 17, y + 58 + index * 27));
    ctx.font = "500 12px 'Exo 2', sans-serif";
    ctx.fillStyle = "rgba(245,243,240,.64)";
    ctx.fillText((TYPE_LABELS[item.type] || item.type || "").toUpperCase(), x + 17, y + height - 18);
    ctx.restore();
    ctx.strokeStyle = "rgba(245,243,240,.16)";
    ctx.lineWidth = 1;
    rounded(ctx, x + 0.5, y + 0.5, width - 1, height - 1, 8);
    ctx.stroke();
  }

  function drawStat(ctx, value, label, x, y, width) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.paper;
    ctx.font = "600 54px 'Exo 2', sans-serif";
    ctx.fillText(String(value), x + width / 2, y);
    ctx.fillStyle = COLORS.faint;
    ctx.font = "500 15px 'Exo 2', sans-serif";
    ctx.fillText(label, x + width / 2, y + 30);
    ctx.restore();
  }

  function drawChip(ctx, text, x, y) {
    ctx.save();
    ctx.font = "500 18px 'Exo 2', sans-serif";
    const width = ctx.measureText(text).width + 32;
    rounded(ctx, x, y, width, 38, 19);
    ctx.fillStyle = "rgba(230,57,70,.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(230,57,70,.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = COLORS.paper;
    ctx.fillText(text, x + 16, y + 25);
    ctx.restore();
    return width;
  }

  async function drawCard() {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const profile = getProfile();
    const stats = getStats();
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, 0, width, height);

    let glow = ctx.createRadialGradient(130, 80, 0, 130, 80, 650);
    glow.addColorStop(0, "rgba(230,57,70,.23)");
    glow.addColorStop(0.55, "rgba(230,57,70,.05)");
    glow.addColorStop(1, "rgba(230,57,70,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    let bottom = ctx.createLinearGradient(0, height - 420, 0, height);
    bottom.addColorStop(0, "rgba(11,11,14,0)");
    bottom.addColorStop(1, "rgba(11,11,14,.72)");
    ctx.fillStyle = bottom;
    ctx.fillRect(0, height - 420, width, 420);

    ctx.strokeStyle = "rgba(245,243,240,.14)";
    ctx.lineWidth = 2;
    ctx.strokeRect(34, 34, width - 68, height - 68);

    await drawMark(ctx, 72, 70, 78, "paper");
    ctx.fillStyle = COLORS.paper;
    ctx.font = "600 32px 'Exo 2', sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText("KUROHA", 172, 118);
    ctx.font = "500 14px 'Exo 2', sans-serif";
    ctx.fillStyle = COLORS.faint;
    ctx.fillText("МАНГА · СООБЩЕСТВО · И ЕЩЁ", 173, 140);
    ctx.letterSpacing = "0px";

    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.red;
    ctx.font = "600 15px 'Exo 2', sans-serif";
    ctx.fillText("КАРТОЧКА ЧИТАТЕЛЯ", 1008, 104);
    ctx.fillStyle = COLORS.faint;
    ctx.font = "500 16px 'Exo 2', sans-serif";
    ctx.fillText("2026", 1008, 128);
    ctx.textAlign = "left";

    await drawAvatar(ctx, profile, 74, 208, 156);
    ctx.fillStyle = COLORS.paper;
    ctx.font = "600 62px 'Exo 2', sans-serif";
    ctx.fillText(profile.name, 270, 278);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "500 24px 'Exo 2', sans-serif";
    const bioLines = wrapText(ctx, profile.bio, 700, 2);
    bioLines.forEach((line, index) => ctx.fillText(line, 272, 326 + index * 34));

    rounded(ctx, 72, 430, 936, 148, 10);
    ctx.fillStyle = "rgba(245,243,240,.055)";
    ctx.fill();
    ctx.strokeStyle = "rgba(245,243,240,.14)";
    ctx.lineWidth = 1;
    ctx.stroke();
    const statWidth = 234;
    drawStat(ctx, stats.shelf, "НА ПОЛКЕ", 72, 494, statWidth);
    drawStat(ctx, stats.history, "НАЧАТО", 306, 494, statWidth);
    drawStat(ctx, stats.chapters, "ГЛАВ", 540, 494, statWidth);
    drawStat(ctx, stats.ratings, "ОЦЕНОК", 774, 494, statWidth);

    ctx.fillStyle = COLORS.red;
    ctx.font = "600 15px 'Exo 2', sans-serif";
    ctx.fillText("ТВОИ ЖАНРЫ", 76, 642);
    let chipX = 72;
    const chipY = 662;
    stats.topGenres.forEach((genre) => {
      const chipWidth = drawChip(ctx, genre, chipX, chipY);
      chipX += chipWidth + 10;
    });

    ctx.fillStyle = COLORS.red;
    ctx.font = "600 15px 'Exo 2', sans-serif";
    ctx.fillText("РЯДОМ", 76, 760);
    ctx.fillStyle = COLORS.faint;
    ctx.font = "500 14px 'Exo 2', sans-serif";
    ctx.fillText("истории, которые остаются", 148, 760);

    const coverWidth = 274;
    const coverHeight = 260;
    const coverY = 798;
    const gap = 57;
    stats.topTitles.forEach((item, index) => {
      const x = 72 + index * (coverWidth + gap);
      drawCover(ctx, item, x, coverY, coverWidth, coverHeight);
      ctx.fillStyle = COLORS.paper;
      ctx.font = "500 20px 'Exo 2', sans-serif";
      const titleLines = wrapText(ctx, item.title, coverWidth, 2);
      titleLines.forEach((line, lineIndex) => ctx.fillText(line, x, 1092 + lineIndex * 26));
      ctx.fillStyle = COLORS.faint;
      ctx.font = "500 14px 'Exo 2', sans-serif";
      ctx.fillText(
        `${TYPE_LABELS[item.type] || item.type} · ${totalChapters(item)} глав`,
        x,
        1152
      );
    });

    ctx.strokeStyle = "rgba(245,243,240,.14)";
    ctx.beginPath();
    ctx.moveTo(72, 1200);
    ctx.lineTo(1008, 1200);
    ctx.stroke();

    ctx.fillStyle = COLORS.paper;
    ctx.font = "500 24px 'Exo 2', sans-serif";
    ctx.fillText("Читай между строк.", 72, 1252);
    ctx.fillStyle = COLORS.red;
    ctx.font = "600 18px 'Exo 2', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("KUROHA.ORG", 1008, 1250);
    ctx.fillStyle = COLORS.faint;
    ctx.font = "500 14px 'Exo 2', sans-serif";
    ctx.fillText("ночная библиотека историй", 1008, 1276);
    ctx.textAlign = "left";

    if (nameOutput) nameOutput.textContent = profile.name;
  }

  async function openDialog() {
    if (!dialog.open) dialog.showModal();
    if (drawing) return;
    drawing = true;
    try {
      await drawCard();
    } finally {
      drawing = false;
    }
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  function download() {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "kuroha-reader-card.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      if (window.KurohaToast) window.KurohaToast("Карточка сохранена.");
    }, "image/png");
  }

  function fallbackCopy(text) {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "-9999px";
    field.style.left = "-9999px";
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, field.value.length);
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (error) {}
    field.remove();
    return copied;
  }

  async function copyText() {
    const profile = getProfile();
    const stats = getStats();
    const text = [
      `${profile.name} — профиль в Kuroha`,
      profile.bio,
      `${stats.shelf} историй на полке · ${stats.history} начато · ${stats.chapters} глав · ${stats.ratings} оценок`,
      "kuroha.org"
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      if (window.KurohaToast) window.KurohaToast("Текст профиля скопирован.");
    } catch (error) {
      if (fallbackCopy(text)) {
        if (window.KurohaToast) window.KurohaToast("Текст профиля скопирован.");
      } else if (window.KurohaToast) {
        window.KurohaToast("Не удалось скопировать текст.");
      }
    }
  }

  openButtons.forEach((button) => button.addEventListener("click", openDialog));
  $("[data-profile-card-close]", dialog)?.addEventListener("click", closeDialog);
  $("[data-profile-card-download]", dialog)?.addEventListener("click", download);
  $("[data-profile-card-copy]", dialog)?.addEventListener("click", copyText);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dialog.open) {
      event.preventDefault();
      event.stopPropagation();
      closeDialog();
    }
  });
})();
