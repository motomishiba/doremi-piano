const ALL_KEYS = [
  { id: "do", label: "ド", midi: 60, color: "#b97868" },
  { id: "re", label: "レ", midi: 62, color: "#c88c5a" },
  { id: "mi", label: "ミ", midi: 64, color: "#d1a34f" },
  { id: "fa", label: "ファ", midi: 65, color: "#8da27b" },
  { id: "so", label: "ソ", midi: 67, color: "#769b9b" },
  { id: "la", label: "ラ", midi: 69, color: "#7f8fa5" },
  { id: "ti", label: "シ", midi: 71, color: "#9583a0" },
  { id: "do2", label: "ド", midi: 72, color: "#b2797d" }
];

const BLACK_KEYS = [
  { id: "do-sharp", label: "ド♯", midi: 61, afterWhite: 1 },
  { id: "re-sharp", label: "レ♯", midi: 63, afterWhite: 2 },
  { id: "fa-sharp", label: "ファ♯", midi: 66, afterWhite: 4 },
  { id: "so-sharp", label: "ソ♯", midi: 68, afterWhite: 5 },
  { id: "la-sharp", label: "ラ♯", midi: 70, afterWhite: 6 }
];

const PIANO_SAMPLE_ROOT = "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/";
const PIANO_SAMPLE_NAMES = {
  60: "C4",
  61: "Db4",
  62: "D4",
  63: "Eb4",
  64: "E4",
  65: "F4",
  66: "Gb4",
  67: "G4",
  68: "Ab4",
  69: "A4",
  70: "Bb4",
  71: "B4",
  72: "C5"
};
const pianoSampleBuffers = new Map();
const pianoSampleRequests = new Map();

const toEvents = (notes) => notes.map((note) => [note]);

const makeCanonEvents = (theme, offset = 7) => Array.from(
  { length: theme.length + offset },
  (_, index) => [...new Set([
    theme[index],
    theme[index - offset]
  ].filter(Boolean))]
);

// 「きらきら星」1番。最後の音を2回置き、伸ばす音も自然に聞こえるようにする。
const TWINKLE_MELODY = [
  "ド", "ド", "ソ", "ソ", "ラ", "ラ", "ソ", "ソ",
  "ファ", "ファ", "ミ", "ミ", "レ", "レ", "ド", "ド",
  "ソ", "ソ", "ファ", "ファ", "ミ", "ミ", "レ", "レ",
  "ソ", "ソ", "ファ", "ファ", "ミ", "ミ", "レ", "レ",
  "ド", "ド", "ソ", "ソ", "ラ", "ラ", "ソ", "ソ",
  "ファ", "ファ", "ミ", "ミ", "レ", "レ", "ド", "ド"
];

// 「かえるの合唱」の主旋律。7音目のあとから2声目が入り、輪唱の重なりを作る。
const FROG_MELODY = [
  "ド", "レ", "ミ", "ファ", "ミ", "レ", "ド",
  "ミ", "ファ", "ソ", "ラ", "ソ", "ファ", "ミ",
  "ド", "ド", "レ", "レ", "ミ", "ミ", "ファ", "ファ",
  "ミ", "ミ", "レ", "レ", "ド", "ド"
];

const FROG_CANON = makeCanonEvents(FROG_MELODY);
const FROG_5_CANON = makeCanonEvents(FROG_MELODY.map((note) => note === "ラ" ? "ソ" : note));

const SONGS = {
  twinkle: {
    name: "きらきら星",
    eventsByRange: {
      3: toEvents(["ド", "ド", "ミ", "ミ", "レ", "レ", "ド", "ド", "ミ", "ミ", "レ", "レ", "ド", "ド"]),
      5: toEvents(TWINKLE_MELODY.map((note) => note === "ラ" ? "ソ" : note)),
      8: toEvents(TWINKLE_MELODY)
    }
  },
  mini: {
    name: "ドレミのぼうけん",
    eventsByRange: {
      3: toEvents(["ド", "レ", "ミ", "レ", "ド", "ミ", "レ", "ド"]),
      5: toEvents(["ド", "レ", "ミ", "ファ", "ソ", "ファ", "ミ", "レ", "ド"]),
      8: toEvents(["ド", "レ", "ミ", "ファ", "ソ", "ラ", "ソ", "ミ", "レ", "ド"])
    }
  },
  frog: {
    name: "かえるの合唱",
    eventsByRange: {
      3: toEvents(["ド", "レ", "ミ", "ド", "ド", "レ", "ミ", "ド", "ミ", "ミ", "レ", "レ", "ド", "ド"]),
      5: FROG_5_CANON,
      8: FROG_CANON
    }
  }
};

const state = {
  range: 8,
  mode: "free",
  soundOn: true,
  score: 0,
  combo: 0,
  songId: "twinkle",
  currentIndex: 0,
  pendingNotes: [],
  noteStart: 0,
  noteDuration: 2800,
  reachedBottom: false,
  animationFrame: null,
  gameToken: 0,
  audioContext: null,
  outputGain: null,
  compressor: null,
  audioUnlocked: false,
  samplesStarted: false,
  listening: false,
  listenTimers: []
};

const piano = document.querySelector("#piano");
const fallingLane = document.querySelector("#fallingLane");
const noteCards = document.querySelector("#noteCards");
const message = document.querySelector("#message");
const scorePill = document.querySelector("#scorePill");
const comboPill = document.querySelector("#comboPill");
const rangeLabel = document.querySelector("#rangeLabel");
const selectedSongName = document.querySelector("#selectedSongName");
const soundToggle = document.querySelector("#soundToggle");
const gameStart = document.querySelector("#gameStart");
const listenSong = document.querySelector("#listenSong");
const restartGame = document.querySelector("#restartGame");

function activeKeys() {
  return ALL_KEYS.slice(0, state.range);
}

function noteFromLabel(label) {
  return activeKeys().find((note) => note.label === label) || ALL_KEYS.find((note) => note.label === label);
}

function currentSongEvents() {
  return SONGS[state.songId].eventsByRange[state.range] || SONGS[state.songId].eventsByRange[3];
}

function setMessage(text) {
  message.textContent = text;
}

function setControlLabel(button, icon, label) {
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = `<span aria-hidden="true">${icon}</span><span class="control-label">${label}</span>`;
}

function renderKeyboard() {
  const keys = activeKeys();
  document.documentElement.style.setProperty("--key-count", keys.length);
  piano.replaceChildren();

  const keyboardFrame = document.createElement("div");
  keyboardFrame.className = "keyboard-frame";
  const whiteKeys = document.createElement("div");
  whiteKeys.className = "white-keys";
  const blackKeys = document.createElement("div");
  blackKeys.className = "black-keys";

  keys.forEach((note) => {
    const key = document.createElement("button");
    key.type = "button";
    key.className = "piano-key white-key";
    key.dataset.note = note.label;
    key.style.setProperty("--key-color", note.color);
    key.setAttribute("aria-label", `${note.label}の鍵盤`);
    key.innerHTML = `<span class="key-label">${note.label}</span>`;
    key.addEventListener("pointerdown", (event) => handleKeyPress(event, key, note));
    whiteKeys.appendChild(key);
  });

  BLACK_KEYS.filter((note) => note.afterWhite < state.range).forEach((note) => {
    const key = document.createElement("button");
    key.type = "button";
    key.className = "black-key";
    key.style.setProperty("--black-position", note.afterWhite);
    key.setAttribute("aria-label", `${note.label}の黒鍵`);
    key.innerHTML = `<span aria-hidden="true"></span>`;
    key.addEventListener("pointerdown", (event) => handleKeyPress(event, key, note));
    blackKeys.appendChild(key);
  });

  keyboardFrame.append(whiteKeys, blackKeys);
  piano.appendChild(keyboardFrame);

  fallingLane.style.setProperty("--key-count", keys.length);
  rangeLabel.textContent = state.range === 3 ? "3音からスタート" : `${state.range}音であそぶ`;
}

function pressVisual(key) {
  key.classList.add("is-pressed");
  window.setTimeout(() => key.classList.remove("is-pressed"), 150);
}

function handleKeyPress(event, key, note) {
  event.preventDefault();
  ensureAudio();
  pressVisual(key);

  if (state.soundOn) {
    playNote(note);
  }

  if (state.mode === "free") {
    setMessage(`${note.label}の音だね！`);
    return;
  }

  handleGameAnswer(note.label);
}

function ensureAudio() {
  if (!state.audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      try {
        state.audioContext = new AudioContextClass();
      } catch {
        state.audioContext = null;
      }
    }
  }

  if (state.audioContext && !state.outputGain) {
    state.outputGain = state.audioContext.createGain();
    state.compressor = state.audioContext.createDynamicsCompressor();
    state.compressor.threshold.value = -18;
    state.compressor.knee.value = 18;
    state.compressor.ratio.value = 4;
    state.compressor.attack.value = 0.003;
    state.compressor.release.value = 0.25;
    // スマホでも聞き取りやすい音量にしつつ、音割れを抑える。
    state.outputGain.gain.value = 1.35;
    state.outputGain.connect(state.compressor).connect(state.audioContext.destination);
  }

  if (state.audioContext && !state.samplesStarted) {
    state.samplesStarted = true;
    preloadPianoSamples();
  }

  if (state.audioContext?.state === "suspended") {
    state.audioContext.resume().catch(() => {});
  }

  // iPhone / iPad Safariは、ユーザー操作中に音声出力を一度解放する必要がある。
  // ほぼ無音の1サンプルを鳴らして、最初の鍵盤タップを確実に音声開始に使う。
  if (state.audioContext && !state.audioUnlocked) {
    try {
      const silentBuffer = state.audioContext.createBuffer(1, 1, 22050);
      const silentSource = state.audioContext.createBufferSource();
      silentSource.buffer = silentBuffer;
      silentSource.connect(state.outputGain || state.audioContext.destination);
      silentSource.start(0);
      state.audioUnlocked = true;
    } catch {
      // 次のユーザー操作で再試行する。
    }
  }
}

function frequencyForMidi(midi) {
  // A4=440Hz、12平均律。C4〜C5をピアノと同じ音高で計算する。
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function loadPianoSample(note) {
  const sampleName = PIANO_SAMPLE_NAMES[note.midi];
  if (!sampleName || !state.audioContext) return Promise.resolve(null);
  if (pianoSampleBuffers.has(note.midi)) return Promise.resolve(pianoSampleBuffers.get(note.midi));
  if (pianoSampleRequests.has(note.midi)) return pianoSampleRequests.get(note.midi);

  const request = fetch(`${PIANO_SAMPLE_ROOT}${sampleName}.mp3`, { mode: "cors" })
    .then((response) => {
      if (!response.ok) throw new Error(`piano sample ${response.status}`);
      return response.arrayBuffer();
    })
    .then((encoded) => state.audioContext.decodeAudioData(encoded))
    .then((buffer) => {
      pianoSampleBuffers.set(note.midi, buffer);
      return buffer;
    })
    .catch(() => null);

  pianoSampleRequests.set(note.midi, request);
  return request;
}

function preloadPianoSamples() {
  Object.keys(PIANO_SAMPLE_NAMES).forEach((midi) => {
    loadPianoSample({ midi: Number(midi) });
  });
}

function playPianoSample(buffer) {
  const context = state.audioContext;
  if (!context || !buffer) return;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(state.outputGain || context.destination);
  source.start();
}

function playSynthNote(note) {
  const context = state.audioContext;
  if (!context) return;

  const now = context.currentTime;
  const frequency = frequencyForMidi(note.midi);
  const master = context.createGain();
  const partials = [
    { ratio: 1, level: 0.55, type: "sine" },
    { ratio: 2.01, level: 0.22, type: "sine" },
    { ratio: 3.99, level: 0.12, type: "sine" },
    { ratio: 5.98, level: 0.06, type: "triangle" },
    { ratio: 8.15, level: 0.025, type: "sine" }
  ];

  // ピアノの打鍵らしく、短い立ち上がりと長い減衰を作る。
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.64, now + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 2.15);
  master.connect(state.outputGain || context.destination);

  partials.forEach(({ ratio, level, type }) => {
    const oscillator = context.createOscillator();
    const partialGain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency * ratio;
    partialGain.gain.setValueAtTime(level, now);
    partialGain.gain.exponentialRampToValueAtTime(Math.max(level * 0.2, 0.0001), now + 0.22);
    partialGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.05);
    oscillator.connect(partialGain).connect(master);
    oscillator.start(now);
    oscillator.stop(now + 2.2);
  });
}

function playNote(note) {
  const context = state.audioContext;
  if (!context) return;

  const playNow = () => {
    const loaded = pianoSampleBuffers.get(note.midi);
    if (loaded) {
      playPianoSample(loaded);
      return;
    }

    // iPhoneではネットワーク音源を待つと最初の音が無音になるため、
    // まず即時に予備音を鳴らし、ピアノ音源は次回以降のために裏で読み込む。
    playSynthNote(note);
    loadPianoSample(note);
  };

  // Safariが音声を一時停止状態から戻す前に音を予約すると、
  // 最初の音が消えることがある。再開後に実際の音を作る。
  if (context.state !== "running") {
    context.resume().then(playNow).catch(() => {
      window.setTimeout(playNow, 0);
    });
    return;
  }

  playNow();
}

function playSuccessSound() {
  if (!state.soundOn) return;
  const notes = [ALL_KEYS[0], ALL_KEYS[2], ALL_KEYS[4]];
  notes.forEach((note, index) => {
    window.setTimeout(() => playNote(note), index * 85);
  });
}

function updateModeButtons() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    const isActive = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function updateRangeButtons() {
  document.querySelectorAll("[data-range]").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.range) === state.range);
  });
}

function updateSongButtons() {
  document.querySelectorAll("[data-song]").forEach((button) => {
    const isActive = button.dataset.song === state.songId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  selectedSongName.textContent = SONGS[state.songId].name.replace("（れんしゅう）", "");
}

function clearHint() {
  document.querySelectorAll(".piano-key.is-hint").forEach((key) => key.classList.remove("is-hint"));
}

function hintForPendingNotes() {
  clearHint();
  state.pendingNotes.forEach((label) => {
    const key = [...document.querySelectorAll(".piano-key")].find((button) => button.dataset.note === label);
    key?.classList.add("is-hint");
  });
}

function setMode(mode) {
  if (mode === "free") {
    state.mode = "free";
    stopGame();
    stopListening();
    updateModeButtons();
    setMessage("鍵盤を押して、音を聞いてみよう");
    setControlLabel(gameStart, "▶", "あそぶ");
    return;
  }

  state.mode = "game";
  updateModeButtons();
  startGame();
}

function setRange(range) {
  state.range = range;
  renderKeyboard();
  updateRangeButtons();
  if (state.mode === "game") {
    startGame();
  } else {
    setMessage(range === 3 ? "まずはド・レ・ミをおしてみよう" : "好きな鍵盤をおしてみよう");
  }
}

function setSong(songId) {
  state.songId = songId;
  updateSongButtons();
  stopListening();
  if (state.mode === "game") {
    startGame();
  } else {
    setMessage(`「${SONGS[songId].name.replace("（れんしゅう）", "")}」をえらんだよ`);
  }
}

function fingerForLabel(label) {
  const keyIndex = Math.max(0, activeKeys().findIndex((note) => note.label === label));
  const rightHandFingers = state.range === 8 ? [1, 2, 3, 1, 2, 3, 4, 5] : [1, 2, 3, 4, 5];
  return rightHandFingers[keyIndex] || 1;
}

function setNoteCards(labels, top = "14%") {
  noteCards.replaceChildren();
  labels.forEach((label) => {
    const keyIndex = Math.max(0, activeKeys().findIndex((note) => note.label === label));
    const left = ((keyIndex + 0.5) / activeKeys().length) * 100;
    const note = noteFromLabel(label);
    const card = document.createElement("div");
    card.className = "note-card";
    card.dataset.note = label;
    card.style.left = `${left}%`;
    card.style.top = top;
    card.style.setProperty("--note-color", note?.color || "#8b6a4d");
    card.innerHTML = `<strong>${label}</strong><span>指 ${fingerForLabel(label)}</span>`;
    noteCards.appendChild(card);
  });
}

function showCurrentEvent(token) {
  if (token !== state.gameToken || state.mode !== "game") return;

  const songEvents = currentSongEvents();
  if (state.currentIndex >= songEvents.length) {
    finishGame();
    return;
  }

  state.pendingNotes = [...songEvents[state.currentIndex]];
  state.noteStart = performance.now();
  state.reachedBottom = false;
  setNoteCards(state.pendingNotes);
  hintForPendingNotes();
  setMessage(state.pendingNotes.length > 1
    ? `「${state.pendingNotes.join("・")}」をいっしょにおしてみよう`
    : `「${state.pendingNotes[0]}」をおしてみよう`);
  cancelAnimationFrame(state.animationFrame);
  state.animationFrame = requestAnimationFrame((now) => animateNote(now, token));
}

function animateNote(now, token) {
  if (token !== state.gameToken || state.mode !== "game" || !state.pendingNotes.length) return;

  const progress = Math.min((now - state.noteStart) / state.noteDuration, 1);
  const top = 14 + progress * 75;
  noteCards.querySelectorAll(".note-card").forEach((card) => {
    card.style.top = `${top}%`;
  });

  if (progress >= 1) {
    if (!state.reachedBottom) {
      state.reachedBottom = true;
      noteCards.querySelectorAll(".note-card:not(.is-success)").forEach((card) => card.classList.add("is-late"));
      hintForPendingNotes();
      setMessage(state.pendingNotes.length > 1
        ? `ゆっくりで大丈夫。2つの音をさがそう`
        : `ゆっくりで大丈夫。「${state.pendingNotes[0]}」をさがそう`);
    }
    return;
  }

  state.animationFrame = requestAnimationFrame((nextNow) => animateNote(nextNow, token));
}

function handleGameAnswer(label) {
  if (!state.pendingNotes.length) return;

  const pendingIndex = state.pendingNotes.indexOf(label);
  if (pendingIndex === -1) {
    noteCards.querySelectorAll(".note-card:not(.is-success)").forEach((card) => {
      card.classList.remove("is-wrong");
      void card.offsetWidth;
      card.classList.add("is-wrong");
    });
    setMessage(`おしい！「${state.pendingNotes.join("・")}」をさがしてみよう`);
    hintForPendingNotes();
    return;
  }

  const progress = Math.min((performance.now() - state.noteStart) / state.noteDuration, 1);
  const isOnBeat = progress >= 0.74;
  const matchedCard = [...noteCards.querySelectorAll(".note-card")].find((card) => card.dataset.note === label && !card.classList.contains("is-success"));
  matchedCard?.classList.add("is-success");
  state.pendingNotes.splice(pendingIndex, 1);

  if (state.pendingNotes.length) {
    hintForPendingNotes();
    setMessage(`あと${state.pendingNotes.length}つ。いっしょにおしてみよう`);
    return;
  }

  const points = isOnBeat ? 2 : 1;
  state.score += points;
  state.combo += 1;
  scorePill.textContent = `⭐ ${state.score}`;
  comboPill.textContent = `${state.combo}コンボ`;
  clearHint();
  cancelAnimationFrame(state.animationFrame);
  setMessage(isOnBeat ? "ぴったり！" : "できた！");
  playSuccessSound();

  const token = state.gameToken;
  window.setTimeout(() => {
    if (token !== state.gameToken || state.mode !== "game") return;
    state.currentIndex += 1;
    showCurrentEvent(token);
  }, 430);
}

function startGame() {
  ensureAudio();
  stopListening();
  state.mode = "game";
  state.score = 0;
  state.combo = 0;
  state.currentIndex = 0;
  state.pendingNotes = [];
  state.gameToken += 1;
  scorePill.textContent = "⭐ 0";
  comboPill.textContent = "0コンボ";
  setControlLabel(gameStart, "▶", "もういちど");
  updateModeButtons();
  showCurrentEvent(state.gameToken);
}

function stopGame() {
  state.gameToken += 1;
  state.pendingNotes = [];
  cancelAnimationFrame(state.animationFrame);
  clearHint();
  noteCards.replaceChildren();
}

function stopListening() {
  state.listenTimers.forEach((timer) => window.clearTimeout(timer));
  state.listenTimers = [];
  state.listening = false;
  setControlLabel(listenSong, "♫", "きく");
  noteCards.replaceChildren();
}

function flashPlayingKey(label) {
  const key = [...document.querySelectorAll(".white-key")].find((button) => button.dataset.note === label);
  if (!key) return;
  key.classList.add("is-pressed");
  window.setTimeout(() => key.classList.remove("is-pressed"), 190);
}

function listenToSong() {
  if (state.listening) {
    stopListening();
    setMessage("いったん止めたよ");
    return;
  }

  ensureAudio();
  stopGame();
  state.mode = "free";
  updateModeButtons();
  state.listening = true;
  setControlLabel(listenSong, "■", "とめる");
  const events = currentSongEvents();
  const interval = 520;
  setMessage(`「${SONGS[state.songId].name.replace("（れんしゅう）", "")}」をきいているよ`);

  events.forEach((labels, index) => {
    state.listenTimers.push(window.setTimeout(() => {
      labels.forEach((label) => {
        const note = noteFromLabel(label);
        if (state.soundOn && note) playNote(note);
        flashPlayingKey(label);
      });
      setNoteCards(labels, "52%");
      noteCards.querySelectorAll(".note-card").forEach((card) => card.classList.add("is-listening"));
    }, index * interval));
  });

  state.listenTimers.push(window.setTimeout(() => {
    stopListening();
    setMessage("もういちど きいてみる？");
  }, events.length * interval + 900));
}

function finishGame() {
  state.pendingNotes = [];
  clearHint();
  noteCards.replaceChildren();
  setMessage(`ぜんぶできたね！ ${state.score}こ せいかい ⭐`);
  playSuccessSound();
}

soundToggle.addEventListener("click", () => {
  if (!state.soundOn) ensureAudio();
  state.soundOn = !state.soundOn;
  soundToggle.classList.toggle("is-muted", !state.soundOn);
  soundToggle.setAttribute("aria-pressed", String(state.soundOn));
  soundToggle.setAttribute("aria-label", state.soundOn ? "音あり" : "音なし");
  soundToggle.title = state.soundOn ? "音あり" : "音なし";
  soundToggle.innerHTML = state.soundOn
    ? "<span aria-hidden=\"true\">🔊</span><span class=\"sound-toggle-label\">音</span>"
    : "<span aria-hidden=\"true\">🔇</span><span class=\"sound-toggle-label\">消音</span>";
  setMessage(state.soundOn ? "音が鳴るよ。鍵盤をおしてみよう" : "音を消したよ。画面だけでも遊べるよ");
});

// iPhone / iPadで鍵盤以外を最初に触った場合も、音声を先に解放しておく。
const unlockAudioOnFirstGesture = () => ensureAudio();
window.addEventListener("pointerdown", unlockAudioOnFirstGesture, { capture: true, once: true, passive: true });
window.addEventListener("touchstart", unlockAudioOnFirstGesture, { capture: true, once: true, passive: true });

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

document.querySelectorAll("[data-range]").forEach((button) => {
  button.addEventListener("click", () => setRange(Number(button.dataset.range)));
});

document.querySelectorAll("[data-song]").forEach((button) => {
  button.addEventListener("click", () => setSong(button.dataset.song));
});

gameStart.addEventListener("click", startGame);
listenSong.addEventListener("click", listenToSong);
restartGame.addEventListener("click", startGame);

renderKeyboard();
updateModeButtons();
updateRangeButtons();
updateSongButtons();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // GitHub Pages以外のローカル表示でも、アプリ本体はそのまま使えます。
    });
  });
}
