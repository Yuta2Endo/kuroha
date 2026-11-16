/* Kuroha prototype — «Ночная читальня»: procedural ambience for the reader. */
(() => {
  "use strict";

  const toggle = document.querySelector("[data-ambience-toggle]");
  if (!toggle) return;

  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  const STORAGE = {
    mode: "kuroha-reader-sound",
    volume: "kuroha-reader-volume"
  };
  const DEFAULT_VOLUME = 42;
  const MODES = [
    { id: "rain", label: "Дождь", note: "по стеклу", gain: 0.9 },
    { id: "fire", label: "Камин", note: "тёплый треск", gain: 0.95 },
    { id: "wind", label: "Ветер", note: "за окном", gain: 1.25 },
    { id: "off", label: "Тишина", note: "только страницы", gain: 0 }
  ];
  const ICONS = {
    rain:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 15a4 4 0 0 1 .4-7.98A5.5 5.5 0 0 1 18 9.5a3.5 3.5 0 0 1-.5 7H7Z"/><path d="M8 19v2M12 18v3M16 19v2"/></svg>',
    fire:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1.8 3.2-1.5 4.4-1.5 6.5 0 1.2.8 2.1 1.8 2.1 1.6 0 2.1-1.6 1.7-3.1C16.4 10.1 18 12.2 18 15a6 6 0 0 1-12 0c0-3.4 2.7-6.6 6-12Z"/></svg>',
    wind:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h9a3 3 0 1 0-3-3"/><path d="M4 12h13a3 3 0 1 1-3 3"/><path d="M4 16h6"/></svg>',
    off:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m17 9 4 6M21 9l-4 6"/></svg>'
  };
  const MODE_GAIN = {
    rain: 0.9,
    fire: 0.95,
    wind: 1.25
  };

  const state = {
    ctx: null,
    master: null,
    source: null,
    modeGain: null,
    nodes: [],
    buffers: {},
    mode: "off",
    volume: DEFAULT_VOLUME,
    playing: false,
    suspendTimer: 0
  };

  const byMode = new Map(MODES.map((mode) => [mode.id, mode]));

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch (error) {}
  }

  const savedMode = readStorage(STORAGE.mode, "off");
  state.mode = byMode.has(savedMode) ? savedMode : "off";

  const rawVolume = Number(readStorage(STORAGE.volume, DEFAULT_VOLUME));
  state.volume = Number.isFinite(rawVolume)
    ? clamp(Math.round(rawVolume), 0, 100)
    : DEFAULT_VOLUME;

  const panel = document.createElement("aside");
  panel.className = "ambience-panel";
  panel.id = "ambience-panel";
  panel.hidden = true;
  panel.tabIndex = -1;
  panel.setAttribute("aria-label", "Ночная читальня");
  panel.innerHTML = `
    <div class="ambience-panel__head">
      <div>
        <p class="ambience-panel__label">Ночная читальня</p>
        <h2>Тихий фон</h2>
      </div>
      <button class="ambience-close" type="button" data-ambience-close aria-label="Закрыть ночную читальню">×</button>
    </div>
    <p class="ambience-panel__lead">Звук живёт в этой вкладке. Ничего не загружается — только комната и ты.</p>
    <div class="ambience-modes" role="radiogroup" aria-label="Звук для чтения">
      ${MODES.map(
        (mode) => `
        <button class="ambience-mode" type="button" role="radio" aria-checked="false" data-ambience-mode="${mode.id}" tabindex="-1">
          <span class="ambience-mode__icon">${ICONS[mode.id]}</span>
          <span class="ambience-mode__body"><b>${mode.label}</b><small>${mode.note}</small></span>
          <span class="ambience-mode__eq" aria-hidden="true"><i></i><i></i><i></i></span>
        </button>`
      ).join("")}
    </div>
    <label class="ambience-volume">
      <span class="ambience-volume__head"><span>Громкость</span><b id="ambience-volume-value">${state.volume}%</b></span>
      <input id="ambience-volume" type="range" min="0" max="100" step="1" value="${state.volume}" aria-label="Громкость ночной читальни">
    </label>
    <p class="ambience-status" id="ambience-status" aria-live="polite">
      <span class="ambience-dot" aria-hidden="true"></span>
      <span id="ambience-status-text">Тишина</span>
    </p>`;
  (document.querySelector(".reader-shell") || document.body).appendChild(panel);

  const $ = (selector, root = panel) => root.querySelector(selector);
  const $$ = (selector, root = panel) => Array.from(root.querySelectorAll(selector));
  const modeButtons = $$("[data-ambience-mode]");
  const status = $("#ambience-status");
  const statusText = $("#ambience-status-text");
  const volumeInput = $("#ambience-volume");
  const volumeValue = $("#ambience-volume-value");
  const closeButton = $("[data-ambience-close]");

  function volumeGain() {
    return (state.volume / 100) * 0.6;
  }

  function ensureContext() {
    if (state.ctx) return state.ctx;
    if (!AudioCtor) return null;
    try {
      const ctx = new AudioCtor();
      const master = ctx.createGain();
      master.gain.value = volumeGain();
      master.connect(ctx.destination);
      state.ctx = ctx;
      state.master = master;
      return ctx;
    } catch (error) {
      return null;
    }
  }

  function createNoise(mode) {
    const ctx = state.ctx;
    const rate = ctx.sampleRate;
    const seconds = mode === "fire" ? 9 : 8;
    const fade = 0.4;
    const length = Math.floor(seconds * rate);
    const fadeLength = Math.floor(fade * rate);
    const raw = new Float32Array(length + fadeLength);
    let brown = 0;
    let crackle = 0;

    for (let index = 0; index < raw.length; index += 1) {
      const white = Math.random() * 2 - 1;

      if (mode === "rain") {
        const breathe = 0.85 + 0.15 * Math.sin((2 * Math.PI * 0.09 * index) / rate);
        raw[index] = white * breathe;
      } else if (mode === "wind") {
        brown = (brown + 0.012 * white) / 1.012;
        const breathe =
          0.62 + 0.38 * Math.sin((2 * Math.PI * 0.065 * index) / rate + 0.9);
        raw[index] = brown * 4.2 * breathe;
      } else {
        brown = (brown + 0.02 * white) / 1.02;
        if (Math.random() < 0.00055) {
          crackle += (Math.random() * 2 - 1) * (0.35 + Math.random() * 0.55);
        }
        raw[index] = brown * 4.4 + crackle;
        crackle *= 0.986;
      }
    }

    const data = new Float32Array(length);
    for (let index = 0; index < fadeLength; index += 1) {
      const mix = index / fadeLength;
      data[index] = raw[index] * mix + raw[length + index] * (1 - mix);
    }
    for (let index = fadeLength; index < length; index += 1) {
      data[index] = raw[index];
    }

    let peak = 0;
    for (let index = 0; index < length; index += 1) {
      peak = Math.max(peak, Math.abs(data[index]));
    }
    if (peak > 0.92) {
      const scale = 0.92 / peak;
      for (let index = 0; index < length; index += 1) {
        data[index] *= scale;
      }
    }

    const buffer = ctx.createBuffer(1, length, rate);
    try {
      buffer.copyToChannel(data, 0);
    } catch (error) {
      buffer.getChannelData(0).set(data);
    }
    return buffer;
  }

  function bufferFor(mode) {
    if (!state.buffers[mode]) {
      state.buffers[mode] = createNoise(mode);
    }
    return state.buffers[mode];
  }

  function buildChain(mode) {
    const ctx = state.ctx;
    const source = ctx.createBufferSource();
    source.buffer = bufferFor(mode);
    source.loop = true;

    const nodes = [source];
    let tail = source;

    if (mode === "rain") {
      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 650;
      highpass.Q.value = 0.5;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 10500;
      source.connect(highpass);
      highpass.connect(lowpass);
      nodes.push(highpass, lowpass);
      tail = lowpass;
    } else if (mode === "fire") {
      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 70;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 2200;
      source.connect(highpass);
      highpass.connect(lowpass);
      nodes.push(highpass, lowpass);
      tail = lowpass;
    } else if (mode === "wind") {
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.value = 650;
      bandpass.Q.value = 0.55;
      source.connect(bandpass);
      nodes.push(bandpass);
      tail = bandpass;
    }

    const gain = ctx.createGain();
    gain.gain.value = 0;
    tail.connect(gain);
    gain.connect(state.master);
    nodes.push(gain);

    return { source, gain, nodes };
  }

  function stopCurrent(fade = 0.28) {
    if (!state.source) return;

    const ctx = state.ctx;
    const source = state.source;
    const gain = state.modeGain;
    const nodes = state.nodes;

    state.source = null;
    state.modeGain = null;
    state.nodes = [];

    if (ctx && gain) {
      const now = ctx.currentTime;
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + fade);
      } catch (error) {}
    }

    window.setTimeout(() => {
      try {
        source.stop();
      } catch (error) {}
      nodes.forEach((node) => {
        try {
          node.disconnect();
        } catch (error) {}
      });
    }, fade * 1000 + 80);
  }

  function stopSound() {
    stopCurrent(0.3);
    state.playing = false;
    state.mode = "off";
    writeStorage(STORAGE.mode, "off");
    updateUI();

    if (state.ctx) {
      window.clearTimeout(state.suspendTimer);
      state.suspendTimer = window.setTimeout(() => {
        if (!state.playing && state.ctx && state.ctx.state === "running") {
          state.ctx.suspend().catch(() => {});
        }
      }, 700);
    }
  }

  async function startMode(mode) {
    if (!byMode.has(mode) || mode === "off") {
      stopSound();
      return;
    }

    const ctx = ensureContext();
    if (!ctx) {
      window.KurohaToast?.("Звук не поддерживается этим браузером.");
      return;
    }

    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch (error) {}
    }

    if (ctx.state !== "running") {
      window.KurohaToast?.("Звук не включился. Нажми на режим ещё раз.");
      updateUI();
      return;
    }

    window.clearTimeout(state.suspendTimer);
    stopCurrent(0.28);

    const chain = buildChain(mode);
    state.source = chain.source;
    state.modeGain = chain.gain;
    state.nodes = chain.nodes;

    const now = ctx.currentTime;
    chain.gain.gain.setValueAtTime(0, now);
    chain.gain.gain.linearRampToValueAtTime(MODE_GAIN[mode] || 1, now + 0.5);
    try {
      chain.source.start(0);
    } catch (error) {
      window.KurohaToast?.("Не удалось запустить звук. Попробуй ещё раз.");
      stopCurrent(0);
      return;
    }

    state.playing = true;
    state.mode = mode;
    writeStorage(STORAGE.mode, mode);
    updateUI();
  }

  function setVolume(value) {
    state.volume = clamp(Math.round(value), 0, 100);
    writeStorage(STORAGE.volume, state.volume);

    if (state.ctx && state.master) {
      const now = state.ctx.currentTime;
      state.master.gain.cancelScheduledValues(now);
      state.master.gain.setValueAtTime(state.master.gain.value, now);
      state.master.gain.linearRampToValueAtTime(volumeGain(), now + 0.15);
    }

    updateVolumeUI();
  }

  function updateVolumeUI() {
    if (volumeInput) {
      volumeInput.value = String(state.volume);
      volumeInput.style.setProperty("--ambience-level", `${state.volume}%`);
    }
    if (volumeValue) volumeValue.textContent = `${state.volume}%`;
  }

  function updateUI() {
    const active = byMode.get(state.mode) || byMode.get("off");

    modeButtons.forEach((button) => {
      const selected = button.dataset.ambienceMode === active.id;
      button.classList.toggle("is-active", selected);
      button.classList.toggle("is-playing", selected && state.playing);
      button.setAttribute("aria-checked", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });

    toggle.setAttribute("aria-pressed", String(state.playing));
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
    toggle.dataset.ambiencePending = String(!state.playing && state.mode !== "off");

    const label = active.label.toLowerCase();
    const title = state.playing
      ? `Ночная читальня: ${label} играет`
      : state.mode !== "off"
        ? `Ночная читальня: ${label} на паузе`
        : "Ночная читальня";
    toggle.title = title;
    toggle.setAttribute("aria-label", title);

    if (status) status.classList.toggle("is-playing", state.playing);
    if (statusText) {
      statusText.textContent = state.playing
        ? `${active.label} · играет`
        : state.mode !== "off"
          ? `${active.label} · на паузе`
          : "Тишина";
    }
  }

  function openPanel() {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    updateUI();
    window.requestAnimationFrame(() => {
      const active = panel.querySelector(".ambience-mode.is-active");
      (active || closeButton || panel).focus();
    });
  }

  function closePanel(focusToggle = true) {
    if (panel.hidden) return;
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (focusToggle) toggle.focus();
  }

  toggle.addEventListener("click", () => {
    if (!panel.hidden) {
      closePanel();
      return;
    }
    openPanel();
    if (!state.playing && state.mode !== "off") {
      startMode(state.mode);
    }
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.ambienceMode;
      if (mode === "off") {
        stopSound();
        return;
      }
      startMode(mode);
    });
  });

  volumeInput?.addEventListener("input", () => {
    setVolume(Number(volumeInput.value));
  });

  closeButton?.addEventListener("click", () => closePanel());

  document.addEventListener("pointerdown", (event) => {
    if (
      !panel.hidden &&
      !panel.contains(event.target) &&
      !toggle.contains(event.target)
    ) {
      closePanel(false);
    }
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && !panel.hidden) {
        event.preventDefault();
        event.stopPropagation();
        closePanel();
      }
    },
    true
  );

  panel.addEventListener("keydown", (event) => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
      return;
    }
    const index = modeButtons.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const next =
      modeButtons[(index + direction + modeButtons.length) % modeButtons.length];
    next.focus();
  });

  window.addEventListener("beforeunload", () => {
    if (state.source) {
      try {
        state.source.stop();
      } catch (error) {}
    }
  });

  window.KurohaAmbience = {
    play: startMode,
    stop: stopSound,
    get mode() {
      return state.mode;
    },
    get playing() {
      return state.playing;
    },
    get context() {
      return state.ctx;
    }
  };

  updateVolumeUI();
  updateUI();
})();
