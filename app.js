const ALL_KEYS = [
  { id: "do", label: "ド", midi: 60, color: "#ef7182" },
  { id: "re", label: "レ", midi: 62, color: "#ef9d66" },
  { id: "mi", label: "ミ", midi: 64, color: "#f3be4a" },
  { id: "fa", label: "ファ", midi: 65, color: "#8bc79e" },
  { id: "so", label: "ソ", midi: 67, color: "#66b9d4" },
  { id: "la", label: "ラ", midi: 69, color: "#789bd1" },
  { id: "ti", label: "シ", midi: 71, color: "#a995cf" },
  { id: "do2", label: "ド", midi: 72, color: "#e98dac" }
];

const BLACK_KEYS = [
  { id: "do-sharp", label: "ド♯", midi: 61, afterWhite: 1 },
  { id: "re-sharp", label: "レ♯", midi: 63, afterWhite: 2 },
  { id: "fa-sharp", label: "ファ♯", midi: 66, afterWhite: 4 },
  { id: "so-sharp", label: "ソ♯", midi: 68, afterWhite: 5 },
  { id: "la-sharp", label: "ラ♯", midi: 70, afterWhite: 6 }
];

const SONGS = {
  twinkle: {
    name: "きらきら星（れんしゅう）",
    notesByRange: {
      3: ["ド", "ド", "ミ", "ミ", "レ", "レ", "ド", "ミ", "レ", "ド"],
      5: ["ド", "ド", "ソ", "ソ", "ファ", "ファ", "ミ", "ミ", "レ", "レ", "ド"],
      8: ["ド", "ド", "ソ", "ソ", "ラ", "ラ", "ソ", "ファ", "ファ", "ミ", "ミ", "レ", "レ", "ド"]
    }
  },
  mini: {
    name: "ドレミのぼうけん",
    notesByRange: {
      3: ["ド", "レ", "ミ", "レ", "ド", "ミ", "レ", "ド"],
      5: ["ド", "レ", "ミ", "ファ", "ソ", "ファ", "ミ", "レ", "ド"],
      8: ["ド", "レ", "ミ", "ファ", "ソ", "ラ", "ソ", "ミ", "レ", "ド"]
    }
  },
  frog: {
    name: "かえるのうた",
    notesByRange: {
      3: ["ド", "レ", "ミ", "ド", "ド", "レ", "ミ", "ド"],
      5: ["ド", "レ", "ミ", "ド", "ド", "レ", "ミ", "ド", "ミ", "ファ", "ソ"],
      8: ["ド", "レ", "ミ", "ド", "ド", "レ", "ミ", "ド", "ミ", "ファ", "ソ", "ソ", "ミ", "ミ", "ド"]
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
  pendingNote: null,
  noteStart: 0,
  noteDuration: 2800,
  reachedBottom: false,
  animationFrame: null,
  gameToken: 0,
  audioContext: null,
  listening: false,
  listenTimers: []
};

const piano = document.querySelector("#piano");
const fallingLane = document.querySelector("#fallingLane");
const noteCard = document.querySelector("#noteCard");
const noteText = document.querySelector("#noteText");
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

function currentSongNotes() {
  return SONGS[state.songId].notesByRange[state.range] || SONGS[state.songId].notesByRange[3];
}

function setMessage(text) {
  message.textContent = text;
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
    key.innerHTML = `<span class="key-label">${note.label}</span><span class="key-hint">ここをおす</span>`;
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
      state.audioContext = new AudioContextClass();
    }
  }

  if (state.audioContext?.state === "suspended") {
    state.audioContext.resume();
  }
}

function frequencyForMidi(midi) {
  // A4=440Hz、12平均律。C4〜C5をピアノと同じ音高で計算する。
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function playNote(note) {
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
  master.gain.exponentialRampToValueAtTime(0.52, now + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 2.15);
  master.connect(context.destination);

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

function hintForPendingNote() {
  clearHint();
  if (!state.pendingNote) return;
  const key = [...document.querySelectorAll(".piano-key")].find((button) => button.dataset.note === state.pendingNote);
  key?.classList.add("is-hint");
}

function setMode(mode) {
  if (mode === "free") {
    state.mode = "free";
    stopGame();
    stopListening();
    updateModeButtons();
    setMessage("鍵盤を押して、音を聞いてみよう");
    gameStart.textContent = "音符あそびをはじめる";
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

function setNoteCard(noteLabel) {
  const keyIndex = activeKeys().findIndex((note) => note.label === noteLabel);
  const left = ((keyIndex + 0.5) / activeKeys().length) * 100;
  noteText.textContent = noteLabel;
  noteCard.style.left = `${left}%`;
  noteCard.style.top = "14%";
  noteCard.classList.remove("is-hidden", "is-late", "is-success", "is-wrong");
}

function showCurrentNote(token) {
  if (token !== state.gameToken || state.mode !== "game") return;

  const songNotes = currentSongNotes();
  if (state.currentIndex >= songNotes.length) {
    finishGame();
    return;
  }

  state.pendingNote = songNotes[state.currentIndex];
  state.noteStart = performance.now();
  state.reachedBottom = false;
  setNoteCard(state.pendingNote);
  hintForPendingNote();
  setMessage(`「${state.pendingNote}」をおしてみよう`);
  cancelAnimationFrame(state.animationFrame);
  state.animationFrame = requestAnimationFrame((now) => animateNote(now, token));
}

function animateNote(now, token) {
  if (token !== state.gameToken || state.mode !== "game" || !state.pendingNote) return;

  const progress = Math.min((now - state.noteStart) / state.noteDuration, 1);
  const top = 14 + progress * 75;
  noteCard.style.top = `${top}%`;

  if (progress >= 1) {
    if (!state.reachedBottom) {
      state.reachedBottom = true;
      noteCard.classList.add("is-late");
      hintForPendingNote();
      setMessage(`ゆっくりで大丈夫。「${state.pendingNote}」をさがそう`);
    }
    return;
  }

  state.animationFrame = requestAnimationFrame((nextNow) => animateNote(nextNow, token));
}

function handleGameAnswer(label) {
  if (!state.pendingNote) return;

  if (label !== state.pendingNote) {
    noteCard.classList.remove("is-wrong");
    void noteCard.offsetWidth;
    noteCard.classList.add("is-wrong");
    setMessage(`おしい！「${state.pendingNote}」をさがしてみよう`);
    hintForPendingNote();
    return;
  }

  const progress = Math.min((performance.now() - state.noteStart) / state.noteDuration, 1);
  const isOnBeat = progress >= 0.74;
  const points = isOnBeat ? 2 : 1;
  state.score += points;
  state.combo += 1;
  scorePill.textContent = `⭐ ${state.score}`;
  comboPill.textContent = `${state.combo}コンボ`;
  state.pendingNote = null;
  clearHint();
  cancelAnimationFrame(state.animationFrame);
  noteCard.classList.add("is-success");
  setMessage(isOnBeat ? "ぴったり！" : "できた！");
  playSuccessSound();

  const token = state.gameToken;
  window.setTimeout(() => {
    if (token !== state.gameToken || state.mode !== "game") return;
    state.currentIndex += 1;
    showCurrentNote(token);
  }, 430);
}

function startGame() {
  ensureAudio();
  stopListening();
  state.mode = "game";
  state.score = 0;
  state.combo = 0;
  state.currentIndex = 0;
  state.pendingNote = null;
  state.gameToken += 1;
  scorePill.textContent = "⭐ 0";
  comboPill.textContent = "0コンボ";
  gameStart.textContent = "音符あそびをもう一度";
  updateModeButtons();
  showCurrentNote(state.gameToken);
}

function stopGame() {
  state.gameToken += 1;
  state.pendingNote = null;
  cancelAnimationFrame(state.animationFrame);
  clearHint();
  noteCard.className = "note-card is-hidden";
}

function stopListening() {
  state.listenTimers.forEach((timer) => window.clearTimeout(timer));
  state.listenTimers = [];
  state.listening = false;
  listenSong.textContent = "🎵 きいてみる";
  noteCard.className = "note-card is-hidden";
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
  listenSong.textContent = "⏹ いったん止める";
  const notes = currentSongNotes();
  const interval = 520;
  setMessage(`「${SONGS[state.songId].name.replace("（れんしゅう）", "")}」をきいているよ`);

  notes.forEach((label, index) => {
    state.listenTimers.push(window.setTimeout(() => {
      const note = noteFromLabel(label);
      if (state.soundOn && note) playNote(note);
      flashPlayingKey(label);
      setNoteCard(label);
      noteCard.classList.add("is-listening");
      noteCard.style.top = "52%";
    }, index * interval));
  });

  state.listenTimers.push(window.setTimeout(() => {
    stopListening();
    setMessage("もういちど きいてみる？");
  }, notes.length * interval + 900));
}

function finishGame() {
  state.pendingNote = null;
  clearHint();
  noteCard.classList.add("is-hidden");
  setMessage(`ぜんぶできたね！ ${state.score}こ せいかい ⭐`);
  playSuccessSound();
}

soundToggle.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  soundToggle.classList.toggle("is-muted", !state.soundOn);
  soundToggle.setAttribute("aria-pressed", String(state.soundOn));
  soundToggle.innerHTML = state.soundOn ? "<span aria-hidden=\"true\">🔊</span> 音あり" : "<span aria-hidden=\"true\">🔇</span> 音なし";
  setMessage(state.soundOn ? "音が鳴るよ。鍵盤をおしてみよう" : "音を消したよ。画面だけでも遊べるよ");
});

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
