/* Kuroha 3.0 — audio chapter via Web Speech API */
(function () {
  "use strict";

  if (document.body.dataset.page !== "reader") return;

  const article = document.querySelector("#reader-text");
  const actions = document.querySelector(".reader-bar__actions");
  if (!article || !actions) return;

  const synth = window.speechSynthesis;
  const Utterance = window.SpeechSynthesisUtterance;
  const supported = Boolean(synth && Utterance);
  const RATE_KEY = "kuroha-listen-rate";
  const VOICE_KEY = "kuroha-listen-voice";
  const CONTINUE_KEY = "kuroha-listen-continue";

  const blocks = Array.from(article.querySelectorAll("p, blockquote"))
    .filter((block) => (block.textContent || "").trim().length > 0);

  function splitSentences(text) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (!normalized) return [];
    const parts = normalized.match(/[^.!?…]+[.!?…]+[»"]?|[^.!?…]+$/g) || [normalized];
    return parts.map((part) => part.trim()).filter(Boolean);
  }

  const sentences = [];
  blocks.forEach((block) => {
    splitSentences(block.textContent || "").forEach((text) => {
      sentences.push({ text: text, block: block });
    });
  });

  if (!sentences.length) return;

  const storedRate = Number.parseFloat(localStorage.getItem(RATE_KEY) || "1");
  const storedContinue = localStorage.getItem(CONTINUE_KEY);
  let rate = Number.isFinite(storedRate) ? Math.max(0.75, Math.min(1.6, storedRate)) : 1;
  let autoContinue = storedContinue !== "0";
  let index = 0;
  let playing = false;
  let paused = false;
  let runId = 0;
  let activeBlock = null;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "reader-icon reader-listen-btn";
  button.id = "reader-listen";
  button.setAttribute("aria-label", "Слушать главу");
  button.title = "Слушать главу";
  button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h3l4 3V6L7 9H4Z"></path><path d="M15 9a4 4 0 0 1 0 6"></path><path d="M17.5 6.5a7.5 7.5 0 0 1 0 11"></path></svg>';
  const notesButton = actions.querySelector("#reader-notes");
  actions.insertBefore(button, notesButton || null);

  const panel = document.createElement("aside");
  panel.className = "listen-panel";
  panel.id = "listen-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Аудио-глава");
  panel.innerHTML = [
    '<div class="listen-panel__head">',
    '<div><p class="eyebrow">Слушать</p><b id="listen-title">Глава</b></div>',
    '<button class="listen-close" type="button" data-listen-close aria-label="Закрыть плеер">×</button>',
    '</div>',
    '<p class="listen-status" id="listen-status" aria-live="polite">Готово к чтению.</p>',
    '<div class="listen-progress" aria-hidden="true"><span id="listen-bar"></span></div>',
    '<div class="listen-controls">',
    '<button class="listen-control" type="button" data-listen-prev aria-label="Предыдущая фраза">←</button>',
    '<button class="listen-control listen-play" type="button" data-listen-play aria-label="Слушать">▶</button>',
    '<button class="listen-control" type="button" data-listen-next aria-label="Следующая фраза">→</button>',
    '</div>',
    '<label class="listen-field"><span>Голос</span><select id="listen-voice" aria-label="Голос"></select></label>',
    '<label class="listen-field"><span>Скорость</span><input id="listen-rate" type="range" min="0.75" max="1.6" step="0.05" value="' + rate + '" aria-label="Скорость речи"><output id="listen-rate-output">' + rate.toFixed(2) + '×</output></label>',
    '<label class="listen-continue"><input id="listen-continue" type="checkbox" checked> Следующая глава после окончания</label>'
  ].join("");
  document.body.appendChild(panel);

  const title = panel.querySelector("#listen-title");
  const status = panel.querySelector("#listen-status");
  const bar = panel.querySelector("#listen-bar");
  const playButton = panel.querySelector("[data-listen-play]");
  const prevButton = panel.querySelector("[data-listen-prev]");
  const nextButton = panel.querySelector("[data-listen-next]");
  const voiceSelect = panel.querySelector("#listen-voice");
  const rateInput = panel.querySelector("#listen-rate");
  const rateOutput = panel.querySelector("#listen-rate-output");
  const continueInput = panel.querySelector("#listen-continue");

  const barTitle = document.querySelector("#reader-bar-title");
  const barChapter = document.querySelector("#reader-bar-chapter");
  if (title) title.textContent = [barTitle?.textContent, barChapter?.textContent].filter(Boolean).join(" · ") || "Аудио-глава";

  continueInput.checked = autoContinue;

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function setHighlight(block) {
    if (activeBlock) activeBlock.classList.remove("is-speaking");
    activeBlock = block || null;
    if (activeBlock) {
      activeBlock.classList.add("is-speaking");
      if (typeof activeBlock.scrollIntoView === "function") {
        activeBlock.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  function updateUI() {
    button.classList.toggle("is-playing", playing && !paused);
    playButton.textContent = playing && !paused ? "Ⅱ" : "▶";
    playButton.setAttribute("aria-label", playing && !paused ? "Пауза" : "Слушать");
    prevButton.disabled = index <= 0;
    nextButton.disabled = index >= sentences.length - 1;
    if (bar) bar.style.width = Math.round(((index + (playing ? 1 : 0)) / sentences.length) * 100) + "%";
  }

  function populateVoices() {
    if (!voiceSelect) return;
    const voices = synth.getVoices ? synth.getVoices() : [];
    const russian = voices.filter((voice) => /^ru(-|$)/i.test(voice.lang || ""));
    const list = russian.length ? russian : voices;
    const current = localStorage.getItem(VOICE_KEY) || "";
    if (!list.length) {
      voiceSelect.innerHTML = '<option value="">Голос браузера</option>';
      return;
    }
    voiceSelect.innerHTML = list.map((voice) => {
      const selected = voice.name === current ? " selected" : "";
      return '<option value="' + encodeURIComponent(voice.name) + '"' + selected + ">" + voice.name + " · " + voice.lang + "</option>";
    }).join("");
  }

  function selectedVoice() {
    if (!voiceSelect || !voiceSelect.value) return null;
    const name = decodeURIComponent(voiceSelect.value);
    return (synth.getVoices ? synth.getVoices() : []).find((voice) => voice.name === name) || null;
  }

  function speak() {
    if (!supported) return;
    const sentence = sentences[index];
    if (!sentence) {
      finish();
      return;
    }
    const id = ++runId;
    synth.cancel();
    setHighlight(sentence.block);
    setStatus("Фраза " + (index + 1) + " из " + sentences.length + ".");
    updateUI();

    const utterance = new Utterance(sentence.text);
    utterance.lang = "ru-RU";
    utterance.rate = rate;
    utterance.pitch = 1;
    const voice = selectedVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (id !== runId) return;
      if (!playing) return;
      index += 1;
      if (index >= sentences.length) {
        finish();
      } else {
        speak();
      }
    };
    utterance.onerror = (event) => {
      if (id !== runId) return;
      if (event.error === "interrupted" || event.error === "canceled") return;
      playing = false;
      paused = false;
      if (event.error === "not-allowed") {
        setStatus("Нажми «Слушать», чтобы разрешить озвучку.");
      } else {
        setStatus("Не удалось продолжить озвучку. Попробуй другой голос.");
      }
      updateUI();
    };
    synth.speak(utterance);
  }

  function start() {
    if (!supported) {
      setStatus("Этот браузер не поддерживает озвучку. Попробуй Chrome или Edge.");
      return;
    }
    if (playing && paused) {
      synth.resume();
      playing = true;
      paused = false;
      setStatus("Читаем дальше.");
      updateUI();
      return;
    }
    if (playing) return;
    if (index >= sentences.length) index = 0;
    playing = true;
    paused = false;
    speak();
  }

  function pause() {
    if (!playing) return;
    synth.pause();
    playing = false;
    paused = true;
    setStatus("Пауза.");
    updateUI();
  }

  function toggle() {
    if (playing && !paused) pause();
    else start();
  }

  function stop() {
    runId += 1;
    if (synth) synth.cancel();
    playing = false;
    paused = false;
    setHighlight(null);
    setStatus("Остановлено.");
    updateUI();
  }

  function move(delta) {
    const nextIndex = Math.max(0, Math.min(sentences.length - 1, index + delta));
    if (nextIndex === index) return;
    index = nextIndex;
    if (playing) {
      speak();
    } else {
      setHighlight(sentences[index].block);
      setStatus("Фраза " + (index + 1) + " из " + sentences.length + ".");
      updateUI();
    }
  }

  function finish() {
    runId += 1;
    playing = false;
    paused = false;
    setHighlight(null);
    setStatus("Глава прочитана.");
    updateUI();
    const next = document.querySelector("#reader-next");
    const href = next && !next.hidden ? next.getAttribute("href") : "";
    if (autoContinue && href && href.indexOf("reader.html") === 0) {
      setStatus("Глава прочитана. Открываем следующую…");
      window.setTimeout(() => {
        window.location.href = href + (href.indexOf("?") !== -1 ? "&" : "?") + "listen=1";
      }, 1100);
    }
  }

  function open() {
    panel.hidden = false;
    populateVoices();
    if (!supported) setStatus("Этот браузер не поддерживает озвучку. Попробуй Chrome или Edge.");
    else if (!playing) setStatus("Готово к чтению. Нажми «Слушать».");
    updateUI();
  }

  function close() {
    stop();
    panel.hidden = true;
  }

  button.addEventListener("click", () => {
    panel.hidden = false;
    populateVoices();
    if (!supported) {
      setStatus("Этот браузер не поддерживает озвучку. Попробуй Chrome или Edge.");
      return;
    }
    toggle();
  });

  playButton.addEventListener("click", toggle);
  prevButton.addEventListener("click", () => move(-1));
  nextButton.addEventListener("click", () => move(1));
  panel.querySelector("[data-listen-close]").addEventListener("click", close);

  rateInput.addEventListener("input", () => {
    rate = Math.max(0.75, Math.min(1.6, Number.parseFloat(rateInput.value) || 1));
    rateOutput.textContent = rate.toFixed(2) + "×";
    localStorage.setItem(RATE_KEY, String(rate));
    if (playing) {
      speak();
    }
  });

  voiceSelect.addEventListener("change", () => {
    localStorage.setItem(VOICE_KEY, voiceSelect.value);
    if (playing) speak();
  });

  continueInput.addEventListener("change", () => {
    autoContinue = continueInput.checked;
    localStorage.setItem(CONTINUE_KEY, autoContinue ? "1" : "0");
  });

  if (supported && typeof synth.addEventListener === "function") {
    synth.addEventListener("voiceschanged", populateVoices);
  }
  window.addEventListener("pagehide", () => {
    if (synth) synth.cancel();
  });

  populateVoices();
  updateUI();

  if (new URLSearchParams(window.location.search).get("listen") === "1") {
    panel.hidden = false;
    setStatus("Готово к чтению. Нажми «Слушать».");
    updateUI();
  }

  window.KurohaListen = {
    open: open,
    close: close,
    play: start,
    pause: pause,
    toggle: toggle,
    stop: stop,
    next: () => move(1),
    prev: () => move(-1),
    state: () => ({ index: index, total: sentences.length, playing: playing, paused: paused, supported: supported })
  };
})();
