(function () {
  const TITLES = window.KUROHA_TITLES || [];

  const DESCRIPTIONS = {
    "pisma-k-severu": "Она пишет письма на север, где уже десять лет не бывает адресата. Однажды на одно из них приходит ответ.",
    "sol-i-zvezdy": "Солеварка на краю мира находит упавшую звезду. Теперь ей предстоит решить, что важнее — свет или дорога домой.",
    "komnata-dozhdya": "В этой комнате всегда идёт дождь. Хозяйка сдаёт её тем, кто хочет переждать не только погоду.",
    "bumazhnyy-gorod": "Город сложен из страниц, и каждую ночь кто-то вырывает из него целую улицу. Картограф пытается удержать хотя бы центр.",
    "tishina-na-vtorom-etazhe": "Соседи сверху не шумят уже полгода. Но каждое утро кто-то оставляет на её пороге чашку остывшего чая.",
    "posledniy-hranitel": "Когда библиотеки закрылись, он остался сторожить последнюю. Книги начали возвращаться сами — и приносить то, что было забыто."
  };

  const GENRE_LABELS = {
    fantasy: "Фэнтези",
    romance: "Романтика",
    drama: "Драма",
    action: "Экшен",
    mystery: "Мистика",
    slice: "Повседневность",
    history: "История",
    scifi: "Фантастика",
    horror: "Ужасы",
    comedy: "Комедия",
    adventure: "Приключения",
    thriller: "Триллер"
  };

  const STATUS_LABELS = {
    ongoing: "выходит",
    completed: "завершён",
    frozen: "заморожен"
  };

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function plural(number, forms) {
    const mod10 = number % 10;
    const mod100 = number % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
    return forms[2];
  }

  function formatRating(value) {
    return Number(value).toFixed(1).replace(".", ",");
  }

  function coverFor(book) {
    const cards = window.KurohaCards;
    return cards && cards.coverHTML ? cards.coverHTML(book) : "";
  }

  function row(book, index) {
    const description = DESCRIPTIONS[book.slug] || "История, которую стоит прочитать без спешки.";
    const genres = book.genres
      .map(
        (genre) =>
          `<a href="genre.html?genre=${encodeURIComponent(genre)}">${escapeHTML(GENRE_LABELS[genre] || genre)}</a>`
      )
      .join("<span aria-hidden=\"true\"> · </span>");
    const status = STATUS_LABELS[book.status] || book.status;
    const isNew = book.isNew ? '<span class="novel-row__new">новое</span>' : "";

    return `<article class="novel-row">
      <span class="novel-row__number">${String(index + 1).padStart(2, "0")}</span>
      <div class="novel-row__cover">${coverFor(book)}</div>
      <div class="novel-row__body">
        <div class="novel-row__head">
          <h2><a href="title.html?slug=${encodeURIComponent(book.slug)}">${escapeHTML(book.title)}</a></h2>
          ${isNew}
        </div>
        <p class="novel-row__byline">${escapeHTML(book.author)} · ${book.year} · ${status}</p>
        <p class="novel-row__desc">${escapeHTML(description)}</p>
        <p class="novel-row__genres">${genres}</p>
      </div>
      <div class="novel-row__side">
        <div class="novel-row__rating">★ ${formatRating(book.rating)}</div>
        <p class="novel-row__meta">${book.chapters} ${plural(book.chapters, ["глава", "главы", "глав"])}</p>
        <div class="novel-row__actions">
          <a class="btn btn--small btn--primary" href="reader.html?slug=${encodeURIComponent(book.slug)}&chapter=1">Читать</a>
          <a class="btn btn--small btn--ghost" href="title.html?slug=${encodeURIComponent(book.slug)}">О тайтле</a>
        </div>
      </div>
    </article>`;
  }

  function render() {
    const novels = TITLES.filter((book) => book.type === "novel").sort(
      (a, b) => b.popularity - a.popularity
    );
    const list = document.querySelector("#novel-list");
    const count = document.querySelector("#novel-count");
    const chapters = document.querySelector("#novel-chapters");

    if (count) count.textContent = String(novels.length);
    if (chapters) {
      const total = novels.reduce((sum, book) => sum + book.chapters, 0);
      chapters.textContent = String(total);
    }
    if (list) list.innerHTML = novels.map(row).join("");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
