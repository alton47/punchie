/**
 * ═══════════════════════════════════════════════════════════════
 *  PUNCH'S GREAT ESCAPE  —  game.js
 *  Complete game engine, audio, tutorial, rendering.
 *  Delta-time physics. Mobile-first. Fully responsive canvas.
 *  by Allan (@alton47)
 * ═══════════════════════════════════════════════════════════════
 */

"use strict";

/* ════════════════════════════════════════════════════
   AUDIO MODULE
   ────────────────────────────────────────────────────
   Custom Web Audio synthesis. Zero external assets.
   Ghost-of-Tsushima-inspired pentatonic flute.
   All sounds are 100% procedural / copyright-free.
   ════════════════════════════════════════════════════ */
const PunchAudio = (() => {
  let ac,
    muted = false;

  function wake() {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
  }

  /** Smooth tone (flute-like: sine + soft harmonic + exponential decay) */
  function flute(freq, dur, vol = 0.18, delay = 0) {
    if (muted) return;
    wake();
    try {
      const t = ac.currentTime + delay;
      const o = ac.createOscillator();
      const g = ac.createGain();
      const o2 = ac.createOscillator();
      const g2 = ac.createGain();

      // Primary sine — flute body
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t);
      o.frequency.linearRampToValueAtTime(freq * 1.003, t + dur * 0.5); // slight pitch drift
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.03);
      g.gain.setValueAtTime(vol, t + dur * 0.65);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(ac.destination);
      o.start(t);
      o.stop(t + dur + 0.05);

      // Second harmonic — flute breathiness
      o2.type = "sine";
      o2.frequency.setValueAtTime(freq * 2, t);
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(vol * 0.12, t + 0.04);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);
      o2.connect(g2);
      g2.connect(ac.destination);
      o2.start(t);
      o2.stop(t + dur * 0.75);
    } catch {}
  }

  /** Soft noise breath (flute air) */
  function breath(dur = 0.08, vol = 0.06) {
    if (muted) return;
    wake();
    try {
      const samples = Math.floor(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, samples, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < samples; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / samples) * 0.4;
      }
      const src = ac.createBufferSource();
      const g = ac.createGain();
      const f = ac.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1200;
      f.Q.value = 0.8;
      src.buffer = buf;
      g.gain.setValueAtTime(vol, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      src.connect(f);
      f.connect(g);
      g.connect(ac.destination);
      src.start();
    } catch {}
  }

  /** Generic short tone */
  function tone(freq, type, dur, vol = 0.2, delay = 0) {
    if (muted) return;
    wake();
    try {
      const t = ac.currentTime + delay;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(ac.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch {}
  }

  // ─── PENTATONIC SCALES ────────────────────────────────────────
  // D pentatonic major:  D  E  F#  A  B  (calm, hopeful)
  // E pentatonic minor:  E  G  A  B  D   (darker, moody)
  // All frequencies precise Hz values for copyright-free generation

  const SCALE_CALM = [
    293.66,
    329.63,
    369.99,
    440.0,
    493.88, // D4-B4
    587.33,
    659.25,
    739.99,
    880.0,
    987.77, // D5-B5
  ];
  const SCALE_TENSE = [
    329.63,
    392.0,
    440.0,
    493.88,
    587.33, // E4 pentatonic minor
    659.25,
    783.99,
    880.0,
    987.77,
    1174.66,
  ];
  const SCALE_DARK = [
    246.94,
    293.66,
    349.23,
    392.0,
    440.0, // B3-based dark minor
    493.88,
    587.33,
    698.46,
    783.99,
    880.0,
  ];
  const SCALE_INTENSE = [
    329.63,
    415.3,
    493.88,
    554.37,
    659.25, // fast minor
    698.46,
    830.61,
    987.77,
    1108.73,
    1318.51,
  ];

  // Phrase patterns: array of scale indices
  const PHRASES = {
    calm: [
      [4, 6, 7, 6, 4, 2, 0, 2, 4, 2, 0, 4, 6, 7, 6, 4],
      [0, 2, 4, 6, 7, 4, 2, 0, 2, 4, 0, 6, 4, 2, 0, 2],
    ],
    tense: [
      [2, 4, 5, 7, 5, 4, 2, 0, 2, 5, 4, 2, 5, 7, 5, 2],
      [0, 3, 5, 7, 5, 3, 0, 3, 5, 7, 5, 3, 0, 5, 3, 0],
    ],
    dark: [
      [3, 1, 0, 2, 4, 3, 1, 0, 3, 5, 4, 2, 0, 1, 3, 1],
      [5, 4, 3, 1, 0, 3, 5, 4, 3, 1, 0, 1, 3, 4, 3, 0],
    ],
    intense: [
      [4, 6, 8, 7, 5, 4, 2, 4, 6, 8, 9, 8, 6, 4, 6, 8],
      [8, 7, 6, 4, 6, 8, 9, 8, 6, 4, 2, 4, 6, 7, 6, 4],
    ],
    end: [[0, 2, 4, 6, 7, 6, 4, 2, 0, 2, 4, 7, 6, 4, 2, 0]],
  };

  let bgTimeout = null,
    phrasePhase = 0;

  function startMusic(mood = "calm") {
    stopMusic();
    if (muted) return;

    const scaleMap = {
      calm: SCALE_CALM,
      tense: SCALE_TENSE,
      dark: SCALE_DARK,
      intense: SCALE_INTENSE,
      end: SCALE_CALM,
    };
    const scale = scaleMap[mood] || SCALE_CALM;
    const phrases = PHRASES[mood] || PHRASES.calm;
    const phrase = phrases[phrasePhase % phrases.length];
    phrasePhase++;

    // Tempo: calm=slow, intense=fast
    const tempoMap = {
      calm: 0.48,
      tense: 0.4,
      dark: 0.38,
      intense: 0.28,
      end: 0.54,
    };
    const tempo = tempoMap[mood] || 0.44;

    let step = 0;

    function playNote() {
      if (muted) return;
      const idx = phrase[step % phrase.length];
      const freq = scale[Math.min(idx, scale.length - 1)];

      // Main flute note
      flute(freq, tempo * 0.82, 0.16);
      // Breath on every note
      breath(tempo * 0.2, 0.04);

      // Bass drone every 4 steps
      if (step % 4 === 0) {
        flute(freq * 0.5, tempo * 2.2, 0.07);
      }

      // Occasional high sparkle (flute harmonics)
      if (step % 8 === 3) {
        const sparkFreq = scale[(idx + 4) % scale.length] * 2;
        flute(sparkFreq, tempo * 0.35, 0.04, tempo * 0.3);
      }

      // Wind effect (very subtle, occasional)
      if (step % 12 === 0 && mood === "calm") {
        breath(tempo * 4, 0.025);
      }

      step++;
      if (step < phrase.length * 2) {
        bgTimeout = setTimeout(playNote, tempo * 1000);
      } else {
        bgTimeout = setTimeout(() => startMusic(mood), 300);
      }
    }

    playNote();
  }

  function stopMusic() {
    if (bgTimeout) {
      clearTimeout(bgTimeout);
      bgTimeout = null;
    }
  }

  // ─── SFX ──────────────────────────────────────────────────────

  const SFX = {
    jump: () => {
      flute(440, 0.14, 0.2);
      flute(587, 0.1, 0.12, 0.08);
      breath(0.06, 0.08);
    },
    djump: () => {
      flute(659, 0.12, 0.22);
      flute(880, 0.1, 0.16, 0.07);
      flute(1047, 0.08, 0.1, 0.14);
      breath(0.05, 0.06);
    },
    slide: () => {
      breath(0.12, 0.22);
      tone(200, "sine", 0.1, 0.08);
    },
    hit: () => {
      tone(150, "square", 0.2, 0.28);
      tone(100, "sawtooth", 0.18, 0.22, 0.06);
      setTimeout(() => SFX.mkCry(), 160);
    },
    mkCry: () => {
      flute(320, 0.08, 0.1);
      flute(240, 0.12, 0.08, 0.08);
      flute(180, 0.16, 0.07, 0.16);
    },
    mkPass: () => {
      breath(0.06, 0.08);
      tone(380, "sine", 0.04, 0.04);
    },
    gem: () => {
      flute(880, 0.08, 0.2);
      flute(1047, 0.1, 0.15, 0.06);
    },
    rare: () => {
      [784, 1047, 1319, 1568].forEach((f, i) => flute(f, 0.3, 0.18, i * 0.09));
    },
    immuno: () => {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        flute(f, 0.22, 0.2, i * 0.08),
      );
    },
    magnet: () => {
      flute(440, 0.12, 0.18);
      flute(660, 0.1, 0.15, 0.08);
      flute(880, 0.1, 0.13, 0.16);
    },
    lvlUp: () => {
      [392, 523, 659, 784, 1047].forEach((f, i) =>
        flute(f, 0.26, 0.22, i * 0.11),
      );
    },
    death: () => {
      tone(280, "square", 0.1, 0.25);
      tone(200, "square", 0.15, 0.22, 0.1);
      tone(120, "sawtooth", 0.28, 0.28, 0.22);
    },
    win: () => {
      [523, 659, 784, 1047, 784, 1047, 1319, 1047, 784, 1319].forEach((f, i) =>
        flute(f, 0.32, 0.22, i * 0.16),
      );
    },
    countdown: () => flute(440, 0.22, 0.28),
    go: () => {
      flute(659, 0.18, 0.3);
      flute(880, 0.22, 0.25, 0.14);
    },
  };

  function toggleMute() {
    muted = !muted;
    const btn1 = document.getElementById("mute-btn");
    const btn2 = document.getElementById("mute-hud");
    const ico = muted ? "🔇" : "🔊";
    if (btn1) btn1.textContent = ico;
    if (btn2) btn2.textContent = ico;
    if (muted) stopMusic();
    else {
      // resume music if game is playing
      if (window.PunchGame && PunchGame.state === "playing") {
        startMusic(LEVELS[PunchGame.level - 1]?.music || "calm");
      } else {
        startMusic("calm");
      }
    }
  }

  return {
    wake,
    startMusic,
    stopMusic,
    sfx: SFX,
    toggleMute,
    get muted() {
      return muted;
    },
  };
})();

/* ════════════════════════════════════════════════════
   GAME DATA — Villains, Gems, Levels
   ════════════════════════════════════════════════════ */

/** Villain definitions. Tier controls when they first appear. */
const VILLAINS = [
  {
    id: "slider",
    name: "Knuckles",
    color: "#ef476f",
    tier: 1,
    action: "JUMP",
    h: 38,
    w: 44,
    desc: "Slides low along the ground!",
  },
  {
    id: "jumper",
    name: "Bobo",
    color: "#ff9f1c",
    tier: 1,
    action: "JUMP",
    h: 44,
    w: 44,
    desc: "Charges at mid-height!",
  },
  {
    id: "vine",
    name: "Creepvine",
    color: "#06d6a0",
    tier: 1,
    action: "DUCK",
    h: 70,
    w: 18,
    desc: "Hangs from above — duck under!",
  },
  {
    id: "rock",
    name: "Rockhead",
    color: "#94a3b8",
    tier: 2,
    action: "JUMP",
    h: 44,
    w: 44,
    desc: "Big rock hurled at you!",
  },
  {
    id: "peel",
    name: "Slippy",
    color: "#fdd835",
    tier: 2,
    action: "JUMP",
    h: 22,
    w: 42,
    desc: "Banana peel sliding in!",
  },
  {
    id: "bigbobo",
    name: "BIG Bobo",
    color: "#f97316",
    tier: 3,
    action: "HIGH",
    h: 70,
    w: 46,
    desc: "Giant monkey — double jump!",
  },
  {
    id: "swinger",
    name: "Swingby",
    color: "#a855f7",
    tier: 3,
    action: "DUCK",
    h: 65,
    w: 20,
    desc: "Swings down — duck under!",
  },
  {
    id: "twintrap",
    name: "Twin Trap",
    color: "#ec4899",
    tier: 4,
    action: "JUMP",
    h: 44,
    w: 44,
    desc: "Two at once — jump over!",
  },
  {
    id: "boulder",
    name: "Crusher",
    color: "#6b7280",
    tier: 4,
    action: "JUMP",
    h: 48,
    w: 48,
    desc: "Rolling boulder — JUMP!",
  },
  {
    id: "spike",
    name: "Stabby",
    color: "#ef4444",
    tier: 5,
    action: "HIGH",
    h: 55,
    w: 30,
    desc: "Spike wall — highest jump!",
  },
];

/** Floating obstacles (vines etc.) that bob up and down */
const FLOAT_IDS = new Set(["vine", "swinger", "rock", "boulder"]);

/** Gem definitions — rarity = probability weight */
const GEMS = [
  {
    id: "coin",
    emoji: "🪙",
    name: "Gold Coin",
    pts: 30,
    rarity: 0.5,
    color: "#ffd166",
    effect: "pts",
  },
  {
    id: "banana",
    emoji: "🍌",
    name: "Banana",
    pts: 50,
    rarity: 0.22,
    color: "#fdd835",
    effect: "pts",
  },
  {
    id: "ruby",
    emoji: "💎",
    name: "Ruby Gem",
    pts: 120,
    rarity: 0.11,
    color: "#ff4d6d",
    effect: "pts",
  },
  {
    id: "heart",
    emoji: "❤️",
    name: "Heart Gem",
    pts: 0,
    rarity: 0.06,
    color: "#ff6b6b",
    effect: "life",
  },
  {
    id: "star",
    emoji: "⭐",
    name: "Lucky Star",
    pts: 200,
    rarity: 0.04,
    color: "#ffd166",
    effect: "pts",
  },
  {
    id: "magnet",
    emoji: "🧲",
    name: "Magnet",
    pts: 40,
    rarity: 0.04,
    color: "#f472b6",
    effect: "magnet",
  },
  {
    id: "orb",
    emoji: "🔮",
    name: "Immunity Orb",
    pts: 80,
    rarity: 0.02,
    color: "#c084fc",
    effect: "immuno",
  },
  {
    id: "diamond",
    emoji: "💠",
    name: "Diamond Shard",
    pts: 400,
    rarity: 0.01,
    color: "#67e8f9",
    effect: "pts",
  },
];

/** Level config. Music mood drives the pentatonic scale + tempo. */
const LEVELS = [
  {
    n: 1,
    name: "Monkey Zoo",
    emoji: "🏛️",
    bg: "zoo",
    speedMult: 1.0,
    obsCount: 10,
    music: "calm",
    desc: "Welcome to the chaos!",
  },
  {
    n: 2,
    name: "Bamboo Forest",
    emoji: "🎋",
    bg: "bamboo",
    speedMult: 1.05,
    obsCount: 11,
    music: "calm",
    desc: "Watch the hanging bamboo!",
  },
  {
    n: 3,
    name: "River Banks",
    emoji: "🌊",
    bg: "river",
    speedMult: 1.1,
    obsCount: 12,
    music: "calm",
    desc: "Slippery ground, stay sharp!",
  },
  {
    n: 4,
    name: "Ancient Ruins",
    emoji: "🏛️",
    bg: "ruins",
    speedMult: 1.16,
    obsCount: 13,
    music: "tense",
    desc: "The stones begin to fly...",
  },
  {
    n: 5,
    name: "Mushroom Grove",
    emoji: "🍄",
    bg: "mushroom",
    speedMult: 1.24,
    obsCount: 14,
    music: "tense",
    desc: "Speed picks up. Stay focused.",
  },
  {
    n: 6,
    name: "Crystal Cave",
    emoji: "💎",
    bg: "cave",
    speedMult: 1.33,
    obsCount: 15,
    music: "dark",
    desc: "Dark. Fast. Dangerous.",
  },
  {
    n: 7,
    name: "Volcano Edge",
    emoji: "🌋",
    bg: "volcano",
    speedMult: 1.42,
    obsCount: 16,
    music: "dark",
    desc: "The ground is on FIRE.",
  },
  {
    n: 8,
    name: "Moonlit Path",
    emoji: "🌙",
    bg: "moon",
    speedMult: 1.52,
    obsCount: 17,
    music: "dark",
    desc: "So close. Don't stop.",
  },
  {
    n: 9,
    name: "Storm Valley",
    emoji: "⚡",
    bg: "storm",
    speedMult: 1.62,
    obsCount: 18,
    music: "intense",
    desc: "MAXIMUM SPEED. GO GO GO!",
  },
  {
    n: 10,
    name: "THE PLUSHIE!!!",
    emoji: "🧸",
    bg: "final",
    speedMult: 1.72,
    obsCount: 20,
    music: "intense",
    desc: "THIS IS IT. FOR THE PLUSHIE!",
  },
];

const MUSIC_LABELS = {
  calm: "🎵 Peaceful flute",
  tense: "🎵 Tense flute",
  dark: "🎵 Dark & mysterious flute",
  intense: "🎵 Fast danger flute",
  end: "🎵 Peaceful reprise",
};

const FAILS = [
  {
    title: "💀 BONKED!",
    msg: "A rock to the skull. Stars everywhere.",
    col: "#ff4d6d",
  },
  {
    title: "🍌 SLIPPED!",
    msg: "Classic banana peel. No shame at all.",
    col: "#ffd166",
  },
  {
    title: "🐒 TACKLED!",
    msg: "Knuckles body-slammed Punch. Respect.",
    col: "#ff9f1c",
  },
  {
    title: "🌿 TANGLED!",
    msg: "Creepvine grabbed him mid-stride.",
    col: "#06d6a0",
  },
  {
    title: "🪨 CRUSHED!",
    msg: "Crusher rolled right through Punch.",
    col: "#94a3b8",
  },
  {
    title: "👿 AMBUSHED!",
    msg: "Twin Trap had this planned all along.",
    col: "#ec4899",
  },
  { title: "⚡ SPIKED!", msg: "Stabby appeared from nowhere.", col: "#ef4444" },
  {
    title: "😵 OVERWHELMED!",
    msg: "The whole gang showed up. It's a reunion.",
    col: "#a855f7",
  },
];

/** Physics constants (per-second in canvas design units) */
const PHYSICS = {
  gravity: 1800,
  jumpVel: -640,
  dJumpVel: -530,
  baseSpeed: 300,
};

// Base speed the canvas is designed around (px)
const DS_W = 800; // used only for speed/position calculations
const DS_H = 300;

/* ════════════════════════════════════════════════════
   GAME MODULE  (PunchGame)
   ════════════════════════════════════════════════════ */
const PunchGame = (() => {
  // ─── Canvas refs ──────────────────────────────────────────────
  let canvas, ctx;
  let cw = 800,
    ch = 300; // actual pixel dims, set by resize

  // ─── Game state ────────────────────────────────────────────────
  let state = "idle"; // idle | playing | paused | over | won | transition
  let level = 1;
  let score = 0;
  let lives = 3;
  let obsBeaten = 0;
  let obsNeeded = 10;
  let gemsCollected = 0;
  let gemsTotal = 0;
  let gemLog = {}; // { gemId: count }
  let devMode = false;
  let startTime = 0;

  // Timers (seconds)
  let immunoTimer = 0;
  let magnetTimer = 0;
  let hitCooldown = 0;
  let speedBoostTimer = 0;

  // Spawn cooldowns
  let obsCD = 1.5,
    colCD = 1.8;

  // Delta time
  let lastTS = 0,
    animId = 0;

  // Parallax offsets
  let bgX = [0, 0, 0];

  // Object pools
  let obstacles = [];
  let collectibles = [];
  let particles = [];
  let scorePoppers = [];

  // ─── Punch ─────────────────────────────────────────────────────
  const P = {
    // Normalised x position (0-1 of canvas width)
    xRatio: 0.15,
    yRatio: 1.0, // 1.0 = ground
    vy: 0,
    jumpCount: 0,
    jumping: false,
    sliding: false,
    slideTimer: 0,
    animTick: 0,
    animFrame: 0,
    // Design-unit geometry (scaled at draw time)
    wRatio: 0.055, // width as fraction of canvas width
    hRatio: 0.18, // height as fraction of canvas height
    grRatio: 0.835, // ground Y as fraction of canvas height
  };

  function pX() {
    return P.xRatio * cw;
  }
  function pGr() {
    return P.grRatio * ch;
  }
  function pW() {
    return P.wRatio * cw;
  }
  function pH() {
    return P.hRatio * ch;
  }
  function pY() {
    return P.yRatio * ch;
  } // bottom of Punch feet

  function resetPunch() {
    P.yRatio = P.grRatio;
    P.vy = 0;
    P.jumpCount = 0;
    P.jumping = false;
    P.sliding = false;
    P.slideTimer = 0;
    P.animTick = 0;
    P.animFrame = 0;
  }

  // ─── Persistence ───────────────────────────────────────────────
  let bestScore = 0,
    bestLevel = 1;

  function loadPersisted() {
    try {
      bestScore = parseInt(localStorage.getItem("pm_best") || "0");
      bestLevel = parseInt(localStorage.getItem("pm_bestlv") || "1");
    } catch {}
  }

  function savePersisted() {
    try {
      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem("pm_best", bestScore);
      }
      if (level > bestLevel) {
        bestLevel = level;
        localStorage.setItem("pm_bestlv", bestLevel);
      }
    } catch {}
  }

  // ─── Tutorial system ───────────────────────────────────────────
  let tutActive = false,
    tutStep = 0,
    tutPaused = false;
  let tutSeen = {
    hearts: false,
    jump: false,
    duck: false,
    double: false,
    gem: false,
  };

  function tutShow(icon, title, body, key) {
    const ovl = document.getElementById("tutorial-overlay");
    if (!ovl) return;
    document.getElementById("tut-icon").textContent = icon;
    document.getElementById("tut-title").textContent = title;
    document.getElementById("tut-body").textContent = body;
    document.getElementById("tut-key").textContent = key;

    const tapEl = document.getElementById("tut-tap");
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (tapEl) tapEl.style.display = isTouch ? "block" : "none";

    ovl.classList.add("visible");
  }

  function tutHide() {
    const ovl = document.getElementById("tutorial-overlay");
    if (ovl) ovl.classList.remove("visible");
    const arr = document.getElementById("tut-arrow");
    if (arr) arr.style.display = "none";
  }

  function tutArrow(x, y) {
    const arr = document.getElementById("tut-arrow");
    if (!arr) return;
    arr.style.display = "block";
    arr.style.left = x + "px";
    arr.style.top = y + "px";
  }

  // ─── Resize — canvas fills full viewport ───────────────────────
  function resize() {
    if (!canvas) return;
    cw = canvas.width = window.innerWidth;
    ch = canvas.height = window.innerHeight;
  }

  // ─── Input ─────────────────────────────────────────────────────
  const keys = {};

  function bindInput() {
    document.addEventListener("keydown", (e) => {
      if (keys[e.code]) return;
      keys[e.code] = true;
      PunchAudio.wake();

      if (state === "playing") {
        if (["Space", "ArrowUp", "KeyW"].includes(e.code)) {
          e.preventDefault();
          doJump();
        }
        if (["ArrowDown", "KeyS"].includes(e.code)) {
          e.preventDefault();
          setSlide(true);
        }
        if (e.code === "ArrowRight") speedBoostTimer = 100;
        if (e.code === "KeyL") toggleDevMode();
      }
      if (["KeyP", "Escape"].includes(e.code)) {
        e.preventDefault();
        if (state === "playing" || state === "paused") togglePause();
      }
    });

    document.addEventListener("keyup", (e) => {
      keys[e.code] = false;
      if (["ArrowDown", "KeyS"].includes(e.code)) setSlide(false);
      if (e.code === "ArrowRight") speedBoostTimer = 0;
    });

    // Touch: swipe on canvas
    let tStartX = 0,
      tStartY = 0,
      tStartT = 0;
    canvas.addEventListener(
      "touchstart",
      (e) => {
        tStartX = e.touches[0].clientX;
        tStartY = e.touches[0].clientY;
        tStartT = Date.now();
        PunchAudio.wake();
      },
      { passive: true },
    );

    canvas.addEventListener(
      "touchend",
      (e) => {
        if (state !== "playing") return;
        const dx = tStartX - e.changedTouches[0].clientX;
        const dy = tStartY - e.changedTouches[0].clientY;
        const dt = Date.now() - tStartT;
        if (Math.abs(dy) > Math.abs(dx)) {
          if (dy > 20) doJump();
          else if (dy < -20) setSlide(true);
        } else if (dx > 35 && dt < 300) {
          speedBoostTimer = 100;
        } else if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
          doJump(); // tap = jump
        }
      },
      { passive: true },
    );
  }

  // ─── Jump / Slide ───────────────────────────────────────────────
  function doJump() {
    if (tutPaused) {
      advanceTutorial();
      return;
    }
    if (state !== "playing") return;
    if (P.jumpCount < 2) {
      P.vy = P.jumpCount === 0 ? PHYSICS.jumpVel : PHYSICS.dJumpVel;
      P.jumping = true;
      P.jumpCount++;
      P.sliding = false;
      spawnParticles(pX() + pW() / 2, pY(), "#ffd166", 6);
      P.jumpCount === 1 ? PunchAudio.sfx.jump() : PunchAudio.sfx.djump();
    }
  }

  function setSlide(active) {
    if (active && !P.sliding && !P.jumping) {
      PunchAudio.sfx.slide();
    }
    P.sliding = active;
    if (active) P.slideTimer = 0.4;
    else P.slideTimer = 0;
  }

  // ─── Dev mode ───────────────────────────────────────────────────
  function toggleDevMode() {
    devMode = !devMode;
    const badge = document.getElementById("dev-badge");
    if (badge) badge.classList.toggle("visible", devMode);
    PunchAudio.sfx.rare();
  }

  // ─── Tutorial advance ───────────────────────────────────────────
  function advanceTutorial() {
    tutPaused = false;
    tutHide();
    // Resume if was paused
    if (state === "paused") resumeGame();
  }

  // ─── Screen management ──────────────────────────────────────────
  function showScr(id) {
    document
      .querySelectorAll(".scr")
      .forEach((s) => s.classList.remove("active"));
    if (id) {
      const el = document.getElementById(id);
      if (el) el.classList.add("active");
    }
  }

  function showHUD(v) {
    const hud = document.getElementById("hud");
    const mob = document.getElementById("mob-ctrl");
    if (hud) hud.classList.toggle("visible", v);

    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (mob) mob.classList.toggle("visible", v && isTouch);
  }

  // ─── Update HUD ─────────────────────────────────────────────────
  function updateHUD() {
    let hearts = "";
    for (let i = 0; i < lives; i++) hearts += "❤️";
    for (let i = lives; i < 3; i++) hearts += "🖤";
    const he = document.getElementById("hud-hearts");
    if (he) he.textContent = hearts || "💀";

    const progress = Math.min((obsBeaten / obsNeeded) * 100, 100);
    document
      .getElementById("hud-level")
      ?.setAttribute("textContent", "LVL " + level);
    const lv = document.getElementById("hud-level");
    if (lv) lv.textContent = "LVL " + level;
    const pr = document.getElementById("hud-prog");
    if (pr) pr.style.width = progress + "%";
    const sc = document.getElementById("hud-score");
    if (sc) sc.textContent = score.toLocaleString();
    const gm = document.getElementById("hud-gems");
    if (gm) gm.textContent = "💎 " + gemsCollected;

    const imm = document.getElementById("immuno-badge");
    if (imm) imm.style.display = immunoTimer > 0 ? "block" : "none";
    const mag = document.getElementById("magnet-badge");
    if (mag) mag.style.display = magnetTimer > 0 ? "block" : "none";
  }

  // ─── Spawn logic ───────────────────────────────────────────────

  function getVillainPool() {
    const maxTier =
      level <= 2 ? 1 : level <= 4 ? 2 : level <= 6 ? 3 : level <= 8 ? 4 : 5;
    return VILLAINS.filter((v) => v.tier <= maxTier);
  }

  function spawnObstacle() {
    const pool = getVillainPool();
    const v = pool[Math.floor(Math.random() * pool.length)];
    const isFloat = FLOAT_IDS.has(v.id);

    // Scale hitbox relative to canvas height
    const scaleH = ch / DS_H;
    const h = v.h * scaleH;
    const w = v.w * scaleH;

    const ob = {
      villain: v,
      type: v.id,
      x: cw + w,
      y: isFloat ? pGr() - ch * 0.34 : pGr(),
      baseY: isFloat ? pGr() - ch * 0.34 : pGr(),
      bobAmp: isFloat ? ch * 0.04 : 0, // bobbing amplitude
      bobFreq: 2 + Math.random() * 1.5,
      w,
      h,
      animT: 0,
      wobble: 0,
      passed: false,
    };

    obstacles.push(ob);

    // Twin Trap: spawn a buddy 100px behind
    if (v.id === "twintrap") {
      const buddy = VILLAINS.find((x) => x.id === "jumper");
      obstacles.push({
        ...ob,
        villain: buddy,
        type: "jumper",
        x: cw + w + cw * 0.12,
        passed: false,
        bobAmp: 0,
      });
    }
  }

  function spawnGem() {
    let r = Math.random(),
      cum = 0,
      gem = GEMS[0];
    for (const g of GEMS) {
      cum += g.rarity;
      if (r < cum) {
        gem = g;
        break;
      }
    }
    gemsTotal++;
    collectibles.push({
      x: cw + 20,
      y: pGr() - ch * 0.15 - Math.random() * ch * 0.28,
      r: ch * 0.04,
      gem,
      collected: false,
      bobOffset: Math.random() * Math.PI * 2,
    });
  }

  // ─── Particles ─────────────────────────────────────────────────
  function spawnParticles(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 200,
        vy: -Math.random() * 220 - 40,
        life: 0.5 + Math.random() * 0.4,
        maxL: 0.9,
        color,
        r: 2 + Math.random() * 4,
      });
    }
  }

  function spawnScorePop(x, y, text, color) {
    const el = document.createElement("div");
    el.className = "score-pop";
    el.textContent = text;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.color = color || "#ffd166";
    document.getElementById("game-wrap")?.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  // ─── Gem collection ────────────────────────────────────────────
  function collectGem(c) {
    gemsCollected++;
    if (!gemLog[c.gem.id]) gemLog[c.gem.id] = 0;
    gemLog[c.gem.id]++;
    score += c.gem.pts;

    spawnParticles(c.x, c.y, c.gem.color, 14);
    spawnScorePop(
      c.x,
      c.y - 20,
      c.gem.pts > 0 ? "+" + c.gem.pts : c.gem.name,
      c.gem.color,
    );

    switch (c.gem.effect) {
      case "life":
        if (lives < 7) lives++;
        PunchAudio.sfx.gem();
        showGemBanner("❤️ +1 HEART!", c.gem.color);
        break;
      case "immuno":
        immunoTimer = 5;
        PunchAudio.sfx.immuno();
        showGemBanner("🔮 IMMUNITY! 5 SECONDS!", c.gem.color);
        break;
      case "magnet":
        magnetTimer = 8; // 8 seconds, pulls from far right
        PunchAudio.sfx.magnet();
        showGemBanner("🧲 MAGNET! Pulling all gems!", c.gem.color);
        break;
      default:
        if (c.gem.rarity < 0.05) {
          PunchAudio.sfx.rare();
          showGemBanner(
            c.gem.emoji + " " + c.gem.name + "! +" + c.gem.pts,
            c.gem.color,
          );
        } else {
          PunchAudio.sfx.gem();
        }
    }
    updateHUD();
  }

  function showGemBanner(text, color) {
    const el = document.getElementById("gem-banner");
    if (!el) return;
    el.textContent = text;
    el.style.background = color
      ? `linear-gradient(135deg, ${color}, ${color}bb)`
      : "linear-gradient(135deg,#ffd166,#ff9f1c)";
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
  }

  // ─── Damage ────────────────────────────────────────────────────
  function takeDamage(villain) {
    // Dev mode: show hit animation but don't decrease lives
    if (hitCooldown > 0) return;
    hitCooldown = 1.2;
    spawnParticles(pX() + pW() / 2, pY() - pH() / 2, "#ff4d6d", 22);
    PunchAudio.sfx.hit();

    if (devMode) return; // No life loss in dev mode
    if (immunoTimer > 0) return;

    lives--;
    updateHUD();
    if (lives <= 0) gameOver(villain);
  }

  // ─── Level complete ────────────────────────────────────────────
  function levelComplete() {
    state = "transition";
    PunchAudio.stopMusic();
    savePersisted();
    if (level >= 10) {
      triggerWin();
      return;
    }
    PunchAudio.sfx.lvlUp();
    setTimeout(() => initLevel(level + 1), 500);
  }

  // ─── Init level ────────────────────────────────────────────────
  function initLevel(lv) {
    level = lv;
    obsBeaten = 0;
    obsNeeded = LEVELS[lv - 1].obsCount;
    obstacles = [];
    collectibles = [];
    particles = [];
    scorePoppers = [];
    obsCD = 1.4;
    colCD = 1.8;
    bgX = [0, 0, 0];
    immunoTimer = 0;
    magnetTimer = 0;
    hitCooldown = 0;
    speedBoostTimer = 0;
    resetPunch();

    tutActive = lv === 1;
    tutStep = 0;
    tutPaused = false;
    tutSeen = {
      hearts: false,
      jump: false,
      duck: false,
      double: false,
      gem: false,
    };
    tutHide();

    updateHUD();
    showHUD(true);

    const lc = LEVELS[lv - 1];
    const toast = document.getElementById("level-toast");
    if (toast) {
      document.getElementById("toast-lvl").textContent = "LEVEL " + lv;
      document.getElementById("toast-name").textContent =
        lc.emoji + " " + lc.name;
      document.getElementById("toast-desc").textContent = lc.desc;
      const ml = document.getElementById("toast-music");
      if (ml) ml.textContent = MUSIC_LABELS[lc.music] || "";
      toast.style.display = "block";
    }

    PunchAudio.sfx.lvlUp();

    setTimeout(() => {
      if (toast) toast.style.display = "none";
      PunchAudio.stopMusic();
      PunchAudio.startMusic(lc.music);
      state = "playing";
      showScr(null); // clear any screen overlays

      // Level 1 tutorial kick-off
      if (lv === 1) {
        setTimeout(() => {
          if (!tutSeen.hearts) {
            tutSeen.hearts = true;
            tutShow(
              "❤️",
              "3 Hearts — 3 Chances",
              "You have 3 hearts. Lose them all and it's game over. Collect ❤️ gems to gain more!",
              "Tap or press any key to continue",
            );
            tutPaused = false; // Don't freeze game, just info
            setTimeout(() => tutHide(), 4000);
          }
        }, 600);
      }

      lastTS = performance.now();
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(loop);
    }, 2200);
  }

  // ─── Game Over ────────────────────────────────────────────────
  function gameOver(villain) {
    state = "over";
    cancelAnimationFrame(animId);
    PunchAudio.stopMusic();
    savePersisted();
    PunchAudio.sfx.death();
    setTimeout(() => PunchAudio.startMusic("end"), 500);
    tutHide();

    const fail = FAILS[Math.floor(Math.random() * FAILS.length)];
    document.getElementById("fail-title").textContent = fail.title;
    document.getElementById("fail-title").style.color = fail.col;
    document.getElementById("fail-msg").textContent = villain
      ? `Taken out by ${villain.name}. ${fail.msg}`
      : fail.msg;

    document.getElementById("go-score").textContent = score.toLocaleString();
    document.getElementById("go-level").textContent = level;
    document.getElementById("go-best").textContent = bestScore.toLocaleString();
    document.getElementById("go-maxlv").textContent = bestLevel;

    const gemsStr =
      Object.entries(gemLog)
        .map(([id, n]) => {
          const g = GEMS.find((x) => x.id === id);
          return g ? `${g.emoji}×${n}` : "";
        })
        .filter(Boolean)
        .join("  ") || "none";
    document.getElementById("go-gems-info").textContent =
      `Gems: ${gemsCollected}/${gemsTotal} — ${gemsStr}`;

    const canCont = lives > 0;
    document.getElementById("cont-btn").style.display = canCont ? "" : "none";
    document.getElementById("continue-info").textContent = canCont
      ? `${lives} ❤️ left — continue from Level ${level}`
      : "No hearts left — start fresh!";

    showHUD(false);
    showScr("scr-over");
  }

  function continueRun() {
    if (lives <= 0) {
      restart();
      return;
    }
    obstacles = [];
    collectibles = [];
    particles = [];
    obsBeaten = 0;
    hitCooldown = 0;
    resetPunch();
    showHUD(true);
    showScr(null);
    initLevel(level);
  }

  function restart() {
    cleanUp();
    init();
  }

  function cleanUp() {
    cancelAnimationFrame(animId);
    PunchAudio.stopMusic();
    tutHide();
    state = "idle";
  }

  // ─── Win ───────────────────────────────────────────────────────
  function triggerWin() {
    state = "won";
    cancelAnimationFrame(animId);
    PunchAudio.stopMusic();
    savePersisted();
    PunchAudio.sfx.win();
    setTimeout(() => PunchAudio.startMusic("end"), 500);
    tutHide();

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    document.getElementById("win-score").textContent = score.toLocaleString();
    document.getElementById("win-time").textContent = elapsed + "s";
    document.getElementById("win-gems").textContent = gemsCollected;

    showHUD(false);
    showScr("scr-win");
    setTimeout(() => renderWinScene(), 100);
  }

  // ─── Pause / Resume ────────────────────────────────────────────
  let resumeInProgress = false;

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      cancelAnimationFrame(animId);
      PunchAudio.stopMusic();
      document.getElementById("scr-pause")?.classList.add("active");
      document.getElementById("countdown").style.display = "none";
      document.getElementById("hud-pause").textContent = "▶";
    } else if (state === "paused") {
      resumeGame();
    }
  }

  function autoPause() {
    if (state === "playing") togglePause();
  }

  function resumeGame() {
    if (resumeInProgress || state !== "paused") return;
    resumeInProgress = true;

    const cd = document.getElementById("countdown");
    cd.style.display = "block";
    cd.textContent = "3";
    PunchAudio.sfx.countdown();
    let n = 3;

    const iv = setInterval(() => {
      n--;
      if (n > 0) {
        cd.textContent = n;
        PunchAudio.sfx.countdown();
      } else {
        clearInterval(iv);
        cd.textContent = "GO!";
        PunchAudio.sfx.go();
        setTimeout(() => {
          cd.style.display = "none";
          document.getElementById("scr-pause").classList.remove("active");
          document.getElementById("hud-pause").textContent = "⏸";
          state = "playing";
          resumeInProgress = false;
          PunchAudio.startMusic(LEVELS[level - 1].music);
          lastTS = performance.now();
          animId = requestAnimationFrame(loop);
        }, 400);
      }
    }, 800);
  }

  // ─── Share ──────────────────────────────────────────────────────
  function share(ctx2) {
    const url = "https://punch-monkey.vercel.app";
    const text =
      ctx2 === "win"
        ? `🧸 I BEAT PUNCH'S GREAT ESCAPE!\nAll 10 levels, ${score.toLocaleString()} pts, ${gemsCollected} gems!\n#PunchMonkey #PunchEscape\n${url}`
        : `🐒 Playing Punch's Great Escape!\nLevel ${level}, ${score.toLocaleString()} pts — beat me!\n#PunchMonkey\n${url}`;
    if (navigator.share) {
      navigator.share({ title: "Punch's Great Escape", text }).catch(() => {});
    } else {
      try {
        navigator.clipboard.writeText(text);
        alert("Copied! Go paste it 🐒\n\n" + text);
      } catch {
        alert(text);
      }
    }
  }

  // ─── UPDATE (delta-time) ────────────────────────────────────────
  function update(dt) {
    dt = Math.min(dt, 0.05); // cap to avoid spiral-of-death after tab switch

    const lc = LEVELS[level - 1];
    const spd =
      PHYSICS.baseSpeed *
      (cw / DS_W) *
      lc.speedMult *
      (speedBoostTimer > 0 ? 1.4 : 1);

    // Timers
    if (hitCooldown > 0) hitCooldown -= dt;
    if (immunoTimer > 0) {
      immunoTimer -= dt;
      if (immunoTimer <= 0) {
        immunoTimer = 0;
        PunchAudio.sfx.hit();
      }
    }
    if (magnetTimer > 0) {
      magnetTimer -= dt;
      if (magnetTimer <= 0) magnetTimer = 0;
    }
    if (speedBoostTimer > 0) speedBoostTimer -= dt;

    // Score drip
    score += Math.floor(spd * dt * 0.38 + level * dt * 0.4);

    // Parallax
    bgX[0] = (bgX[0] + spd * 0.18 * dt) % (cw * 1.5);
    bgX[1] = (bgX[1] + spd * 0.45 * dt) % cw;
    bgX[2] = (bgX[2] + spd * 0.84 * dt) % cw;

    // Punch physics
    if (P.sliding) {
      P.slideTimer -= dt;
      if (P.slideTimer <= 0) P.sliding = false;
    }
    // Convert velocity from design-units/s → canvas/s
    const scaleH = ch / DS_H;
    P.vy += PHYSICS.gravity * scaleH * dt;
    const newY = pY() + P.vy * dt;
    const gr = pGr();

    if (newY >= gr) {
      P.yRatio = P.grRatio;
      P.vy = 0;
      P.jumping = false;
      P.jumpCount = 0;
    } else {
      P.yRatio = newY / ch;
    }

    P.animTick += dt;
    if (P.animTick > 0.1) {
      P.animTick = 0;
      P.animFrame = (P.animFrame + 1) % 4;
    }

    // Spawn obstacles
    obsCD -= dt;
    if (obsCD <= 0 && obstacles.length < 8) {
      spawnObstacle();

      // Tutorial hints
      if (tutActive && state === "playing") {
        const last = obstacles[obstacles.length - 1];
        if (
          !tutSeen.jump &&
          last &&
          last.villain.action === "JUMP" &&
          obsBeaten >= 1
        ) {
          tutSeen.jump = true;
          tutShow(
            "⬆️",
            "Jump Over!",
            "Knuckles is coming! Press SPACE or ↑ to jump. Tap SPACE TWICE for a double jump — clears taller obstacles!",
            "SPACE / ↑ / W  —  double-tap for double jump!",
          );
        }
        if (
          !tutSeen.duck &&
          last &&
          (last.villain.id === "vine" || last.villain.id === "swinger") &&
          obsBeaten >= 3
        ) {
          tutSeen.duck = true;
          tutShow(
            "⬇️",
            "Duck Under!",
            "That bamboo vine is hanging LOW — you MUST duck! Press ↓ or swipe down.",
            "↓ / S  or  Swipe Down",
          );
        }
        if (!tutSeen.double && obsBeaten >= 5) {
          tutSeen.double = true;
          tutShow(
            "⬆️⬆️",
            "Double Jump!",
            "Some obstacles are TALL. Press SPACE twice (or tap twice) before landing for a double jump!",
            "SPACE SPACE  —  tap twice fast!",
          );
          setTimeout(() => tutHide(), 4000);
        }
      }

      const prog = obsBeaten / obsNeeded;
      const minGap = Math.max(0.45, 1.1 - level * 0.06 - prog * 0.35);
      const maxGap = Math.max(0.85, 1.9 - level * 0.07 - prog * 0.4);
      obsCD = minGap + Math.random() * (maxGap - minGap);
    }

    // Spawn gems
    colCD -= dt;
    if (colCD <= 0) {
      spawnGem();
      if (tutActive && !tutSeen.gem && collectibles.length >= 2) {
        tutSeen.gem = true;
        tutShow(
          "💎",
          "Collect Gems!",
          "Gems give you points & powers! ❤️ = extra heart. 🔮 = 5s immunity. 🧲 = magnet pulls ALL gems to you!",
          "Run into them to collect",
        );
        setTimeout(() => tutHide(), 4500);
      }
      colCD = 0.85 + Math.random() * 0.9;
    }

    // Move + hit obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= spd * dt;
      o.animT += dt;
      o.wobble = Math.sin(o.animT * 5.5) * 0.07;

      // Floating bob (vines, rocks, boulders)
      if (o.bobAmp > 0) {
        o.y = o.baseY + Math.sin(o.animT * o.bobFreq) * o.bobAmp;
      }

      // Tutorial arrow pointing at first incoming obstacle
      if (
        tutActive &&
        !o.passed &&
        i === 0 &&
        o.x < cw * 0.75 &&
        o.x > pX() + pW()
      ) {
        const arrowX = o.x - 18;
        const arrowY = Math.max(60, o.y - o.h - ch * 0.12);
        tutArrow(arrowX, arrowY);
      }

      // Passed player
      if (!o.passed && o.x + o.w < pX()) {
        o.passed = true;
        obsBeaten++;
        score += 10 + level * 2;
        PunchAudio.sfx.mkPass();
        updateHUD();
        if (obsBeaten >= obsNeeded) {
          levelComplete();
          return;
        }
      }

      // AABB collision
      if (hitCooldown <= 0) {
        const px1 = pX() + pW() * 0.15,
          pw1 = pW() * 0.7;
        const py1 = P.sliding ? pY() - pH() * 0.5 : pY() - pH();
        const ph1 = P.sliding ? pH() * 0.5 : pH();
        const mx = o.w * 0.1;

        let ox, ow, oy, oh;
        if (o.type === "vine" || o.type === "swinger") {
          // Only the lower part of vines hurts (the rope/leaf zone)
          ox = o.x + 2;
          ow = o.w - 4;
          oy = o.y;
          oh = o.h * 0.25;
        } else {
          ox = o.x + mx;
          ow = o.w - mx * 2;
          oy = o.y - o.h;
          oh = o.h;
        }

        if (
          immunoTimer <= 0 &&
          px1 < ox + ow &&
          px1 + pw1 > ox &&
          py1 < oy + oh &&
          py1 + ph1 > oy
        ) {
          takeDamage(o.villain);
        }
      }

      if (o.x < -o.w * 2) obstacles.splice(i, 1);
    }

    // Move + collect gems
    for (let i = collectibles.length - 1; i >= 0; i--) {
      const c = collectibles[i];
      c.x -= spd * dt;

      // Magnet: pull from FAR side of screen
      if (magnetTimer > 0) {
        const pdx = pX() + pW() / 2 - c.x;
        const pdy = pY() - pH() / 2 - c.y;
        const d = Math.hypot(pdx, pdy);
        // Pull anything on screen, with force proportional to magnet remaining
        const pullStrength = 10 + (8 - magnetTimer) * 1.5;
        c.x += pdx * pullStrength * dt;
        c.y += pdy * pullStrength * dt;
      }

      if (!c.collected) {
        const dx = pX() + pW() / 2 - c.x;
        const dy = pY() - pH() * 0.5 - c.y;
        if (Math.hypot(dx, dy) < c.r + pW() * 0.45) {
          c.collected = true;
          collectGem(c);
        }
      }
      if (c.x < -50) collectibles.splice(i, 1);
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    updateHUD();
  }

  // ─── RENDER ────────────────────────────────────────────────────

  /** Background colour themes */
  const BG = {
    zoo: {
      top: "#12263a",
      mid: "#0d1f2d",
      gnd: "#4a3a1a",
      gnd2: "#2a1a0a",
      acc: "#8b5e3c",
    },
    bamboo: {
      top: "#0a2016",
      mid: "#071510",
      gnd: "#2a4a1a",
      gnd2: "#1a2a0a",
      acc: "#4a7a3a",
    },
    river: {
      top: "#0a1428",
      mid: "#07101a",
      gnd: "#1a3a4a",
      gnd2: "#0a1a2a",
      acc: "#3a6a8a",
    },
    ruins: {
      top: "#1c1208",
      mid: "#140d05",
      gnd: "#3a2a1a",
      gnd2: "#1a140a",
      acc: "#7a6a4a",
    },
    mushroom: {
      top: "#1a0a1a",
      mid: "#120812",
      gnd: "#3a1a3a",
      gnd2: "#1a0a1a",
      acc: "#8a3a8a",
    },
    cave: {
      top: "#06060e",
      mid: "#04040c",
      gnd: "#1a1a2a",
      gnd2: "#0a0a14",
      acc: "#3a3a6a",
    },
    volcano: {
      top: "#200800",
      mid: "#180500",
      gnd: "#3a1a0a",
      gnd2: "#1a0a05",
      acc: "#ff5500",
    },
    moon: {
      top: "#08082a",
      mid: "#05051a",
      gnd: "#1a1a3a",
      gnd2: "#0a0a1a",
      acc: "#5a5a9a",
    },
    storm: {
      top: "#060608",
      mid: "#040406",
      gnd: "#1a1a0a",
      gnd2: "#0a0a05",
      acc: "#aaaa00",
    },
    final: {
      top: "#12062a",
      mid: "#0a0420",
      gnd: "#2d1b60",
      gnd2: "#1a0a3e",
      acc: "#ff6b35",
    },
  };

  function drawBg() {
    const lc = LEVELS[level - 1];
    const b = BG[lc.bg] || BG.zoo;
    const t = Date.now() * 0.001;

    // Sky
    const g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, b.top);
    g.addColorStop(0.7, b.mid);
    g.addColorStop(1, b.gnd);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);

    // Stars (permanent dots, not emojis)
    ctx.fillStyle = "rgba(255,255,255,.5)";
    for (let i = 0; i < 28; i++) {
      const sx = (i * 137 + level * 23) % cw;
      const sy = (i * 79 + 17) % (ch * 0.55);
      const sr = i % 4 === 0 ? 1.5 : 0.8;
      const al = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.5 + i * 0.8));
      ctx.globalAlpha = al;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Moon (dark levels)
    if (["cave", "moon", "storm", "final"].includes(lc.bg)) {
      const moonX = cw * 0.84,
        moonY = ch * 0.13;
      ctx.save();
      ctx.shadowColor = "#ffd16655";
      ctx.shadowBlur = ch * 0.06;
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(moonX, moonY, ch * 0.072, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Level atmosphere
    drawAtmosphere(lc.bg, b, t);

    // Far tree/rock layer (slow parallax)
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 8; i++) {
      const tx =
        (((i / 8) * cw * 1.4 + bgX[0] * 0.38) % (cw * 1.5)) - cw * 0.06;
      const th = ch * (0.38 + (i % 3) * 0.07);
      drawBgPiece(tx, pGr(), th, lc.bg, b);
    }
    // Near tree/rock layer (fast parallax)
    ctx.fillStyle = "rgba(0,0,0,.5)";
    for (let i = 0; i < 5; i++) {
      const tx =
        (((i / 5) * cw * 1.2 + bgX[1] * 0.68) % (cw * 1.2)) - cw * 0.06;
      const th = ch * (0.22 + (i % 2) * 0.06);
      drawBgPiece(tx, pGr(), th, lc.bg, b);
    }
    ctx.globalAlpha = 1;

    // Ground
    const gg = ctx.createLinearGradient(0, pGr(), 0, ch);
    gg.addColorStop(0, b.gnd);
    gg.addColorStop(1, b.gnd2);
    ctx.fillStyle = gg;
    ctx.fillRect(0, pGr(), cw, ch - pGr());

    // Ground accent line
    ctx.strokeStyle = b.acc;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, pGr());
    ctx.lineTo(cw, pGr());
    ctx.stroke();

    // Ground running marks
    ctx.strokeStyle = b.acc + "44";
    ctx.lineWidth = 1;
    const mk = cw * 0.1;
    const off = bgX[2] % mk;
    for (let x = -off; x < cw + mk; x += mk) {
      ctx.beginPath();
      ctx.moveTo(x, pGr() + ch * 0.025);
      ctx.lineTo(x + mk * 0.28, pGr() + ch * 0.025);
      ctx.stroke();
    }

    // Level name watermark
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = "white";
    ctx.font = `bold ${ch * 0.1}px Boogaloo`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(lc.emoji + " " + lc.name.toUpperCase(), cw / 2, ch * 0.52);
    ctx.globalAlpha = 1;
    ctx.textBaseline = "alphabetic";
  }

  function drawAtmosphere(bg, b, t) {
    if (bg === "bamboo") {
      // Visible bamboo stalks that sway — player must DUCK under the low ones
      ctx.strokeStyle = "rgba(60,140,50,.55)";
      ctx.lineWidth = cw * 0.006;
      for (let i = 0; i < 7; i++) {
        const bx = (((i / 7) * cw * 1.1 + bgX[0] * 0.22) % (cw * 1.1)) - 20;
        const sway = Math.sin(t * 0.9 + i * 1.3) * ch * 0.012;
        ctx.beginPath();
        ctx.moveTo(bx + sway, 0);
        ctx.quadraticCurveTo(bx + sway * 2, ch * 0.3, bx, pGr());
        ctx.stroke();
        // Bamboo leaves
        ctx.strokeStyle = "rgba(80,160,60,.35)";
        ctx.lineWidth = cw * 0.003;
        for (let j = 0; j < 3; j++) {
          const ly = ch * (0.2 + j * 0.18);
          ctx.beginPath();
          ctx.moveTo(bx + sway, ly);
          ctx.lineTo(bx + sway + cw * 0.04, ly - ch * 0.04);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(bx + sway, ly);
          ctx.lineTo(bx + sway - cw * 0.04, ly - ch * 0.03);
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(60,140,50,.55)";
        ctx.lineWidth = cw * 0.006;
      }
    }

    if (bg === "volcano") {
      // Lava glow at ground
      const lg = ctx.createLinearGradient(0, pGr() - ch * 0.15, 0, pGr());
      lg.addColorStop(0, "transparent");
      lg.addColorStop(1, "rgba(255,50,0,.14)");
      ctx.fillStyle = lg;
      ctx.fillRect(0, pGr() - ch * 0.15, cw, ch * 0.15);
      // Fire particles at ground level
      ctx.fillStyle = "rgba(255,80,0,.15)";
      for (let i = 0; i < 6; i++) {
        const fx = ((i / 6) * cw + bgX[2] * 0.4) % cw;
        const fy = pGr() - Math.abs(Math.sin(t * 3 + i)) * ch * 0.08;
        ctx.beginPath();
        ctx.ellipse(fx, fy, cw * 0.015, ch * 0.04, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (bg === "storm") {
      // Lightning flicker
      if (Math.floor(t * 3) % 17 === 0) {
        ctx.fillStyle = "rgba(220,220,50,.07)";
        ctx.fillRect(0, 0, cw, ch);
      }
    }

    if (bg === "final") {
      // Warm glow near end
      const fg = ctx.createRadialGradient(
        cw * 0.5,
        pGr(),
        0,
        cw * 0.5,
        pGr(),
        cw * 0.4,
      );
      fg.addColorStop(0, "rgba(255,77,109,.12)");
      fg.addColorStop(1, "transparent");
      ctx.fillStyle = fg;
      ctx.fillRect(0, ch * 0.3, cw, ch * 0.7);
    }
  }

  function drawBgPiece(x, baseY, h, bg, b) {
    if (bg === "ruins" || bg === "cave") {
      ctx.fillRect(x - cw * 0.008, baseY - h, cw * 0.016, h);
      ctx.fillRect(x - cw * 0.018, baseY - h, cw * 0.036, h * 0.07);
    } else {
      ctx.fillRect(x - cw * 0.005, baseY - h * 0.42, cw * 0.01, h * 0.42);
      ctx.beginPath();
      ctx.arc(x, baseY - h * 0.5, h * 0.33, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPunch() {
    const x = pX();
    const y = pY(); // foot position
    const w = pW();
    const h = pH();
    const cx = x + w / 2;
    const bob = P.jumping ? 0 : Math.sin(Date.now() * 0.004) * (ch * 0.006);
    const flash = hitCooldown > 0 && Math.floor(Date.now() / 75) % 2 === 0;
    const immG = immunoTimer > 0;
    const t = Date.now() * 0.001;

    ctx.save();
    ctx.translate(cx, y + bob);
    if (P.sliding) ctx.scale(1, 0.55);
    if (flash) ctx.globalAlpha = 0.3;

    if (immG) {
      ctx.shadowColor = "#c084fc";
      ctx.shadowBlur = w * 0.7;
    }

    // Shadow on ground
    ctx.globalAlpha = flash ? 0.05 : immG ? 0.45 : 0.2;
    ctx.fillStyle = immG ? "#c084fc" : "#000";
    ctx.beginPath();
    ctx.ellipse(0, 4, w * 0.56, h * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = flash ? 0.3 : 1;

    const bc = immG ? "#d8a0ff" : "#c47a2e";
    const fc = immG ? "#f0d0ff" : "#e8a96a";

    const bw = w * 0.82,
      bh = h * 0.62,
      br = bw * 0.25;
    const hcx = 0,
      hcy = -h * 0.76,
      hr = w * 0.44;

    // Body
    ctx.fillStyle = bc;
    ctx.beginPath();
    ctx.roundRect(-bw / 2, -h, bw, bh, br);
    ctx.fill();

    // Belly
    ctx.fillStyle = fc;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.64, bw * 0.36, bh * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = bc;
    ctx.beginPath();
    ctx.arc(hcx, hcy, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fc;
    ctx.beginPath();
    ctx.ellipse(hcx, hcy + hr * 0.22, hr * 0.78, hr * 0.74, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes — big and alive
    const er = hr * 0.26;
    ctx.fillStyle = "#1a0a2e";
    ctx.beginPath();
    ctx.arc(hcx - hr * 0.34, hcy - hr * 0.12, er, 0, Math.PI * 2);
    ctx.arc(hcx + hr * 0.34, hcy - hr * 0.12, er, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a1e80"; // iris
    ctx.beginPath();
    ctx.arc(hcx - hr * 0.34, hcy - hr * 0.12, er * 0.72, 0, Math.PI * 2);
    ctx.arc(hcx + hr * 0.34, hcy - hr * 0.12, er * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "white"; // shine
    ctx.beginPath();
    ctx.arc(hcx - hr * 0.27, hcy - hr * 0.18, er * 0.36, 0, Math.PI * 2);
    ctx.arc(hcx + hr * 0.41, hcy - hr * 0.18, er * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.5)"; // second sparkle
    ctx.beginPath();
    ctx.arc(hcx - hr * 0.22, hcy - hr * 0.22, er * 0.18, 0, Math.PI * 2);
    ctx.arc(hcx + hr * 0.46, hcy - hr * 0.22, er * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Eyebrows (expressive)
    const emo = P.jumping ? -0.4 : -0; // raise brows on jump
    ctx.strokeStyle = "#1a0a2e";
    ctx.lineWidth = hr * 0.14;
    ctx.beginPath();
    ctx.moveTo(hcx - hr * 0.62, hcy - hr * 0.38 + emo);
    ctx.lineTo(hcx - hr * 0.08, hcy - hr * 0.28 + emo);
    ctx.moveTo(hcx + hr * 0.08, hcy - hr * 0.28 + emo);
    ctx.lineTo(hcx + hr * 0.62, hcy - hr * 0.38 + emo);
    ctx.stroke();

    // Ears
    ctx.fillStyle = bc;
    ctx.beginPath();
    ctx.arc(hcx - hr * 0.9, hcy - hr * 0.24, hr * 0.38, 0, Math.PI * 2);
    ctx.arc(hcx + hr * 0.9, hcy - hr * 0.24, hr * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = immG ? "#f5e0ff" : "#e8c09a";
    ctx.beginPath();
    ctx.arc(hcx - hr * 0.9, hcy - hr * 0.24, hr * 0.22, 0, Math.PI * 2);
    ctx.arc(hcx + hr * 0.9, hcy - hr * 0.24, hr * 0.22, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = "#1a0a2e";
    ctx.lineWidth = hr * 0.12;
    ctx.beginPath();
    ctx.arc(hcx, hcy + hr * 0.44, hr * 0.28, 0.18, Math.PI - 0.18);
    ctx.stroke();

    // Blush
    ctx.fillStyle = "rgba(220,100,40,.38)";
    ctx.beginPath();
    ctx.ellipse(
      hcx - hr * 0.68,
      hcy + hr * 0.04,
      hr * 0.22,
      hr * 0.14,
      0,
      0,
      Math.PI * 2,
    );
    ctx.ellipse(
      hcx + hr * 0.68,
      hcy + hr * 0.04,
      hr * 0.22,
      hr * 0.14,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // Plushie held — always visible with glow
    const px2 = -bw * 0.62;
    const py2 = -h * 0.62;
    const pr2 = w * 0.26;
    ctx.shadowColor = "#ff4d6d";
    ctx.shadowBlur = pr2 * 1.2;
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath();
    ctx.arc(px2, py2, pr2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ff8fa3";
    ctx.beginPath();
    ctx.ellipse(
      px2,
      py2 + pr2 * 0.2,
      pr2 * 0.78,
      pr2 * 0.65,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    // Plushie ears
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath();
    ctx.arc(px2 - pr2 * 0.72, py2 - pr2 * 0.7, pr2 * 0.32, 0, Math.PI * 2);
    ctx.arc(px2 + pr2 * 0.52, py2 - pr2 * 0.74, pr2 * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // Feather tufts float around head when running/jumping
    if (!P.sliding) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = immG ? "#e0c0ff" : "#ffd166";
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + t * 0.9;
        const dist = hr * (1.3 + 0.18 * Math.sin(t * 0.7 + i));
        ctx.beginPath();
        ctx.arc(
          hcx + Math.cos(ang) * dist,
          hcy + Math.sin(ang) * dist * 0.5,
          hr * 0.1,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Running legs
    const legSwing = P.jumping
      ? h * 0.12
      : Math.sin(t * (P.sliding ? 3 : 12)) * h * 0.1;
    ctx.fillStyle = bc;

    ctx.save();
    ctx.translate(-w * 0.18, -h * 0.2);
    ctx.rotate(legSwing * 0.04);
    ctx.beginPath();
    ctx.roundRect(-w * 0.16, 0, w * 0.32, h * 0.26, w * 0.1);
    ctx.fill();
    ctx.fillStyle = "#9a5a1e";
    ctx.beginPath();
    ctx.ellipse(
      0,
      h * 0.28,
      w * 0.22,
      h * 0.07,
      legSwing * 0.02,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = bc;
    ctx.save();
    ctx.translate(w * 0.18, -h * 0.2);
    ctx.rotate(-legSwing * 0.04);
    ctx.beginPath();
    ctx.roundRect(-w * 0.16, 0, w * 0.32, h * 0.26, w * 0.1);
    ctx.fill();
    ctx.fillStyle = "#9a5a1e";
    ctx.beginPath();
    ctx.ellipse(
      0,
      h * 0.28,
      w * 0.22,
      h * 0.07,
      -legSwing * 0.02,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();

    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function drawObstacle(o) {
    ctx.save();
    const v = o.villain;
    const cx = o.x + o.w / 2;
    const bot = o.y; // bottom / ground position
    const t = Date.now() * 0.001;

    ctx.translate(cx, 0);
    ctx.rotate(o.wobble);

    // ── Vine / Swinger ──────────────────────────────────────────
    if (o.type === "vine" || o.type === "swinger") {
      const topY = 0;
      const botY = bot;
      const sway = Math.sin(o.animT * 2.2) * o.w;

      // Rope / vine stem
      ctx.strokeStyle = "#3a7a1a";
      ctx.lineWidth = o.w * 0.55;
      ctx.beginPath();
      ctx.moveTo(sway * 0.3, topY);
      ctx.quadraticCurveTo(sway, botY * 0.5, sway * 0.8, botY);
      ctx.stroke();

      // Bamboo-style segments on the vine
      ctx.strokeStyle = "#2d6014";
      ctx.lineWidth = o.w * 0.45;
      for (let seg = 0; seg < 4; seg++) {
        const sy = (seg / 4) * botY;
        ctx.beginPath();
        ctx.arc(sway * (0.3 + (0.5 * seg) / 4), sy, o.w * 0.45, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Leaf cluster at bottom (the dangerous part — duck under this!)
      ctx.fillStyle = "#2d8a1a";
      ctx.shadowColor = "#00ff0022";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(
        sway * 0.8,
        botY - o.h * 0.06,
        o.w * 1.4,
        o.h * 0.15,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = "#3da03d";
      ctx.beginPath();
      ctx.ellipse(
        sway * 0.8 - o.w * 0.5,
        botY - o.h * 0.08,
        o.w,
        o.h * 0.13,
        -0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(
        sway * 0.8 + o.w * 0.5,
        botY - o.h * 0.08,
        o.w,
        o.h * 0.13,
        0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.shadowBlur = 0;

      // DUCK indicator
      ctx.fillStyle = "rgba(255,255,255,.82)";
      ctx.font = `bold ${o.w * 0.9}px Boogaloo`;
      ctx.textAlign = "center";
      ctx.fillText("DUCK!", 0, botY - o.h * 0.3);

      // ── Rock / Boulder ──────────────────────────────────────────
    } else if (o.type === "rock" || o.type === "boulder") {
      // Boulder floats up and down (bobbing is handled in update via o.y)
      const bounce = Math.abs(Math.sin(o.animT * 4.5)) * o.h * 0.04;
      const squash = 1 + bounce / o.h;
      const ry = bot - o.h + bounce;

      ctx.save();
      ctx.scale(1, squash);
      const rockGrad = ctx.createRadialGradient(
        -o.w * 0.2,
        ry / squash + o.h * 0.2,
        0,
        0,
        (ry + o.h * 0.5) / squash,
        o.w * 0.7,
      );
      rockGrad.addColorStop(0, "#9ca3af");
      rockGrad.addColorStop(1, v.color);
      ctx.fillStyle = rockGrad;
      ctx.shadowColor = "rgba(0,0,0,.4)";
      ctx.shadowBlur = o.w * 0.3;
      ctx.beginPath();
      ctx.roundRect(-o.w / 2, ry / squash, o.w, o.h, o.w * 0.2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Crack lines on rock
      ctx.strokeStyle = "rgba(0,0,0,.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-o.w * 0.1, ry / squash + o.h * 0.2);
      ctx.lineTo(o.w * 0.2, ry / squash + o.h * 0.6);
      ctx.moveTo(-o.w * 0.3, ry / squash + o.h * 0.5);
      ctx.lineTo(-o.w * 0.05, ry / squash + o.h * 0.8);
      ctx.stroke();
      // Angry eyes on rock
      ctx.fillStyle = "#1a0a2e";
      ctx.beginPath();
      ctx.arc(-o.w * 0.2, ry / squash + o.h * 0.3, o.w * 0.1, 0, Math.PI * 2);
      ctx.arc(o.w * 0.2, ry / squash + o.h * 0.3, o.w * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,.82)";
      ctx.font = `bold ${o.w * 0.7}px Boogaloo`;
      ctx.textAlign = "center";
      ctx.fillText("JUMP!", 0, ry - o.w * 0.3);

      // ── Banana Peel ────────────────────────────────────────────
    } else if (o.type === "peel") {
      const py3 = bot - o.h;
      ctx.fillStyle = "#fdd835";
      ctx.beginPath();
      ctx.ellipse(
        0,
        py3 + o.h * 0.5,
        o.w * 0.52,
        o.h * 0.4,
        0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.strokeStyle = "#e6b800";
      ctx.lineWidth = 2;
      [-1, 0, 1].forEach((dx) => {
        ctx.beginPath();
        ctx.moveTo(dx * o.w * 0.25, py3 + o.h * 0.5);
        ctx.quadraticCurveTo(
          dx * o.w * 0.48,
          py3,
          dx * o.w * 0.18,
          py3 - o.h * 0.15,
        );
        ctx.stroke();
      });
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.font = `${o.w * 0.7}px serif`;
      ctx.textAlign = "center";
      ctx.fillText("🍌", 0, py3 - o.h * 0.2);

      // ── Spike ──────────────────────────────────────────────────
    } else if (o.type === "spike") {
      const count = 3;
      for (let s = 0; s < count; s++) {
        const sx = (s - (count - 1) / 2) * o.w * 0.42;
        ctx.fillStyle = s % 2 === 0 ? "#ef4444" : "#ff7777";
        ctx.shadowColor = "#ff0000";
        ctx.shadowBlur = o.w * 0.3;
        ctx.beginPath();
        ctx.moveTo(sx, bot);
        ctx.lineTo(sx - o.w * 0.2, bot - o.h);
        ctx.lineTo(sx + o.w * 0.2, bot - o.h);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = "rgba(255,255,255,.82)";
      ctx.font = `bold ${o.w * 0.8}px Boogaloo`;
      ctx.textAlign = "center";
      ctx.fillText("HIGH!", 0, bot - o.h - o.w * 0.4);

      // ── Default Monkey ─────────────────────────────────────────
    } else {
      const mh = o.h,
        mw = o.w;
      const bob2 = Math.sin(o.animT * 5) * mh * 0.06;
      const gy = bot - mh + bob2;
      const isSlide = o.type === "slider";
      const isBig = o.type === "bigbobo";
      const sc = isBig ? 1.3 : 1;

      ctx.save();
      if (isSlide) {
        ctx.scale(1, 0.68);
      }

      // Body
      const bodyGrad = ctx.createLinearGradient(0, gy, 0, gy + mh * sc);
      bodyGrad.addColorStop(0, v.color);
      bodyGrad.addColorStop(1, v.color + "aa");
      ctx.fillStyle = bodyGrad;
      ctx.shadowColor = v.color + "55";
      ctx.shadowBlur = mw * 0.3;
      ctx.beginPath();
      ctx.roundRect(
        (-mw / 2) * sc,
        gy,
        mw * sc,
        mh * 0.62 * sc,
        mw * 0.18 * sc,
      );
      ctx.fill();
      ctx.shadowBlur = 0;

      // Head
      const hcx2 = isSlide ? -mw * 0.15 : 0;
      const hcyr = gy - mh * 0.3 * sc;
      const hrr = mw * 0.38 * sc;
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.arc(hcx2, hcyr, hrr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.22)";
      ctx.beginPath();
      ctx.ellipse(
        hcx2,
        hcyr + hrr * 0.2,
        hrr * 0.66,
        hrr * 0.56,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      // Eyes
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(hcx2 - hrr * 0.36, hcyr - hrr * 0.1, hrr * 0.28, 0, Math.PI * 2);
      ctx.arc(hcx2 + hrr * 0.36, hcyr - hrr * 0.1, hrr * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a0a2e";
      ctx.beginPath();
      ctx.arc(hcx2 - hrr * 0.3, hcyr - hrr * 0.06, hrr * 0.18, 0, Math.PI * 2);
      ctx.arc(hcx2 + hrr * 0.42, hcyr - hrr * 0.06, hrr * 0.18, 0, Math.PI * 2);
      ctx.fill();
      // Angry brows
      ctx.strokeStyle = "#1a0a2e";
      ctx.lineWidth = hrr * 0.18;
      ctx.beginPath();
      ctx.moveTo(hcx2 - hrr * 0.64, hcyr - hrr * 0.46);
      ctx.lineTo(hcx2 - hrr * 0.06, hcyr - hrr * 0.3);
      ctx.moveTo(hcx2 + hrr * 0.06, hcyr - hrr * 0.46);
      ctx.lineTo(hcx2 + hrr * 0.64, hcyr - hrr * 0.3);
      ctx.stroke();
      // Ears
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.arc(hcx2 - hrr * 1.02, hcyr - hrr * 0.2, hrr * 0.38, 0, Math.PI * 2);
      ctx.arc(hcx2 + hrr * 1.02, hcyr - hrr * 0.2, hrr * 0.38, 0, Math.PI * 2);
      ctx.fill();
      // Name badge
      const nm = v.name;
      ctx.font = `bold ${hrr * 0.72}px Boogaloo`;
      const nmW = ctx.measureText(nm).width;
      ctx.fillStyle = "rgba(0,0,0,.72)";
      ctx.beginPath();
      ctx.roundRect(
        hcx2 - nmW / 2 - 5,
        hcyr - hrr * 1.52,
        nmW + 10,
        hrr * 0.72,
        4,
      );
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.textAlign = "center";
      ctx.fillText(nm, hcx2, hcyr - hrr * 0.92);

      // Action hint above
      ctx.fillStyle = "rgba(255,255,255,.8)";
      ctx.font = `bold ${mw * 0.56}px Boogaloo`;
      const hint = v.action === "HIGH" ? "HIGH JUMP!" : v.action + "!";
      ctx.fillText(hint, 0, gy - mh * sc - mw * 0.5);

      ctx.restore();
    }

    ctx.restore();
  }

  function drawCollectibles() {
    const t = Date.now() * 0.001;
    for (const c of collectibles) {
      if (c.collected) continue;
      const bob = Math.sin(t * 3 + c.bobOffset) * (ch * 0.014);
      const glow = c.gem.rarity < 0.05;

      ctx.save();
      ctx.translate(c.x, c.y + bob);

      if (glow) {
        ctx.shadowColor = c.gem.color;
        ctx.shadowBlur = c.r * 1.5;
      }

      // Glow ring for immunity orb
      if (c.gem.id === "orb") {
        ctx.strokeStyle = "#c084fc";
        ctx.lineWidth = c.r * 0.35;
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 4);
        ctx.beginPath();
        ctx.arc(0, 0, c.r * 1.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = c.gem.color;
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.font = `${c.r * 1.9}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(c.gem.emoji, 0, 1);
      ctx.textBaseline = "alphabetic";
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxL);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.r * (p.life / p.maxL)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function renderFrame() {
    ctx.clearRect(0, 0, cw, ch);
    drawBg();
    drawCollectibles();
    for (const o of obstacles) drawObstacle(o);
    drawPunch();
    drawParticles();
  }

  // ─── WIN SCENE ──────────────────────────────────────────────────
  let winRaf = 0;

  function renderWinScene() {
    cancelAnimationFrame(winRaf);
    const wc = document.getElementById("win-canvas");
    if (!wc) return;
    const wx = wc.getContext("2d");
    const W = wc.width,
      H = wc.height;
    let wf = 0;

    function frame() {
      wf++;
      wx.clearRect(0, 0, W, H);

      // Sky
      const bg = wx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#050110");
      bg.addColorStop(1, "#1a0a2e");
      wx.fillStyle = bg;
      wx.fillRect(0, 0, W, H);

      // Stars
      for (let i = 0; i < 25; i++) {
        wx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(wf * 0.04 + i * 1.4));
        wx.fillStyle = "white";
        wx.beginPath();
        wx.arc((i * 97) % W, (i * 51) % (H * 0.5), 1.2, 0, Math.PI * 2);
        wx.fill();
      }
      wx.globalAlpha = 1;

      // Moon
      wx.fillStyle = "#ffd166";
      wx.shadowColor = "#ffd16655";
      wx.shadowBlur = 10;
      wx.beginPath();
      wx.arc(W * 0.83, H * 0.18, 14, 0, Math.PI * 2);
      wx.fill();
      wx.shadowBlur = 0;

      // Ground
      wx.fillStyle = "#1a0a3e";
      wx.fillRect(0, H * 0.68, W, H * 0.32);
      wx.strokeStyle = "#2d1b69";
      wx.lineWidth = 2;
      wx.beginPath();
      wx.moveTo(0, H * 0.68);
      wx.lineTo(W, H * 0.68);
      wx.stroke();

      // Wind lines
      wx.strokeStyle = "rgba(160,210,255,.06)";
      wx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const wy2 = H * 0.3 + i * 9;
        wx.beginPath();
        wx.moveTo(0, wy2);
        for (let xi = 0; xi < W; xi += 6)
          wx.lineTo(xi, wy2 + Math.sin(xi * 0.04 + wf * 0.03 + i) * 3);
        wx.stroke();
      }

      const cxw = W * 0.5,
        cyw = H * 0.72;
      const br = Math.sin(wf * 0.06) * 0.55; // breathing

      // Plushie glowing
      wx.save();
      wx.translate(cxw - 22, cyw - 22 + br * 0.5);
      wx.shadowColor = "#ff4d6d77";
      wx.shadowBlur = 14;
      wx.fillStyle = "#ff4d6d";
      wx.beginPath();
      wx.arc(0, 0, 18, 0, Math.PI * 2);
      wx.fill();
      wx.shadowBlur = 0;
      wx.fillStyle = "#ff8fa3";
      wx.beginPath();
      wx.ellipse(0, 4, 14, 11, 0, 0, Math.PI * 2);
      wx.fill();
      wx.fillStyle = "#ff4d6d";
      wx.beginPath();
      wx.arc(-14, -12, 6, 0, Math.PI * 2);
      wx.arc(8, -13, 6, 0, Math.PI * 2);
      wx.fill();
      wx.restore();

      // Punch sleeping
      wx.save();
      wx.translate(cxw + 4, cyw - 24 + br);
      wx.fillStyle = "#c47a2e";
      wx.beginPath();
      wx.roundRect(-10, -18, 28, 24, 10);
      wx.fill();
      wx.beginPath();
      wx.arc(20, -18, 17, 0, Math.PI * 2);
      wx.fill();
      wx.fillStyle = "#e8a96a";
      wx.beginPath();
      wx.ellipse(20, -14, 12, 10, 0, 0, Math.PI * 2);
      wx.fill();
      // Closed eyes
      wx.strokeStyle = "#1a0a2e";
      wx.lineWidth = 2;
      wx.beginPath();
      wx.arc(13, -20, 5, 0.1, Math.PI - 0.1);
      wx.stroke();
      wx.beginPath();
      wx.arc(27, -20, 5, 0.1, Math.PI - 0.1);
      wx.stroke();
      // Smile
      wx.beginPath();
      wx.arc(20, -12, 3.5, 0.2, Math.PI - 0.2);
      wx.stroke();
      // z z z
      wx.fillStyle = "#ffd166";
      wx.font = "bold 11px Boogaloo";
      wx.textAlign = "left";
      const zb = Math.sin(wf * 0.04) * 4;
      wx.globalAlpha = 0.65 + 0.35 * Math.sin(wf * 0.06);
      wx.fillText("z", 40, -26 + zb);
      wx.fillText("z", 48, -18 + zb * 0.6);
      wx.fillText("z", 54, -34 + zb * 0.4);
      wx.globalAlpha = 1;
      wx.restore();

      if (state === "won") winRaf = requestAnimationFrame(frame);
    }
    frame();
  }

  // ─── MAIN LOOP ─────────────────────────────────────────────────
  function loop(ts) {
    if (state !== "playing") return;
    const dt = Math.min((ts - lastTS) / 1000, 0.05);
    lastTS = ts;
    update(dt);
    renderFrame();
    animId = requestAnimationFrame(loop);
  }

  // ─── INIT ──────────────────────────────────────────────────────
  function init() {
    canvas = document.getElementById("cv");
    if (!canvas) return;
    ctx = canvas.getContext("2d");

    loadPersisted();
    resize();
    window.addEventListener("resize", resize);
    bindInput();

    // Reset game variables
    score = 0;
    level = 1;
    lives = 3;
    gemsCollected = 0;
    gemsTotal = 0;
    gemLog = {};
    immunoTimer = 0;
    magnetTimer = 0;
    hitCooldown = 0;
    speedBoostTimer = 0;
    obstacles = [];
    collectibles = [];
    particles = [];
    bgX = [0, 0, 0];
    startTime = Date.now();
    devMode = false;

    bumpPlayCount();
    initLevel(1);
  }

  function bumpPlayCount() {
    try {
      const n = parseInt(localStorage.getItem("pm_plays") || "0") + 1;
      localStorage.setItem("pm_plays", n);
    } catch {}
  }

  // ─── PUBLIC API ────────────────────────────────────────────────
  return {
    init,
    cleanUp,
    restart,
    doJump,
    setSlide,
    togglePause,
    resume: resumeGame,
    autoPause,
    continueRun,
    share,
    get state() {
      return state;
    },
    get level() {
      return level;
    },
  };
})();
