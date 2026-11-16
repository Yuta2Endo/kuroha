/* Kuroha prototype — quote postcards from notes. */
(() => {
  "use strict";

  const notesApi = window.KurohaNotes;
  if (!notesApi) return;

  const titles = window.KUROHA_TITLES || [];
  const bySlug = new Map(titles.map((title) => [title.slug, title]));
  const CARD_WIDTH = 1080;
  const CARD_HEIGHT = 1350;
  const LOGO_SRC = "assets/logo-symbol-ink.svg";

  let dialog = null;
  let canvas = null;
  let context = null;
  let stage = null;
  let downloadButton = null;
  let copyButton = null;
  let currentNote = null;
  let currentBook = null;
  let logoImage = null;
  let logoPromise = null;
  let grainPattern = null;

  function toast(message) {
    window.KurohaToast?.(message);
  }

  function escapeHTML(value) {
    const characters = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return String(value).replace(/[&<>"']/g, (character) => characters[character]);
  }

  function hashString(value) {
    let hash = 2166136261;
    const text = String(value);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function loadImage(source) {
    if (!source) return Promise.resolve(null);
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = source;
    });
  }

  function ensureLogo() {
    if (logoImage) return Promise.resolve(logoImage);
    if (!logoPromise) {
      logoPromise = loadImage(LOGO_SRC).then((image) => {
        logoImage = image;
        return image;
      });
    }
    return logoPromise;
  }

  function makeGrainPattern(target) {
    if (grainPattern) return grainPattern;
    const grain = document.createElement("canvas");
    grain.width = 180;
    grain.height = 180;
    const grainContext = grain.getContext("2d");
    if (!grainContext) return null;
    const imageData = grainContext.createImageData(grain.width, grain.height);
    for (let index = 0; index < imageData.data.length; index += 4) {
      const tone = Math.round(90 + Math.random() * 130);
      imageData.data[index] = tone;
      imageData.data[index + 1] = tone;
      imageData.data[index + 2] = tone;
      imageData.data[index + 3] = 255;
    }
    grainContext.putImageData(imageData, 0, 0);
    grainPattern = target.createPattern(grain, "repeat");
    return grainPattern;
  }

  function wrapText(text, maxWidth) {
    const words = String(text).replace(/\s+/g, " ").trim().split(" ");
    const lines = [];
    let line = "";

    const pushLongWord = (word) => {
      let chunk = "";
      for (const character of word) {
        const test = chunk + character;
        if (context.measureText(test).width > maxWidth && chunk) {
          lines.push(chunk);
          chunk = character;
        } else {
          chunk = test;
        }
      }
      return chunk;
    };

    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (context.measureText(test).width <= maxWidth) {
        line = test;
        return;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      if (context.measureText(word).width > maxWidth) {
        line = pushLongWord(word);
      } else {
        line = word;
      }
    });

    if (line) lines.push(line);
    return lines;
  }

  function fitQuote(quote) {
    let fontSize = 56;
    let lines = [];
    let lineHeight = 0;

    while (fontSize >= 29) {
      context.font = `500 ${fontSize}px "Exo 2", system-ui, sans-serif`;
      lines = wrapText(quote, 756);
      lineHeight = Math.round(fontSize * 1.3);
      if (lines.length <= 8) break;
      fontSize -= 2;
    }

    if (lines.length > 9) {
      lines = lines.slice(0, 9);
      lines[8] = `${lines[8].replace(/\s+\S*$/u, "").trim()}…`;
    }

    return { lines, fontSize, lineHeight };
  }

  function drawTorii(x, y, size, color) {
    context.save();
    context.translate(x, y);
    context.scale(size / 100, size / 100);
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(8, 27);
    context.quadraticCurveTo(50, 17, 92, 27);
    context.lineTo(89, 35);
    context.quadraticCurveTo(50, 26, 11, 35);
    context.closePath();
    context.fill();
    context.fillRect(20, 39, 60, 4.5);
    context.fillRect(30, 43.5, 7, 45);
    context.fillRect(63, 43.5, 7, 45);
    context.fillRect(26, 56, 48, 4.5);
    context.fillRect(46.5, 43.5, 7, 9);
    context.fillStyle = "#e63946";
    context.beginPath();
    context.arc(74, 78, 4.6, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawPaperTexture(seed) {
    const random = seededRandom(seed);
    context.save();
    context.beginPath();
    context.rect(84, 108, 912, 1134);
    context.clip();

    if (!grainPattern) makeGrainPattern(context);
    if (grainPattern) {
      context.globalAlpha = 0.045;
      context.fillStyle = grainPattern;
      context.fillRect(84, 108, 912, 1134);
      context.globalAlpha = 1;
    }

    for (let index = 0; index < 46; index += 1) {
      const x = 100 + random() * 880;
      const y = 128 + random() * 1094;
      const length = 10 + random() * 38;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + length, y + (random() - 0.5) * 3);
      context.strokeStyle = `rgba(27, 23, 18, ${0.025 + random() * 0.03})`;
      context.lineWidth = 0.7;
      context.stroke();
    }

    context.restore();
  }

  function drawStars(seed) {
    const random = seededRandom(seed ^ 0x9e3779b9);
    context.save();
    for (let index = 0; index < 34; index += 1) {
      const x = 24 + random() * (CARD_WIDTH - 48);
      const y = 24 + random() * (CARD_HEIGHT - 48);
      if (x > 70 && x < 1010 && y > 90 && y < 1260) continue;
      const radius = 0.7 + random() * 1.5;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(245, 243, 240, ${0.07 + random() * 0.14})`;
      context.fill();
    }
    context.restore();
  }

  function drawCard(note, book) {
    if (!context) return;
    const width = CARD_WIDTH;
    const height = CARD_HEIGHT;
    const seed = hashString(note.id);
    const accent = book.c1 || "#2c1b3d";
    const dateLabel = new Date(note.createdAt || Date.now()).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long"
    });

    context.clearRect(0, 0, width, height);
    context.textBaseline = "alphabetic";
    context.textAlign = "left";

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#0d1120");
    background.addColorStop(0.45, "#17171b");
    background.addColorStop(1, "#0b0b0e");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const glow = context.createRadialGradient(230, 140, 0, 230, 140, 760);
    glow.addColorStop(0, accent);
    glow.addColorStop(0.48, "rgba(44, 27, 61, 0.32)");
    glow.addColorStop(1, "rgba(7, 11, 20, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    const lowerGlow = context.createRadialGradient(880, 1180, 0, 880, 1180, 600);
    lowerGlow.addColorStop(0, "rgba(230, 57, 70, 0.12)");
    lowerGlow.addColorStop(1, "rgba(7, 11, 20, 0)");
    context.fillStyle = lowerGlow;
    context.fillRect(0, 0, width, height);

    drawStars(seed);

    context.strokeStyle = "rgba(230, 57, 70, 0.46)";
    context.lineWidth = 2;
    context.strokeRect(44, 44, width - 88, height - 88);
    context.strokeStyle = "rgba(230, 57, 70, 0.17)";
    context.lineWidth = 1;
    context.strokeRect(58, 58, width - 116, height - 116);

    context.save();
    context.translate(width / 2, height / 2);
    context.rotate(-0.006);
    context.translate(-width / 2, -height / 2);

    context.save();
    context.shadowColor = "rgba(0, 0, 0, 0.5)";
    context.shadowBlur = 48;
    context.shadowOffsetY = 22;
    context.fillStyle = "#f5f3f0";
    context.fillRect(84, 108, 912, 1134);
    context.restore();

    context.fillStyle = "#f5f3f0";
    context.fillRect(84, 108, 912, 1134);
    drawPaperTexture(seed);

    context.strokeStyle = "rgba(27, 23, 18, 0.2)";
    context.lineWidth = 1;
    context.strokeRect(108, 132, 864, 1086);

    if (logoImage) {
      context.drawImage(logoImage, 140, 166, 52, 52);
    } else {
      drawTorii(140, 166, 52, "#17171b");
    }

    context.fillStyle = "#17171b";
    context.font = '500 31px "Exo 2", system-ui, sans-serif';
    context.fillText("KUROHA", 210, 198);

    try {
      context.letterSpacing = "3px";
    } catch (error) {}
    context.textAlign = "right";
    context.fillStyle = "#b52d38";
    context.font = '600 11px "Exo 2", system-ui, sans-serif';
    context.fillText("МАНГА · СООБЩЕСТВО · И ЕЩЁ", 936, 198);
    try {
      context.letterSpacing = "0px";
    } catch (error) {}

    context.strokeStyle = "rgba(27, 23, 18, 0.16)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(140, 250);
    context.lineTo(940, 250);
    context.stroke();

    context.textAlign = "left";
    context.fillStyle = "#e63946";
    context.font = '600 178px Georgia, "Times New Roman", serif';
    context.fillText("“", 122, 424);

    const fitted = fitQuote(note.quote);
    const quoteTop = 440;
    context.fillStyle = "#17171b";
    context.font = `500 ${fitted.fontSize}px "Exo 2", system-ui, sans-serif`;
    fitted.lines.forEach((line, index) => {
      context.fillText(line, 154, quoteTop + index * fitted.lineHeight);
    });

    const quoteBottom = quoteTop + Math.max(0, fitted.lines.length - 1) * fitted.lineHeight + 16;
    context.strokeStyle = "rgba(181, 45, 56, 0.45)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(128, 390);
    context.lineTo(128, quoteBottom);
    context.stroke();

    context.textAlign = "center";
    context.fillStyle = "#b52d38";
    context.font = '30px "Exo 2", system-ui, sans-serif';
    context.fillText("✦", 540, Math.min(quoteBottom + 50, 1018));

    context.strokeStyle = "rgba(27, 23, 18, 0.16)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(140, 1064);
    context.lineTo(940, 1064);
    context.stroke();

    context.textAlign = "left";
    context.fillStyle = "#17171b";
    context.font = '600 26px "Exo 2", system-ui, sans-serif';
    context.fillText(book.title, 150, 1118);
    context.fillStyle = "#b52d38";
    context.font = '500 15px "Exo 2", system-ui, sans-serif';
    context.fillText(`Глава ${note.chapter}`, 150, 1152);

    context.textAlign = "right";
    context.fillStyle = "#17171b";
    context.font = '600 16px "Exo 2", system-ui, sans-serif';
    context.fillText("kuroha.org", 930, 1118);
    context.fillStyle = "#6f6d72";
    context.font = '400 13px "Exo 2", system-ui, sans-serif';
    context.fillText("читай между строк", 930, 1146);
    context.fillStyle = "#8b8478";
    context.font = '400 11px "Exo 2", system-ui, sans-serif';
    context.fillText(dateLabel, 930, 1170);

    context.restore();

    context.textAlign = "center";
    context.fillStyle = "rgba(245, 243, 240, 0.54)";
    context.font = '500 11px "Exo 2", system-ui, sans-serif';
    context.fillText("ИЗ ЗАМЕТОК KUROHA", 540, 1290);
  }

  function setBusy(busy) {
    if (!stage) return;
    stage.classList.toggle("is-busy", Boolean(busy));
    if (downloadButton) downloadButton.disabled = Boolean(busy);
    if (copyButton) copyButton.disabled = Boolean(busy);
  }

  function closeDialog() {
    if (dialog && dialog.open) dialog.close();
  }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "postcard-dialog";
    dialog.id = "postcard-dialog";
    dialog.setAttribute("aria-labelledby", "postcard-title");
    dialog.innerHTML = `
      <div class="postcard-dialog__panel">
        <button class="postcard-dialog__close" type="button" data-postcard-close aria-label="Закрыть открытку">×</button>
        <div class="postcard-stage" id="postcard-stage">
          <canvas id="postcard-canvas" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" aria-label="Предпросмотр открытки с цитатой"></canvas>
        </div>
        <div class="postcard-dialog__copy">
          <p class="eyebrow">Открытка</p>
          <h2 id="postcard-title">Строка, которую хочется сохранить.</h2>
          <p class="postcard-subtitle" id="postcard-subtitle">Цитата из заметок Kuroha</p>
          <p class="postcard-note">1080 × 1350 · PNG. Открытка собирается в браузере и не загружается на сервер.</p>
          <div class="postcard-actions">
            <button class="btn btn--primary" type="button" data-postcard-download>Скачать PNG</button>
            <button class="btn btn--secondary" type="button" data-postcard-copy>Скопировать цитату</button>
            <button class="btn btn--ghost" type="button" data-postcard-close>Закрыть</button>
          </div>
          <p class="postcard-hint">Хорошо смотрится в историях и сохранённых карточках.<br>Текст цитаты остаётся в твоём браузере.</p>
        </div>
      </div>`;
    document.body.appendChild(dialog);
    canvas = dialog.querySelector("#postcard-canvas");
    context = canvas ? canvas.getContext("2d") : null;
    stage = dialog.querySelector("#postcard-stage");
    downloadButton = dialog.querySelector("[data-postcard-download]");
    copyButton = dialog.querySelector("[data-postcard-copy]");

    dialog.querySelectorAll("[data-postcard-close]").forEach((button) => {
      button.addEventListener("click", closeDialog);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
    });
    downloadButton?.addEventListener("click", downloadCard);
    copyButton?.addEventListener("click", copyQuote);
    return dialog;
  }

  async function openPostcard(noteId) {
    const notes = notesApi.read();
    const note = notes.find((entry) => entry.id === noteId) || notes[0];
    if (!note) {
      toast("Сначала сохрани цитату — открытка появится здесь.");
      return;
    }
    const book = bySlug.get(note.slug);
    if (!book) {
      toast("Не удалось найти тайтл для этой заметки.");
      return;
    }

    const element = ensureDialog();
    currentNote = note;
    currentBook = book;
    const subtitle = element.querySelector("#postcard-subtitle");
    if (subtitle) subtitle.textContent = `${book.title} · глава ${note.chapter}`;
    if (!element.open) element.showModal();
    setBusy(true);

    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      if (document.fonts && document.fonts.load) {
        await document.fonts.load('500 48px "Exo 2"');
        await document.fonts.load('600 34px "Exo 2"');
      }
      await ensureLogo();
      drawCard(note, book);
    } catch (error) {
      toast("Не получилось собрать открытку. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  function downloadCard() {
    if (!canvas || !currentNote || !currentBook) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        toast("Не удалось сохранить открытку.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kuroha-${currentNote.slug}-glava-${currentNote.chapter}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast("Открытка сохранена.");
    }, "image/png");
  }

  function fallbackCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
      toast("Цитата скопирована.");
    } catch (error) {
      toast("Браузер не разрешил скопировать текст.");
    }
    area.remove();
  }

  async function copyQuote() {
    if (!currentNote || !currentBook) return;
    const text = `«${currentNote.quote}» — ${currentBook.title}, глава ${currentNote.chapter}. Kuroha.`;
    try {
      await navigator.clipboard.writeText(text);
      toast("Цитата скопирована.");
    } catch (error) {
      fallbackCopy(text);
    }
  }

  document.addEventListener("click", (event) => {
    const cardButton = event.target.closest("[data-postcard]");
    if (cardButton) {
      event.preventDefault();
      openPostcard(cardButton.dataset.postcard);
      return;
    }
    const latestButton = event.target.closest("[data-postcard-latest]");
    if (latestButton) {
      event.preventDefault();
      const notes = notesApi.read();
      if (!notes.length) {
        toast("Сначала сохрани цитату — открытка появится здесь.");
        return;
      }
      openPostcard(notes[0].id);
    }
  });

  window.KurohaPostcards = {
    open: openPostcard,
    close: closeDialog,
    draw: drawCard
  };
})();
