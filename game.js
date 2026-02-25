/**
 * PUNCH'S GREAT ESCAPE — game.js v6
 *
 * KEY FIXES vs v5:
 *  1. MUTE = music only. All SFX always play.
 *  2. Jump VERY high (JV = -2.0 × ch). Duck = 38% height crouch.
 *  3. Obstacle collision boxes match visuals exactly.
 *     Vines: leaf cluster sits at Punch standing-head height → MUST duck.
 *     Ground obs: AABB with 10% horizontal margin.
 *  4. Tutorial = top-bar toast (tut-bar), NOT center overlay.
 *     Uses IDs: tut-bar, tut-bar-icon, tut-bar-text, tut-bar-key, tut-arrow.
 *  5. Tutorial sequence (NO damage possible during tutorial):
 *     - Punch walks freely (no obstacles, 1.5s)
 *     - Step 0 hearts info (auto 3s)
 *     - Step 1 jump: spawn Bobo, pause, show bar, wait for jump
 *     - Step 2 duck: spawn vine, pause, show bar, wait for slide
 *     - Step 3 double-jump: spawn bigbobo, pause, show bar, wait djump
 *     - Step 4 gem: spawn gem, show bar, wait collect (auto 5s max)
 *     - 3-2-1 countdown (Punch walks, NO obstacles)
 *     - Obstacles begin
 *  6. INVINCIBILITY during entire tutorial (hitCooldown stays at 99).
 *  7. Mobile-first sizes: pW=5.5%cw, pH=18%ch.
 *     Obstacle sizes: fraction of ch, clamped so they're never too big.
 *  8. Levels 6-10 significantly harder (speedMult 1.5→2.5).
 *  9. Mobile pause button: #mob-pause (top-left).
 * 10. Text labels on obstacles: font-size clamped min 11px.
 */
"use strict";

/* ═══════════════════════════════════════
   AUDIO  —  MUTE kills music only
   ═══════════════════════════════════════ */
const PunchAudio = (() => {
  let ac,
    musicMuted = false,
    bgTimer = null,
    phraseIdx = 0;

  function wake() {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
  }

  /* Shakuhachi flute — honors musicMuted */
  function fl(freq, dur, vol = 0.17, delay = 0) {
    if (musicMuted) return;
    wake();
    try {
      const t = ac.currentTime + delay;
      const o = ac.createOscillator(),
        g = ac.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t);
      o.frequency.linearRampToValueAtTime(freq * 1.005, t + dur * 0.4);
      o.frequency.linearRampToValueAtTime(freq * 0.997, t + dur * 0.85);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.03);
      g.gain.setValueAtTime(vol * 0.85, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(ac.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
      const o2 = ac.createOscillator(),
        g2 = ac.createGain();
      o2.type = "sine";
      o2.frequency.value = freq * 2.01;
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(vol * 0.09, t + 0.04);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.6);
      o2.connect(g2);
      g2.connect(ac.destination);
      o2.start(t);
      o2.stop(t + dur * 0.65);
    } catch {}
  }

  /* SFX — NEVER muted */
  function sfxT(freq, type, dur, vol = 0.2, delay = 0) {
    wake();
    try {
      const t = ac.currentTime + delay;
      const o = ac.createOscillator(),
        g = ac.createGain();
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
  function sfxN(dur = 0.1, vol = 0.15, freq = 800) {
    wake();
    try {
      const n = Math.floor(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, n, ac.sampleRate),
        d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = ac.createBufferSource(),
        g = ac.createGain(),
        f = ac.createBiquadFilter();
      s.buffer = buf;
      f.type = "bandpass";
      f.frequency.value = freq;
      f.Q.value = 0.7;
      g.gain.setValueAtTime(vol, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      s.connect(f);
      f.connect(g);
      g.connect(ac.destination);
      s.start();
    } catch {}
  }

  const SC = {
    calm: [
      293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99, 880, 987.77,
    ],
    tense: [
      329.63, 392, 440, 493.88, 587.33, 659.25, 783.99, 880, 987.77, 1174.66,
    ],
    dark: [
      246.94, 277.18, 329.63, 369.99, 415.3, 493.88, 554.37, 659.25, 739.99,
      830.61,
    ],
    intense: [
      329.63, 392, 466.16, 554.37, 622.25, 698.46, 830.61, 932.33, 1108.73,
      1244.51,
    ],
    end: [
      261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880,
    ],
  };
  const PH = {
    calm: [
      [4, 6, 7, 6, 4, 2, 0, 2, 4, 2, 0, 4, 6, 4, 2, 0],
      [0, 2, 4, 2, 0, 4, 6, 7, 6, 4, 2, 4, 6, 4, 2, 0],
    ],
    tense: [
      [2, 4, 5, 7, 5, 4, 2, 0, 4, 5, 7, 5, 4, 2, 5, 4],
      [0, 2, 4, 5, 4, 2, 0, 4, 5, 7, 5, 4, 2, 0, 4, 2],
    ],
    dark: [
      [3, 1, 0, 2, 4, 3, 1, 3, 5, 4, 3, 1, 0, 2, 4, 3],
      [5, 4, 3, 1, 0, 3, 5, 4, 3, 1, 3, 5, 7, 5, 3, 1],
    ],
    intense: [
      [4, 6, 8, 9, 8, 6, 4, 6, 8, 9, 8, 6, 4, 3, 6, 8],
      [8, 9, 8, 6, 4, 6, 8, 6, 4, 3, 4, 6, 8, 9, 8, 6],
    ],
    end: [[0, 2, 4, 6, 7, 6, 4, 2, 4, 6, 7, 6, 4, 2, 0, 2]],
  };
  const TM = { calm: 0.5, tense: 0.4, dark: 0.34, intense: 0.22, end: 0.56 };

  function startMusic(mood = "calm") {
    stopMusic();
    if (musicMuted) return;
    const sc = SC[mood] || SC.calm,
      pl = PH[mood] || PH.calm;
    const ph = pl[phraseIdx % pl.length];
    phraseIdx++;
    const tempo = TM[mood] || 0.44;
    let step = 0;
    function next() {
      if (musicMuted) return;
      const idx = ph[step % ph.length],
        freq = sc[Math.min(idx, sc.length - 1)];
      fl(freq, tempo * 0.85, 0.15);
      if (step % 4 === 0) fl(freq * 0.5, tempo * 2.5, 0.06);
      if (step % 9 === 3)
        fl(sc[(idx + 5) % sc.length] * 2, tempo * 0.28, 0.03, tempo * 0.3);
      step++;
      if (step < ph.length * 2) bgTimer = setTimeout(next, tempo * 1000);
      else bgTimer = setTimeout(() => startMusic(mood), 260);
    }
    next();
  }
  function stopMusic() {
    if (bgTimer) {
      clearTimeout(bgTimer);
      bgTimer = null;
    }
  }

  const SFX = {
    jump: () => {
      sfxT(440, "sine", 0.12, 0.22);
      sfxT(587, "sine", 0.08, 0.14, 0.07);
      sfxN(0.05, 0.08, 1200);
    },
    djump: () => {
      sfxT(660, "sine", 0.1, 0.26);
      sfxT(880, "sine", 0.1, 0.2, 0.07);
      sfxT(1047, "sine", 0.08, 0.16, 0.14);
    },
    slide: () => {
      sfxN(0.12, 0.22, 600);
      sfxT(200, "sine", 0.1, 0.08);
    },
    hit: () => {
      sfxT(150, "square", 0.18, 0.28);
      sfxT(100, "sawtooth", 0.16, 0.22, 0.06);
      setTimeout(() => {
        sfxT(340, "sine", 0.07, 0.12);
        sfxT(260, "sine", 0.1, 0.1, 0.07);
      }, 150);
    },
    mkPass: () => sfxN(0.05, 0.07, 500),
    gem: () => {
      sfxT(880, "sine", 0.07, 0.2);
      sfxT(1047, "sine", 0.09, 0.16, 0.06);
    },
    rare: () =>
      [784, 1047, 1319, 1568].forEach((f, i) =>
        sfxT(f, "sine", 0.28, 0.18, i * 0.09),
      ),
    immuno: () =>
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        sfxT(f, "sine", 0.22, 0.2, i * 0.08),
      ),
    magnet: () => {
      sfxT(440, "triangle", 0.12, 0.18);
      sfxT(660, "triangle", 0.1, 0.14, 0.08);
      sfxT(880, "sine", 0.1, 0.12, 0.16);
    },
    lvlUp: () =>
      [392, 523, 659, 784, 1047].forEach((f, i) =>
        sfxT(f, "sine", 0.24, 0.22, i * 0.11),
      ),
    death: () => {
      sfxT(280, "square", 0.1, 0.25);
      sfxT(180, "square", 0.15, 0.22, 0.1);
      sfxT(100, "sawtooth", 0.28, 0.28, 0.22);
    },
    win: () =>
      [523, 659, 784, 1047, 784, 1047, 1319, 1047, 784, 1319].forEach((f, i) =>
        sfxT(f, "sine", 0.3, 0.22, i * 0.16),
      ),
    countdown: () => sfxT(440, "triangle", 0.2, 0.28),
    go: () => {
      sfxT(660, "sine", 0.15, 0.3);
      sfxT(880, "sine", 0.2, 0.25, 0.12);
    },
    tutPing: () => sfxT(880, "sine", 0.1, 0.18),
  };

  function toggleMute() {
    musicMuted = !musicMuted;
    ["mute-btn", "mute-hud"].forEach((id) => {
      const e = document.getElementById(id);
      if (e) e.textContent = musicMuted ? "🔇" : "🔊";
    });
    if (musicMuted) stopMusic();
    else
      startMusic(
        window.PunchGame && PunchGame.state === "playing"
          ? LEVELS[PunchGame.level - 1]?.music || "calm"
          : "calm",
      );
  }
  return { wake, startMusic, stopMusic, sfx: SFX, toggleMute };
})();

/* ═══════════════════════════════════════
   GAME DATA
   Villain hFrac/wFrac = fraction of canvas HEIGHT (ch).
   This ensures consistent proportional size on every screen.
   ═══════════════════════════════════════ */
const VILLAINS = [
  /* Ground obstacles — y = pGr() (feet at ground) */
  {
    id: "slider",
    name: "Knuckles",
    color: "#ef476f",
    tier: 1,
    action: "JUMP",
    hFrac: 0.13,
    wFrac: 0.055,
    duck: false,
  },
  {
    id: "jumper",
    name: "Bobo",
    color: "#ff9f1c",
    tier: 1,
    action: "JUMP",
    hFrac: 0.17,
    wFrac: 0.06,
    duck: false,
  },
  {
    id: "rock",
    name: "Rockhead",
    color: "#94a3b8",
    tier: 2,
    action: "JUMP",
    hFrac: 0.16,
    wFrac: 0.06,
    duck: false,
  },
  {
    id: "peel",
    name: "Slippy",
    color: "#fdd835",
    tier: 2,
    action: "JUMP",
    hFrac: 0.09,
    wFrac: 0.07,
    duck: false,
  },
  {
    id: "bigbobo",
    name: "BIG Bobo",
    color: "#f97316",
    tier: 3,
    action: "HIGH",
    hFrac: 0.26,
    wFrac: 0.068,
    duck: false,
  },
  {
    id: "twintrap",
    name: "TwinTrap",
    color: "#ec4899",
    tier: 4,
    action: "JUMP",
    hFrac: 0.17,
    wFrac: 0.055,
    duck: false,
  },
  {
    id: "boulder",
    name: "Crusher",
    color: "#6b7280",
    tier: 4,
    action: "JUMP",
    hFrac: 0.18,
    wFrac: 0.065,
    duck: false,
  },
  {
    id: "spike",
    name: "Stabby",
    color: "#ef4444",
    tier: 5,
    action: "HIGH",
    hFrac: 0.22,
    wFrac: 0.05,
    duck: false,
  },
  /* Floating/hanging obstacles — duck:true means leaf-bottom at Punch head */
  {
    id: "vine",
    name: "Creepvine",
    color: "#06d6a0",
    tier: 1,
    action: "DUCK",
    hFrac: 0.42,
    wFrac: 0.028,
    duck: true,
  },
  {
    id: "swinger",
    name: "Swingby",
    color: "#a855f7",
    tier: 3,
    action: "DUCK",
    hFrac: 0.38,
    wFrac: 0.026,
    duck: true,
  },
];
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
    rarity: 0.07,
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
    rarity: 0.03,
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
    name: "Diamond",
    pts: 400,
    rarity: 0.01,
    color: "#67e8f9",
    effect: "pts",
  },
];
const LEVELS = [
  {
    n: 1,
    name: "Monkey Zoo",
    emoji: "🏛️",
    bg: "zoo",
    speedMult: 1.0,
    obsCount: 20,
    music: "calm",
    desc: "Tutorial time!",
  },
  {
    n: 2,
    name: "Bamboo Forest",
    emoji: "🎋",
    bg: "bamboo",
    speedMult: 1.05,
    obsCount: 15,
    music: "calm",
    desc: "Watch the hanging bamboo!",
  },
  {
    n: 3,
    name: "River Banks",
    emoji: "🌊",
    bg: "river",
    speedMult: 1.12,
    obsCount: 18,
    music: "calm",
    desc: "Stay sharp out there.",
  },
  {
    n: 4,
    name: "Ancient Ruins",
    emoji: "🏛️",
    bg: "ruins",
    speedMult: 1.2,
    obsCount: 21,
    music: "tense",
    desc: "The stones begin to fly...",
  },
  {
    n: 5,
    name: "Mushroom Grove",
    emoji: "🍄",
    bg: "mushroom",
    speedMult: 1.3,
    obsCount: 24,
    music: "tense",
    desc: "Speed picks up. Focus.",
  },
  /* Levels 6-10: significantly harder */
  {
    n: 6,
    name: "Crystal Cave",
    emoji: "💎",
    bg: "cave",
    speedMult: 1.55,
    obsCount: 27,
    music: "dark",
    desc: "MUCH faster. Stay alive.",
  },
  {
    n: 7,
    name: "Volcano Edge",
    emoji: "🌋",
    bg: "volcano",
    speedMult: 1.82,
    obsCount: 30,
    music: "dark",
    desc: "The ground is on FIRE.",
  },
  {
    n: 8,
    name: "Moonlit Path",
    emoji: "🌙",
    bg: "moon",
    speedMult: 2.1,
    obsCount: 33,
    music: "dark",
    desc: "Almost there. Do NOT stop.",
  },
  {
    n: 9,
    name: "Storm Valley",
    emoji: "⚡",
    bg: "storm",
    speedMult: 2.4,
    obsCount: 36,
    music: "intense",
    desc: "MAXIMUM SPEED. GO GO GO!",
  },
  {
    n: 10,
    name: "THE PLUSHIE!!!",
    emoji: "🧸",
    bg: "final",
    speedMult: 2.75,
    obsCount: 39,
    music: "intense",
    desc: "THIS IS IT. FOR THE PLUSHIE!",
  },
];
const ML = {
  calm: "🎵 Peaceful flute",
  tense: "🎵 Tense flute",
  dark: "🎵 Dark & mysterious",
  intense: "🎵 Danger flute",
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
    msg: "Classic banana peel. No shame.",
    col: "#ffd166",
  },
  { title: "🐒 TACKLED!", msg: "Knuckles body-slammed him.", col: "#ff9f1c" },
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
    msg: "The whole gang showed up. Party.",
    col: "#a855f7",
  },
];

/* ═══════════════════════════════════════
   GAME ENGINE
   ═══════════════════════════════════════ */
const PunchGame = (() => {
  let canvas,
    ctx,
    cw = 800,
    ch = 500;
  let state = "idle";
  let level = 1,
    score = 0,
    lives = 3;
  let obsBeaten = 0,
    obsNeeded = 10;
  let gemsCollected = 0,
    gemsTotal = 0,
    gemLog = {};
  let devMode = false,
    startTime = 0;
  let immunoTimer = 0,
    magnetTimer = 0,
    hitCooldown = 0,
    spdBoost = 0;
  let obsCD = 9999,
    colCD = 9999;
  let lastTS = 0,
    animId = 0;
  let bgX = [0, 0, 0];
  let obstacles = [],
    collectibles = [],
    particles = [];
  let bestScore = 0,
    bestLevel = 1;

  function loadP() {
    try {
      bestScore = +localStorage.getItem("pm_best") || 0;
      bestLevel = +localStorage.getItem("pm_bestlv") || 1;
    } catch {}
  }
  function saveP() {
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

  /* ─── PUNCH ─────────────────────────────
     wFrac / hFrac chosen mobile-first.
     5.5% width × 18% height feels right on
     a 375px phone and scales naturally up.
  */
  const P = {
    xFrac: 0.15,
    yFrac: 0.82,
    grFrac: 0.82,
    vy: 0,
    jumping: false,
    jumpCount: 0,
    sliding: false,
    slideTimer: 0,
    animTick: 0,
    animFrame: 0,
    wFrac: 0.055,
    hFrac: 0.18,
  };
  const px = () => P.xFrac * cw;
  const pGr = () => P.grFrac * ch;
  const pW = () => P.wFrac * cw;
  const pH = () => P.hFrac * ch;
  const pY = () => P.yFrac * ch; /* foot Y */
  /* Hitbox: narrow + tall standing, short when sliding.
     Sliding: 35% of normal height. Since vine leaf is at 85% of pH above ground,
     and duck head is at pH*0.35 above ground → easily clears the 85% threshold. */
  const pHit = () => ({
    x: px() + pW() * 0.12,
    w: pW() * 0.76,
    y: P.sliding ? pY() - pH() * 0.35 : pY() - pH(),
    h: P.sliding ? pH() * 0.35 : pH(),
  });

  function resetP() {
    P.yFrac = P.grFrac;
    P.vy = 0;
    P.jumpCount = 0;
    P.jumping = false;
    P.sliding = false;
    P.slideTimer = 0;
    P.animTick = 0;
    P.animFrame = 0;
  }

  /* ─── JUMP PHYSICS ──────────────────────
     GR  = gravity (×ch per s²)
     JV  = jump vel (×ch per s, negative = up)
     DJ  = double-jump vel
     Peak height = JV² / (2 × GR × ch) × ch
     With JV=-2.0, GR=3.6 → peak ≈ 55% of canvas height above ground.
     bigbobo hFrac=.26, so at 55% clearance, plenty of room.
  */
  const GR = 3.6,
    JV = -2.0,
    DJ = -1.65;

  function doJump() {
    if (P.jumpCount < 2) {
      P.vy = (P.jumpCount === 0 ? JV : DJ) * ch;
      P.jumping = true;
      P.jumpCount++;
      P.sliding = false;
      spawnParts(px() + pW() / 2, pY(), "#ffd166", 5);
      P.jumpCount === 1 ? PunchAudio.sfx.jump() : PunchAudio.sfx.djump();
      if (tutActive) {
        if (P.jumpCount === 1) tutOnAction("jump");
        else tutOnAction("djump");
      }
    }
  }
  function setSlide(on) {
    if (on && !P.sliding && !P.jumping) PunchAudio.sfx.slide();
    P.sliding = on;
    if (on) {
      P.slideTimer = 0.55;
      if (tutActive) tutOnAction("slide");
    } else P.slideTimer = 0;
  }

  /* ─── TUTORIAL ──────────────────────────
     Top-bar toast. NOT center overlay.
     Punch is FULLY INVINCIBLE during tutorial
     (hitCooldown pinned to 99 until tutActive=false).
     Steps:
       0  hearts info (auto 3s)
       1  jump    – spawn Bobo,    pause, wait 'jump'
       2  duck    – spawn vine,    pause, wait 'slide'
       3  djump   – spawn bigbobo, pause, wait 'djump'
       4  gem     – spawn coin,    no pause, wait 'gem' or 5s
     Then 3-2-1 countdown, then real game.
  */
  let tutStep = -1,
    tutActive = false,
    tutPaused = false,
    tutActionDone = false,
    graceTimer = 0;

  const TSTEPS = [
    {
      icon: "❤️",
      text: "You have 3 hearts. Lose them all = game over. Collect ❤️ gems for more!",
      action: "auto",
      delay: 3200,
      pause: false,
      spawn: null,
    },
    {
      icon: "⬆️",
      text: "Obstacle incoming! Jump over it!",
      dk: "SPACE / ↑ / W",
      mk: "Tap ↑ button or swipe up",
      action: "jump",
      pause: true,
      spawn: "jumper",
    },
    {
      icon: "⬇️",
      text: "Duck under the vine — it WILL hit you if you stay standing!",
      dk: "↓ / S  (hold)",
      mk: "Swipe down  or  tap ↓",
      action: "slide",
      pause: true,
      spawn: "vine",
    },
    {
      icon: "⬆️⬆️",
      text: "Tall obstacle! Jump TWICE — press jump again while airborne!",
      dk: "SPACE  then  SPACE again mid-air",
      mk: "Tap ↑  then  tap ↑ again mid-air",
      action: "djump",
      pause: true,
      spawn: "bigbobo",
    },
    {
      icon: "💎",
      text: "Collect gems for points & powers! Run through that gem!",
      action: "gem",
      pause: false,
      spawn: "coin",
      delay: 5500,
    },
  ];

  function tutStart() {
    tutActive = true;
    tutStep = -1;
    tutPaused = false;
    tutActionDone = false;
    tutHideBar();
    tutHideArr();
    hitCooldown = 9999; /* fully invincible during tutorial */
    setTimeout(() => tutNext(), 1600); /* let Punch walk freely first */
  }

  function tutNext() {
    tutStep++;
    if (tutStep >= TSTEPS.length) {
      tutActive = false;
      tutHideBar();
      tutHideArr();
      hitCooldown = 0; /* restore normal hitCooldown counting */
      graceTimer = 10; /* 10 second grace period after tutorial — let the dog out slowly */
      doCountdown();
      return;
    }
    const s = TSTEPS[tutStep];
    tutActionDone = false;
    if (s.pause) {
      tutPaused = true;
      obstacles = [];
      collectibles = [];
    }
    if (s.spawn === "coin") {
      /* Spawn a guaranteed coin right in Punch's path */
      gemsTotal++;
      collectibles.push({
        x: px() + pW() * 3.5,
        y: pGr() - pH() * 0.5,
        r: ch * 0.042,
        gem: GEMS[0],
        collected: false,
        bobOff: 0,
      });
    } else if (s.spawn) {
      spawnTutOb(s.spawn);
    }
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const key = touch ? s.mk || s.dk || "" : s.dk || "";
    tutShowBar(s.icon, s.text, key);
    if (s.action === "auto")
      setTimeout(() => {
        tutHideBar();
        setTimeout(() => tutNext(), 150);
      }, s.delay || 3000);
    if (s.action === "gem")
      setTimeout(() => {
        if (tutActive) tutNext();
      }, s.delay || 5500);
  }

  function tutOnAction(act) {
    if (!tutActive || tutActionDone || tutStep < 0) return;
    const s = TSTEPS[tutStep];
    if (!s || s.action !== act) return;
    tutActionDone = true;
    tutPaused = false;
    tutHideBar();
    tutHideArr();
    setTimeout(() => tutNext(), 1100);
  }

  function spawnTutOb(type) {
    const v = VILLAINS.find((x) => x.id === type) || VILLAINS[1];
    const h = v.hFrac * ch,
      w = v.wFrac * cw;
    /* Position ~60% across screen so it's visible but approaching */
    /* Vine: ob.y = where the leaf-bottom sits = Punch head level */
    const ob = {
      villain: v,
      type: v.id,
      x: cw * 0.72,
      y: v.duck ? pGr() - pH() * 0.85 : pGr(),
      baseY: v.duck ? pGr() - pH() * 0.85 : pGr(),
      bobAmp: 0,
      bobFreq: 2,
      w,
      h,
      animT: 0,
      wobble: 0,
      passed: false,
      isTut: true,
    };
    obstacles.push(ob);
  }

  /* 3-2-1 countdown — Punch walks, no obstacles */
  function doCountdown() {
    obstacles = [];
    collectibles = [];
    tutHideBar();
    tutHideArr();
    const toast = document.getElementById("level-toast");
    let i = 0;
    const counts = ["3", "2", "1", "GO! 🐒"];
    function tick() {
      if (toast) {
        document.getElementById("toast-lvl").textContent = counts[i];
        document.getElementById("toast-name").textContent =
          i < 3 ? "Get ready…" : "RUN Punch RUN!";
        document.getElementById("toast-desc").textContent = "";
        document.getElementById("toast-music").textContent = "";
        toast.style.display = "block";
      }
      PunchAudio.sfx.countdown();
      i++;
      if (i < counts.length) setTimeout(tick, 800);
      else
        setTimeout(() => {
          if (toast) toast.style.display = "none";
          PunchAudio.sfx.go();
          obsCD = 1.35;
          colCD = 0.95;
        }, 700);
    }
    tick();
  }

  /* Tutorial DOM helpers — use IDs in game.html */
  function tutShowBar(icon, text, key) {
    const b = document.getElementById("tut-bar");
    if (!b) return;
    document.getElementById("tut-bar-icon").textContent = icon;
    document.getElementById("tut-bar-text").textContent = text;
    const ke = document.getElementById("tut-bar-key");
    if (ke) {
      ke.textContent = key ? "→ " + key : "";
      ke.style.display = key ? "inline" : "none";
    }
    b.classList.add("visible");
    PunchAudio.sfx.tutPing();
  }
  function tutHideBar() {
    document.getElementById("tut-bar")?.classList.remove("visible");
  }
  function tutShowArr(x, y, dir) {
    const a = document.getElementById("tut-arrow");
    if (!a) return;
    a.textContent = dir;
    a.style.left = x - 18 + "px";
    a.style.top = Math.max(50, y - 8) + "px";
    a.style.display = "block";
  }
  function tutHideArr() {
    const a = document.getElementById("tut-arrow");
    if (a) a.style.display = "none";
  }

  /* ─── RESIZE ─────────────────────────── */
  function resize() {
    if (!canvas) return;
    cw = canvas.width = window.innerWidth;
    ch = canvas.height = window.innerHeight;
    P.grFrac = 0.82;
    if (P.yFrac > P.grFrac) P.yFrac = P.grFrac;
  }

  /* ─── INPUT ─────────────────────────── */
  const keys = {};
  function bindInput() {
    document.addEventListener("keydown", (e) => {
      if (keys[e.code]) return;
      keys[e.code] = true;
      PunchAudio.wake();
      if (state === "playing" || state === "tutorial") {
        if (["Space", "ArrowUp", "KeyW"].includes(e.code)) {
          e.preventDefault();
          doJump();
        }
        if (["ArrowDown", "KeyS"].includes(e.code)) {
          e.preventDefault();
          setSlide(true);
        }
        if (e.code === "ArrowRight") spdBoost = 90;
        if (e.code === "KeyL") toggleDev();
      }
      if (["KeyP", "Escape"].includes(e.code)) {
        e.preventDefault();
        if (state === "playing" || state === "paused") togglePause();
      }
    });
    document.addEventListener("keyup", (e) => {
      keys[e.code] = false;
      if (["ArrowDown", "KeyS"].includes(e.code)) setSlide(false);
      if (e.code === "ArrowRight") spdBoost = 0;
    });
    /* Touch swipes */
    let tx = 0,
      ty = 0,
      tt = 0;
    canvas.addEventListener(
      "touchstart",
      (e) => {
        tx = e.touches[0].clientX;
        ty = e.touches[0].clientY;
        tt = Date.now();
        PunchAudio.wake();
      },
      { passive: true },
    );
    canvas.addEventListener(
      "touchend",
      (e) => {
        if (state !== "playing" && state !== "tutorial") return;
        const dx = tx - e.changedTouches[0].clientX,
          dy = ty - e.changedTouches[0].clientY,
          dt = Date.now() - tt;
        if (Math.abs(dy) > Math.abs(dx)) {
          if (dy > 22) doJump();
          else if (dy < -22) setSlide(true);
        } else if (dx > 38 && dt < 300) spdBoost = 90;
        else if (Math.abs(dx) < 22 && Math.abs(dy) < 22) doJump();
      },
      { passive: true },
    );
  }

  /* ─── SCREEN / HUD ───────────────────── */
  function showScr(id) {
    document
      .querySelectorAll(".scr")
      .forEach((s) => s.classList.remove("active"));
    if (id) {
      const e = document.getElementById(id);
      if (e) e.classList.add("active");
    }
  }
  function showHUD(v) {
    document.getElementById("hud")?.classList.toggle("visible", v);
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    document
      .getElementById("mob-ctrl")
      ?.classList.toggle("visible", v && touch);
    document
      .getElementById("mob-pause")
      ?.classList.toggle("visible", v && touch);
  }
  function updateHUD() {
    let h = "";
    for (let i = 0; i < lives; i++) h += "❤️";
    for (let i = lives; i < 3; i++) h += "🖤";
    const he = document.getElementById("hud-hearts");
    if (he) he.textContent = h || "💀";
    const pct = Math.min((obsBeaten / obsNeeded) * 100, 100);
    const pr = document.getElementById("hud-prog");
    if (pr) pr.style.width = pct + "%";
    const lv = document.getElementById("hud-level");
    if (lv) lv.textContent = "LVL " + level;
    const sc = document.getElementById("hud-score");
    if (sc) sc.textContent = score.toLocaleString();
    const gm = document.getElementById("hud-gems");
    if (gm) gm.textContent = "💎 " + gemsCollected;
    document.getElementById("immuno-badge").style.display =
      immunoTimer > 0 || graceTimer > 0 ? "block" : "none";
    if (graceTimer > 0)
      document.getElementById("immuno-badge").textContent =
        `🛡️ SAFE ${Math.ceil(graceTimer)}s`;
    else if (immunoTimer > 0)
      document.getElementById("immuno-badge").textContent = "🛡️ IMMUNE";
    document.getElementById("magnet-badge").style.display =
      magnetTimer > 0 ? "block" : "none";
  }
  function toggleDev() {
    devMode = !devMode;
    document.getElementById("dev-badge")?.classList.toggle("visible", devMode);
    PunchAudio.sfx.rare();
  }

  /* ─── PAUSE ─────────────────────────── */
  let resuming = false;
  function togglePause() {
    if (state === "playing") {
      state = "paused";
      cancelAnimationFrame(animId);
      PunchAudio.stopMusic();
      showScr("scr-pause");
      document.getElementById("countdown").style.display = "none";
      const hp = document.getElementById("hud-pause");
      if (hp) hp.textContent = "▶";
    } else if (state === "paused") resumeGame();
  }
  function resumeGame() {
    if (resuming || state !== "paused") return;
    resuming = true;
    const cd = document.getElementById("countdown");
    cd.style.display = "block";
    cd.textContent = "3";
    PunchAudio.sfx.countdown();
    let n = 3;
    const iv = setInterval(() => {
      n--;
      if (n > 0) {
        cd.textContent = String(n);
        PunchAudio.sfx.countdown();
      } else {
        clearInterval(iv);
        cd.textContent = "GO!";
        PunchAudio.sfx.go();
        setTimeout(() => {
          cd.style.display = "none";
          showScr(null);
          const hp = document.getElementById("hud-pause");
          if (hp) hp.textContent = "⏸";
          state = "playing";
          resuming = false;
          PunchAudio.startMusic(LEVELS[level - 1].music);
          lastTS = performance.now();
          animId = requestAnimationFrame(loop);
        }, 380);
      }
    }, 800);
  }
  function autoPause() {
    if (state === "playing") togglePause();
  }

  /* ─── SPAWN ─────────────────────────── */
  function getPool() {
    const mt =
      level <= 2 ? 1 : level <= 4 ? 2 : level <= 6 ? 3 : level <= 8 ? 4 : 5;
    return VILLAINS.filter((v) => v.tier <= mt);
  }
  function spawnObs() {
    const pool = getPool();
    const v = pool[Math.floor(Math.random() * pool.length)];
    const h = v.hFrac * ch,
      w = v.wFrac * cw;
    /* VINE / SWINGER: ob.y = leaf-bottom position.
       pGr()-pH()*0.85 = just at Punch's shoulder height when standing.
       Punch head goes up to pGr()-pH() = 100% of height.
       Leaf bottom at 0.85 × pH = well within Punch's head/body zone.
       Player MUST duck (slides to 38% height = pGr()-pH()*0.38)
       to get head below pGr()-pH()*0.85 → clears the vine. */
    const baseY = v.duck ? pGr() - pH() * 0.85 : pGr();
    const ob = {
      villain: v,
      type: v.id,
      x: cw + w * 0.5,
      y: baseY,
      baseY,
      /* Rocks/boulders bob but BASE at ground so they always reach Punch */
      bobAmp: v.id === "rock" || v.id === "boulder" ? ch * 0.025 : 0,
      bobFreq: 2.2 + Math.random(),
      w,
      h,
      animT: 0,
      wobble: 0,
      passed: false,
      isTut: false,
    };
    obstacles.push(ob);
    if (v.id === "twintrap") {
      const b = VILLAINS.find((x) => x.id === "jumper");
      obstacles.push({
        ...ob,
        villain: b,
        type: "jumper",
        x: ob.x + cw * 0.13,
        passed: false,
        bobAmp: 0,
        isTut: false,
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
      x: cw + 18,
      y: pGr() - pH() * 0.35 - Math.random() * pH() * 0.85,
      r: ch * 0.038,
      gem,
      collected: false,
      bobOff: Math.random() * Math.PI * 2,
    });
  }

  /* ─── PARTICLES ─────────────────────── */
  function spawnParts(x, y, color, n = 8) {
    for (let i = 0; i < n; i++)
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 240,
        vy: -Math.random() * 280 - 60,
        life: 0.55 + Math.random() * 0.35,
        maxL: 0.9,
        color,
        r: 2.5 + Math.random() * 4,
      });
  }

  /* ─── GEM COLLECTION ────────────────── */
  function collectGem(c) {
    gemsCollected++;
    gemLog[c.gem.id] = (gemLog[c.gem.id] || 0) + 1;
    score += c.gem.pts;
    spawnParts(c.x, c.y, c.gem.color, 14);
    popScore(
      c.x,
      c.y,
      c.gem.pts > 0 ? "+" + c.gem.pts : c.gem.name,
      c.gem.color,
    );
    switch (c.gem.effect) {
      case "life":
        if (lives < 8) lives++;
        PunchAudio.sfx.gem();
        gemBanner("❤️ +1 HEART!", c.gem.color);
        break;
      case "immuno":
        immunoTimer = 5;
        PunchAudio.sfx.immuno();
        gemBanner("🔮 IMMUNITY! 5s!", "#c084fc");
        break;
      case "magnet":
        magnetTimer = 8;
        PunchAudio.sfx.magnet();
        gemBanner("🧲 MAGNET ON!", "#f472b6");
        break;
      default:
        if (c.gem.rarity < 0.05) {
          PunchAudio.sfx.rare();
          gemBanner(
            c.gem.emoji + " " + c.gem.name + "! +" + c.gem.pts,
            c.gem.color,
          );
        } else PunchAudio.sfx.gem();
    }
    if (tutActive) tutOnAction("gem");
    updateHUD();
  }
  function gemBanner(txt, col) {
    const e = document.getElementById("gem-banner");
    if (!e) return;
    e.textContent = txt;
    e.style.background = `linear-gradient(135deg,${col}ee,${col}88)`;
    e.classList.remove("pop");
    void e.offsetWidth;
    e.classList.add("pop");
  }
  function popScore(x, y, txt, col) {
    const e = document.createElement("div");
    e.className = "score-pop";
    e.textContent = txt;
    e.style.cssText = `left:${x}px;top:${y - 20}px;color:${col || "#ffd166"}`;
    document.getElementById("game-wrap")?.appendChild(e);
    setTimeout(() => e.remove(), 950);
  }

  /* ─── DAMAGE ────────────────────────── */
  function takeDmg(v) {
    if (hitCooldown > 0 || tutActive || graceTimer > 0) return;
    hitCooldown = 1.3;
    /* Hit effects always fire */
    spawnParts(px() + pW() / 2, pY() - pH() / 2, "#ff4d6d", 20);
    PunchAudio.sfx.hit();
    if (devMode || immunoTimer > 0) return;
    lives--;
    updateHUD();
    if (lives <= 0) gameOver(v);
  }

  /* ─── LEVEL FLOW ────────────────────── */
  function levelDone() {
    state = "transition";
    PunchAudio.stopMusic();
    saveP();
    if (level >= 10) {
      doWin();
      return;
    }
    PunchAudio.sfx.lvlUp();
    setTimeout(() => initLevel(level + 1), 420);
  }

  function initLevel(lv) {
    level = lv;
    obsBeaten = 0;
    obsNeeded = LEVELS[lv - 1].obsCount;
    obstacles = [];
    collectibles = [];
    particles = [];
    obsCD = lv === 1 ? 9999 : 1.35;
    colCD = lv === 1 ? 9999 : 0.95;
    bgX = [0, 0, 0];
    immunoTimer = 0;
    magnetTimer = 0;
    hitCooldown = 0;
    spdBoost = 0;
    graceTimer = 0;
    resetP();
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
      if (ml) ml.textContent = ML[lc.music] || "";
      toast.style.display = "block";
    }
    PunchAudio.sfx.lvlUp();
    setTimeout(() => {
      if (toast) toast.style.display = "none";
      PunchAudio.stopMusic();
      PunchAudio.startMusic(lc.music);
      showScr(null);
      if (lv === 1) {
        state = "tutorial";
        lastTS = performance.now();
        cancelAnimationFrame(animId);
        animId = requestAnimationFrame(loop);
        setTimeout(() => tutStart(), 400);
      } else {
        state = "playing";
        lastTS = performance.now();
        cancelAnimationFrame(animId);
        animId = requestAnimationFrame(loop);
      }
    }, 2000);
  }

  /* ─── GAME OVER / WIN ───────────────── */
  function gameOver(v) {
    state = "over";
    cancelAnimationFrame(animId);
    PunchAudio.stopMusic();
    saveP();
    PunchAudio.sfx.death();
    setTimeout(() => PunchAudio.startMusic("end"), 480);
    tutHideBar();
    tutHideArr();
    const f = FAILS[Math.floor(Math.random() * FAILS.length)];
    document.getElementById("fail-title").textContent = f.title;
    document.getElementById("fail-title").style.color = f.col;
    document.getElementById("fail-msg").textContent = v
      ? `Taken out by ${v.name}. ${f.msg}`
      : f.msg;
    document.getElementById("go-score").textContent = score.toLocaleString();
    document.getElementById("go-level").textContent = level;
    document.getElementById("go-best").textContent = bestScore.toLocaleString();
    document.getElementById("go-maxlv").textContent = bestLevel;
    const gs =
      Object.entries(gemLog)
        .map(([id, n]) => {
          const g = GEMS.find((x) => x.id === id);
          return g ? `${g.emoji}×${n}` : "";
        })
        .filter(Boolean)
        .join("  ") || "none";
    document.getElementById("go-gems-info").textContent =
      `Gems: ${gemsCollected}/${gemsTotal} — ${gs}`;
    const cc = lives > 0;
    document.getElementById("cont-btn").style.display = cc ? "" : "none";
    document.getElementById("continue-info").textContent = cc
      ? `${lives} ❤️ left — continue Level ${level}`
      : "No hearts left!";
    showHUD(false);
    showScr("scr-over");
  }
  function doWin() {
    state = "won";
    cancelAnimationFrame(animId);
    PunchAudio.stopMusic();
    saveP();
    PunchAudio.sfx.win();
    setTimeout(() => PunchAudio.startMusic("end"), 480);
    const el = Math.round((Date.now() - startTime) / 1000);
    document.getElementById("win-score").textContent = score.toLocaleString();
    document.getElementById("win-time").textContent = el + "s";
    document.getElementById("win-gems").textContent = gemsCollected;
    showHUD(false);
    showScr("scr-win");
    setTimeout(() => renderWin(), 100);
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
    obsCD = 1.3;
    colCD = 0.9;
    resetP();
    showHUD(true);
    showScr(null);
    const lc = LEVELS[level - 1];
    const t = document.getElementById("level-toast");
    if (t) {
      document.getElementById("toast-lvl").textContent = "LEVEL " + level;
      document.getElementById("toast-name").textContent = "💪 Continue!";
      document.getElementById("toast-desc").textContent = "You got this!";
      t.style.display = "block";
    }
    setTimeout(() => {
      if (t) t.style.display = "none";
      PunchAudio.stopMusic();
      PunchAudio.startMusic(lc.music);
      state = "playing";
      lastTS = performance.now();
      animId = requestAnimationFrame(loop);
    }, 1300);
  }
  function restart() {
    cleanUp();
    init();
  }
  function cleanUp() {
    cancelAnimationFrame(animId);
    PunchAudio.stopMusic();
    tutHideBar();
    tutHideArr();
    state = "idle";
    showHUD(false);
  }
  function share(ctx2) {
    const url = "https://punch-monkey.vercel.app";
    const txt =
      ctx2 === "win"
        ? `🧸 I BEAT PUNCH'S GREAT ESCAPE!\nAll 10 levels! ${score.toLocaleString()} pts!\n#PunchMonkey\n${url}`
        : `🐒 Punch's Great Escape — Level ${level}, ${score.toLocaleString()} pts!\n#PunchMonkey\n${url}`;
    if (navigator.share)
      navigator
        .share({ title: "Punch's Great Escape", text: txt })
        .catch(() => {});
    else {
      try {
        navigator.clipboard.writeText(txt);
        alert("Copied! 🐒\n\n" + txt);
      } catch {
        alert(txt);
      }
    }
  }

  /* ═══════════════════════════════════════
     UPDATE — delta-time physics
     ═══════════════════════════════════════ */
  function update(dt) {
    dt = Math.min(dt, 0.05);
    const lc = LEVELS[level - 1];
    /* Base speed = 38% screen-width/s × level multiplier */
    const spd = cw * 0.38 * lc.speedMult * (spdBoost > 0 ? 1.38 : 1);

    /* Timers */
    if (!tutActive && hitCooldown > 0)
      hitCooldown -= dt; /* don't count down during tutorial */
    if (graceTimer > 0) {
      graceTimer -= dt;
      if (graceTimer < 0) graceTimer = 0;
    }
    if (immunoTimer > 0) {
      immunoTimer -= dt;
      if (immunoTimer <= 0) {
        immunoTimer = 0;
        PunchAudio.sfx.hit();
      }
    }
    if (magnetTimer > 0) magnetTimer -= dt;
    if (spdBoost > 0) spdBoost -= dt;

    if (!tutActive || obsBeaten > 0)
      score += Math.floor(spd * dt * 0.35 + level * dt * 0.5);

    /* Parallax */
    bgX[0] = (bgX[0] + spd * 0.18 * dt) % (cw * 1.5);
    bgX[1] = (bgX[1] + spd * 0.45 * dt) % cw;
    bgX[2] = (bgX[2] + spd * 0.84 * dt) % cw;

    /* Punch physics */
    if (P.sliding) {
      P.slideTimer -= dt;
      if (P.slideTimer <= 0) P.sliding = false;
    }
    P.vy += GR * ch * dt;
    const ny = pY() + P.vy * dt,
      gr = pGr();
    if (ny >= gr) {
      P.yFrac = P.grFrac;
      P.vy = 0;
      P.jumping = false;
      P.jumpCount = 0;
    } else P.yFrac = ny / ch;
    P.animTick += dt;
    if (P.animTick > 0.1) {
      P.animTick = 0;
      P.animFrame = (P.animFrame + 1) % 4;
    }

    /* Spawning (gated during tutorial) */
    if (!tutActive || obsBeaten > 0) {
      obsCD -= dt;
      if (obsCD <= 0 && obstacles.filter((o) => !o.isTut).length < 6) {
        spawnObs();
        const prog = obsBeaten / obsNeeded;
        const mn = Math.max(0.32, 1.0 - level * 0.06 - prog * 0.26),
          mx = Math.max(0.62, 1.65 - level * 0.07 - prog * 0.34);
        obsCD = mn + Math.random() * (mx - mn);
      }
      colCD -= dt;
      if (colCD <= 0) {
        spawnGem();
        colCD = 0.72 + Math.random() * 0.76;
      }
    }

    /* Tutorial obstacles move slower */
    const tutSpd = spd * 0.36;

    /* Move obstacles */
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i],
        os = o.isTut ? tutSpd : spd;
      o.x -= os * dt;
      o.animT += dt;
      o.wobble = Math.sin(o.animT * 5.5) * 0.07;
      if (o.bobAmp > 0)
        o.y = o.baseY + Math.sin(o.animT * o.bobFreq) * o.bobAmp;

      /* Arrow tracking for tutorial obstacles */
      if (o.isTut && !o.passed && state === "tutorial") {
        const arrX = o.x + o.w / 2;
        /* Arrow above the obstacle's topmost point */
        const topY = o.villain.duck
          ? o.y - o.h - ch * 0.08
          : o.y - o.h - ch * 0.08;
        tutShowArr(arrX, Math.max(50, topY), o.villain.duck ? "⬇️" : "⬆️");
      }

      /* Passed */
      if (!o.passed && o.x + o.w < px()) {
        o.passed = true;
        if (!o.isTut) {
          obsBeaten++;
          score += 12 + level * 2;
          PunchAudio.sfx.mkPass();
          updateHUD();
          if (obsBeaten >= obsNeeded) {
            levelDone();
            return;
          }
        }
      }

      /* ─── COLLISION ────────────────────
         COMPLETELY SKIP collision during tutorial (hitCooldown=9999).
         After tutorial ends a 10s grace period fades in (graceTimer).
         Vine / swinger: leaf cluster at bottom, 30% of height.
         Ground obs: 12% horizontal shrink for forgiveness.
      */
      if (hitCooldown <= 0 && graceTimer <= 0) {
        const hit = pHit();
        let ox, ow2, oy, oh;
        if (o.villain.duck) {
          /* Vine: leaf zone. ob.y IS the leaf bottom.
             Danger zone: from ob.y-h*0.30 (top of leaves) to ob.y (leaf bottom). */
          ox = o.x - o.w * 0.15;
          ow2 = o.w * 1.3;
          oy = o.y - o.h * 0.3;
          oh = o.h * 0.3;
          //oy=o.y-o.h*.18; oh=o.h*.18;

          oy = o.y - o.h * 0.18;
          oh = o.h * 0.18;
        } else {
          const mx = o.w * 0.12;
          ox = o.x + mx;
          ow2 = o.w - mx * 2;
          oy = o.y - o.h;
          oh = o.h;
        }
        if (
          hit.x < ox + ow2 &&
          hit.x + hit.w > ox &&
          hit.y < oy + oh &&
          hit.y + hit.h > oy
        ) {
          takeDmg(o.villain);
        }
      }
      if (o.x < -o.w * 2) obstacles.splice(i, 1);
    }

    /* Move gems */
    for (let i = collectibles.length - 1; i >= 0; i--) {
      const c = collectibles[i];
      c.x -= spd * dt;
      if (magnetTimer > 0) {
        const dx = px() + pW() / 2 - c.x,
          dy = pY() - pH() * 0.5 - c.y;
        const str = 14 + (8 - magnetTimer) * 2;
        c.x += dx * str * dt;
        c.y += dy * str * dt;
      }
      if (!c.collected) {
        const dx = px() + pW() / 2 - c.x,
          dy = pY() - pH() * 0.5 - c.y;
        if (Math.hypot(dx, dy) < c.r + pW() * 0.52) {
          c.collected = true;
          collectGem(c);
        }
      }
      if (c.x < -60) collectibles.splice(i, 1);
    }

    /* Particles */
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 450 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    updateHUD();
  }

  /* ═══════════════════════════════════════
     RENDER
     ═══════════════════════════════════════ */
  const BGT = {
    zoo: {
      top: "#12263a",
      mid: "#0d1f2d",
      gnd: "#5a4a22",
      gnd2: "#3a2a0e",
      acc: "#8b5e3c",
    },
    bamboo: {
      top: "#0a2016",
      mid: "#061410",
      gnd: "#3a5a22",
      gnd2: "#1e300e",
      acc: "#4a7a3a",
    },
    river: {
      top: "#0a1428",
      mid: "#071018",
      gnd: "#1e3a4a",
      gnd2: "#0a1a2a",
      acc: "#3a6a8a",
    },
    ruins: {
      top: "#1c1208",
      mid: "#140d05",
      gnd: "#4a3a22",
      gnd2: "#2a1e10",
      acc: "#7a6a4a",
    },
    mushroom: {
      top: "#1a0a1a",
      mid: "#120812",
      gnd: "#4a2a4a",
      gnd2: "#2a1220",
      acc: "#8a3a8a",
    },
    cave: {
      top: "#06060e",
      mid: "#04040c",
      gnd: "#1e1e2e",
      gnd2: "#0c0c1e",
      acc: "#3a3a7a",
    },
    volcano: {
      top: "#200800",
      mid: "#180500",
      gnd: "#4a2010",
      gnd2: "#2a0e08",
      acc: "#ff5500",
    },
    moon: {
      top: "#08082a",
      mid: "#05051a",
      gnd: "#1e1e3e",
      gnd2: "#0c0c22",
      acc: "#6a6aaa",
    },
    storm: {
      top: "#060608",
      mid: "#040408",
      gnd: "#1e1e0c",
      gnd2: "#0c0c06",
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
    const lc = LEVELS[level - 1],
      b = BGT[lc.bg] || BGT.zoo,
      t = Date.now() * 0.001;
    const sg = ctx.createLinearGradient(0, 0, 0, ch);
    sg.addColorStop(0, b.top);
    sg.addColorStop(0.65, b.mid);
    sg.addColorStop(1, b.gnd);
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 30; i++) {
      ctx.globalAlpha = 0.25 + 0.7 * Math.abs(Math.sin(t * 0.5 + i * 0.9));
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(
        (i * 139 + level * 23) % cw,
        (i * 83 + 17) % (ch * 0.52),
        i % 4 === 0 ? 1.6 : 0.9,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (["cave", "moon", "storm", "final"].includes(lc.bg)) {
      ctx.save();
      ctx.shadowColor = "#ffd16666";
      ctx.shadowBlur = ch * 0.07;
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(cw * 0.84, ch * 0.12, ch * 0.065, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawAtm(lc.bg, b, t);
    ctx.globalAlpha = 0.52;
    for (let i = 0; i < 8; i++) {
      const tx =
        (((i / 8) * cw * 1.4 + bgX[0] * 0.38) % (cw * 1.5)) - cw * 0.06;
      drawPiece(tx, pGr(), ch * (0.36 + (i % 3) * 0.07), lc.bg);
    }
    ctx.fillStyle = "rgba(0,0,0,.5)";
    for (let i = 0; i < 5; i++) {
      const tx =
        (((i / 5) * cw * 1.2 + bgX[1] * 0.68) % (cw * 1.2)) - cw * 0.06;
      drawPiece(tx, pGr(), ch * (0.22 + (i % 2) * 0.06), lc.bg);
    }
    ctx.globalAlpha = 1;
    const gg = ctx.createLinearGradient(0, pGr(), 0, ch);
    gg.addColorStop(0, b.gnd);
    gg.addColorStop(1, b.gnd2);
    ctx.fillStyle = gg;
    ctx.fillRect(0, pGr(), cw, ch - pGr());
    ctx.strokeStyle = b.acc;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, pGr());
    ctx.lineTo(cw, pGr());
    ctx.stroke();
    ctx.strokeStyle = b.acc + "44";
    ctx.lineWidth = 1.2;
    const mk = cw * 0.1,
      off = bgX[2] % mk;
    for (let x = -off; x < cw + mk; x += mk) {
      ctx.beginPath();
      ctx.moveTo(x, pGr() + ch * 0.028);
      ctx.lineTo(x + mk * 0.28, pGr() + ch * 0.028);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = "white";
    ctx.font = `bold ${ch * 0.09}px Boogaloo`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(lc.emoji + " " + lc.name.toUpperCase(), cw / 2, ch * 0.52);
    ctx.globalAlpha = 1;
    ctx.textBaseline = "alphabetic";
  }
  function drawAtm(bg, b, t) {
    if (bg === "bamboo") {
      for (let i = 0; i < 8; i++) {
        const bx = (((i / 8) * cw * 1.1 + bgX[0] * 0.22) % (cw * 1.1)) - 20,
          sw = Math.sin(t * 0.95 + i * 1.3) * ch * 0.013;
        ctx.strokeStyle = "rgba(60,140,50,.52)";
        ctx.lineWidth = cw * 0.006;
        ctx.beginPath();
        ctx.moveTo(bx + sw * 0.4, 0);
        ctx.quadraticCurveTo(
          bx + sw * 1.8,
          ch * 0.3,
          bx + sw * 0.8,
          pGr() * 0.9,
        );
        ctx.stroke();
        ctx.strokeStyle = "rgba(80,170,60,.32)";
        ctx.lineWidth = cw * 0.003;
        for (let j = 1; j < 4; j++) {
          const ly = ch * (0.18 + j * 0.17);
          ctx.beginPath();
          ctx.moveTo(bx + sw * 0.6, ly);
          ctx.lineTo(bx + sw * 0.6 + cw * 0.05, ly - ch * 0.04);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(bx + sw * 0.6, ly);
          ctx.lineTo(bx + sw * 0.6 - cw * 0.04, ly - ch * 0.03);
          ctx.stroke();
        }
      }
    }
    if (bg === "volcano") {
      const lg = ctx.createLinearGradient(0, pGr() - ch * 0.18, 0, pGr());
      lg.addColorStop(0, "transparent");
      lg.addColorStop(1, "rgba(255,50,0,.16)");
      ctx.fillStyle = lg;
      ctx.fillRect(0, pGr() - ch * 0.18, cw, ch * 0.18);
      ctx.fillStyle = "rgba(255,80,0,.14)";
      for (let i = 0; i < 7; i++) {
        const fx = ((i / 7) * cw + bgX[2] * 0.4) % cw,
          fy = pGr() - Math.abs(Math.sin(t * 3 + i)) * ch * 0.09;
        ctx.beginPath();
        ctx.ellipse(fx, fy, cw * 0.013, ch * 0.042, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (bg === "storm" && Math.floor(t * 3) % 19 === 0) {
      ctx.fillStyle = "rgba(220,220,60,.06)";
      ctx.fillRect(0, 0, cw, ch);
    }
    if (bg === "final") {
      const fg = ctx.createRadialGradient(
        cw * 0.5,
        pGr(),
        0,
        cw * 0.5,
        pGr(),
        cw * 0.42,
      );
      fg.addColorStop(0, "rgba(255,80,120,.13)");
      fg.addColorStop(1, "transparent");
      ctx.fillStyle = fg;
      ctx.fillRect(0, ch * 0.28, cw, ch * 0.72);
    }
  }
  function drawPiece(x, baseY, h, bg) {
    ctx.fillStyle = "rgba(0,0,0,.5)";
    if (bg === "ruins" || bg === "cave") {
      ctx.fillRect(x - cw * 0.008, baseY - h, cw * 0.016, h);
      ctx.fillRect(x - cw * 0.019, baseY - h, cw * 0.038, h * 0.08);
    } else {
      ctx.fillRect(x - cw * 0.005, baseY - h * 0.44, cw * 0.01, h * 0.44);
      ctx.beginPath();
      ctx.arc(x, baseY - h * 0.52, h * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ─── Draw Punch ─────────────────────── */
  function drawPunch() {
    const x = px(),
      y = pY(),
      w = pW(),
      h = pH(),
      cx = x + w / 2,
      t = Date.now() * 0.001;
    const bob = P.jumping ? 0 : Math.sin(t * 3.8) * (ch * 0.006);
    const flash =
      hitCooldown > 0 &&
      hitCooldown < 1.3 &&
      Math.floor(Date.now() / 75) % 2 === 0;
    const imm = immunoTimer > 0;
    ctx.save();
    ctx.translate(cx, y + bob);
    if (P.sliding) ctx.scale(1, 0.4); /* squash matches 35% hitbox height */
    if (flash) ctx.globalAlpha = 0.28;
    if (imm) {
      ctx.shadowColor = "#c084fc";
      ctx.shadowBlur = w * 0.8;
    }
    const bc = imm ? "#d0a0ff" : "#c47a2e",
      fc = imm ? "#f0d0ff" : "#e8a96a";
    /* Shadow */
    ctx.globalAlpha = flash ? 0.06 : imm ? 0.42 : 0.2;
    ctx.fillStyle = imm ? "#c084fc" : "#000";
    ctx.beginPath();
    ctx.ellipse(0, 3, w * 0.55, h * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = flash ? 0.28 : 1;
    /* Body */
    ctx.fillStyle = bc;
    ctx.beginPath();
    ctx.roundRect(-w * 0.44, -h, w * 0.88, h * 0.62, w * 0.22);
    ctx.fill();
    ctx.fillStyle = fc;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.68, w * 0.34, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    /* Head */
    const hcx = 0,
      hcy = -h * 0.8,
      hr = w * 0.48;
    ctx.fillStyle = bc;
    ctx.beginPath();
    ctx.arc(hcx, hcy, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fc;
    ctx.beginPath();
    ctx.ellipse(hcx, hcy + hr * 0.22, hr * 0.78, hr * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    /* Ears */
    ctx.fillStyle = bc;
    ctx.beginPath();
    ctx.arc(hcx - hr * 0.95, hcy - hr * 0.26, hr * 0.38, 0, Math.PI * 2);
    ctx.arc(hcx + hr * 0.95, hcy - hr * 0.26, hr * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = imm ? "#f5e0ff" : "#e8c09a";
    ctx.beginPath();
    ctx.arc(hcx - hr * 0.95, hcy - hr * 0.26, hr * 0.22, 0, Math.PI * 2);
    ctx.arc(hcx + hr * 0.95, hcy - hr * 0.26, hr * 0.22, 0, Math.PI * 2);
    ctx.fill();
    /* Eyes */
    const er = hr * 0.27;
    ctx.fillStyle = "#1a0a2e";
    ctx.beginPath();
    ctx.arc(hcx - hr * 0.35, hcy - hr * 0.12, er, 0, Math.PI * 2);
    ctx.arc(hcx + hr * 0.35, hcy - hr * 0.12, er, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a1e80";
    ctx.beginPath();
    ctx.arc(hcx - hr * 0.35, hcy - hr * 0.12, er * 0.72, 0, Math.PI * 2);
    ctx.arc(hcx + hr * 0.35, hcy - hr * 0.12, er * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(hcx - hr * 0.27, hcy - hr * 0.19, er * 0.38, 0, Math.PI * 2);
    ctx.arc(hcx + hr * 0.42, hcy - hr * 0.19, er * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.beginPath();
    ctx.arc(hcx - hr * 0.22, hcy - hr * 0.23, er * 0.18, 0, Math.PI * 2);
    ctx.arc(hcx + hr * 0.47, hcy - hr * 0.23, er * 0.18, 0, Math.PI * 2);
    ctx.fill();
    /* Brows */
    const braise = P.jumping ? hr * 0.12 : 0;
    ctx.strokeStyle = "#1a0a2e";
    ctx.lineWidth = hr * 0.14;
    ctx.beginPath();
    ctx.moveTo(hcx - hr * 0.65, hcy - hr * 0.4 - braise);
    ctx.lineTo(hcx - hr * 0.08, hcy - hr * 0.3 - braise);
    ctx.moveTo(hcx + hr * 0.08, hcy - hr * 0.4 - braise);
    ctx.lineTo(hcx + hr * 0.65, hcy - hr * 0.3 - braise);
    ctx.stroke();
    /* Mouth */
    ctx.strokeStyle = "#1a0a2e";
    ctx.lineWidth = hr * 0.12;
    ctx.beginPath();
    ctx.arc(hcx, hcy + hr * 0.44, hr * 0.28, 0.18, Math.PI - 0.18);
    ctx.stroke();
    /* Blush */
    ctx.fillStyle = "rgba(220,100,40,.4)";
    ctx.beginPath();
    ctx.ellipse(
      hcx - hr * 0.7,
      hcy + hr * 0.06,
      hr * 0.22,
      hr * 0.13,
      0,
      0,
      Math.PI * 2,
    );
    ctx.ellipse(
      hcx + hr * 0.7,
      hcy + hr * 0.06,
      hr * 0.22,
      hr * 0.13,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    /* Plushie */
    const pr2 = w * 0.28,
      px2 = -w * 0.58,
      py2 = -h * 0.65;
    ctx.shadowColor = "#ff4d6d";
    ctx.shadowBlur = pr2 * 1.4;
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
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath();
    ctx.arc(px2 - pr2 * 0.74, py2 - pr2 * 0.72, pr2 * 0.32, 0, Math.PI * 2);
    ctx.arc(px2 + pr2 * 0.55, py2 - pr2 * 0.75, pr2 * 0.32, 0, Math.PI * 2);
    ctx.fill();
    /* Feather tufts */
    if (!P.sliding) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = imm ? "#e0c0ff" : "#ffd166";
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + t * 0.9;
        ctx.beginPath();
        ctx.arc(
          hcx + Math.cos(ang) * hr * 1.3,
          hcy + Math.sin(ang) * hr * 0.5,
          hr * 0.1,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    /* Legs */
    const ls = P.jumping ? h * 0.1 : Math.sin(t * 12) * h * 0.1;
    ctx.fillStyle = bc;
    ctx.save();
    ctx.translate(-w * 0.18, -h * 0.2);
    ctx.rotate(ls * 0.04);
    ctx.beginPath();
    ctx.roundRect(-w * 0.16, 0, w * 0.32, h * 0.25, w * 0.1);
    ctx.fill();
    ctx.fillStyle = "#9a5a1e";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.26, w * 0.22, h * 0.07, ls * 0.02, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = bc;
    ctx.save();
    ctx.translate(w * 0.18, -h * 0.2);
    ctx.rotate(-ls * 0.04);
    ctx.beginPath();
    ctx.roundRect(-w * 0.16, 0, w * 0.32, h * 0.25, w * 0.1);
    ctx.fill();
    ctx.fillStyle = "#9a5a1e";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.26, w * 0.22, h * 0.07, -ls * 0.02, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  /* Font-size helper — clamps so text is never too tiny or too huge */
  function fz(base) {
    return Math.max(11, Math.min(base, 38));
  }

  /* ─── Draw Obstacle ─────────────────── */
  function drawOb(o) {
    ctx.save();
    const v = o.villain,
      cx = o.x + o.w / 2,
      bot = o.y;
    ctx.translate(cx, 0);
    ctx.rotate(o.wobble);

    if (o.type === "vine" || o.type === "swinger") {
      const sway = Math.sin(o.animT * 2.2) * o.w * 1.5;
      ctx.strokeStyle = "#3a7a1a";
      ctx.lineWidth = o.w * 0.55;
      ctx.beginPath();
      ctx.moveTo(sway * 0.3, 0);
      ctx.quadraticCurveTo(sway, bot * 0.5, sway * 0.8, bot);
      ctx.stroke();
      ctx.strokeStyle = "#2d6014";
      ctx.lineWidth = o.w * 0.44;
      for (let s = 0; s < 4; s++) {
        const sy = (s / 4) * bot;
        ctx.beginPath();
        ctx.arc(sway * (0.3 + (0.5 * s) / 4), sy, o.w * 0.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      /* Leaf cluster — THIS is the collision zone. Drawn at ob.y (= leaf bottom).
         The visual cluster fills from ob.y upward by ~30% of vine height. */
      const leafY = bot; /* bot = ob.y = leaf bottom position */
      ctx.fillStyle = "#2d8a1a";
      ctx.shadowColor = "#00ff0022";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(sway * 0.8, leafY, o.w * 1.6, o.h * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3da03d";
      ctx.beginPath();
      ctx.ellipse(
        sway * 0.8 - o.w * 0.55,
        leafY - o.h * 0.04,
        o.w * 1.1,
        o.h * 0.14,
        -0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(
        sway * 0.8 + o.w * 0.55,
        leafY - o.h * 0.04,
        o.w * 1.1,
        o.h * 0.14,
        0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.font = `bold ${fz(o.w * 1.1)}px Boogaloo`;
      ctx.textAlign = "center";
      ctx.fillText("DUCK!", 0, leafY - o.h * 0.44);
    } else if (o.type === "rock" || o.type === "boulder") {
      const ry = bot - o.h,
        bce = Math.abs(Math.sin(o.animT * 5)) * o.h * 0.04,
        sqY = 1 + bce / o.h;
      ctx.save();
      ctx.scale(1, sqY);
      const rg = ctx.createRadialGradient(
        -o.w * 0.22,
        (ry + o.h * 0.3) / sqY,
        0,
        0,
        (ry + o.h * 0.55) / sqY,
        o.w * 0.7,
      );
      rg.addColorStop(0, "#b0b8c4");
      rg.addColorStop(1, v.color);
      ctx.fillStyle = rg;
      ctx.shadowColor = "rgba(0,0,0,.5)";
      ctx.shadowBlur = o.w * 0.35;
      ctx.beginPath();
      ctx.roundRect(-o.w / 2, ry / sqY, o.w, o.h, o.w * 0.22);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(0,0,0,.35)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-o.w * 0.12, ry / sqY + o.h * 0.2);
      ctx.lineTo(o.w * 0.22, ry / sqY + o.h * 0.65);
      ctx.stroke();
      ctx.fillStyle = "#1a0a2e";
      ctx.beginPath();
      ctx.arc(-o.w * 0.22, ry / sqY + o.h * 0.28, o.w * 0.1, 0, Math.PI * 2);
      ctx.arc(o.w * 0.22, ry / sqY + o.h * 0.28, o.w * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.font = `bold ${fz(o.w * 0.72)}px Boogaloo`;
      ctx.textAlign = "center";
      ctx.fillText("JUMP!", 0, ry - o.w * 0.38);
    } else if (o.type === "peel") {
      const py3 = bot - o.h;
      ctx.fillStyle = "#fdd835";
      ctx.beginPath();
      ctx.ellipse(
        0,
        py3 + o.h * 0.5,
        o.w * 0.5,
        o.h * 0.38,
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
      ctx.font = `${fz(o.w * 0.72)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🍌", 0, py3 - o.h * 0.22);
      ctx.textBaseline = "alphabetic";
    } else if (o.type === "spike") {
      for (let s = -1; s <= 1; s++) {
        ctx.fillStyle = s % 2 === 0 ? "#ef4444" : "#ff7777";
        ctx.shadowColor = "#ff0000";
        ctx.shadowBlur = o.w * 0.35;
        ctx.beginPath();
        ctx.moveTo(s * o.w * 0.42, bot);
        ctx.lineTo(s * o.w * 0.42 - o.w * 0.22, bot - o.h);
        ctx.lineTo(s * o.w * 0.42 + o.w * 0.22, bot - o.h);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.font = `bold ${fz(o.w * 0.72)}px Boogaloo`;
      ctx.textAlign = "center";
      ctx.fillText("HIGH!", 0, bot - o.h - o.w * 0.4);
    } else {
      const mh = o.h,
        mw = o.w,
        bob2 = Math.sin(o.animT * 5) * mh * 0.06,
        gy = bot - mh + bob2,
        sc = o.type === "bigbobo" ? 1.28 : 1;
      ctx.save();
      if (o.type === "slider") ctx.scale(1, 0.68);
      const bg2 = ctx.createLinearGradient(0, gy, 0, gy + mh * sc);
      bg2.addColorStop(0, v.color);
      bg2.addColorStop(1, v.color + "aa");
      ctx.fillStyle = bg2;
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
      const hcx3 = o.type === "slider" ? -mw * 0.14 : 0,
        hcyr = gy - mh * 0.3 * sc,
        hrr = mw * 0.38 * sc;
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.arc(hcx3, hcyr, hrr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.24)";
      ctx.beginPath();
      ctx.ellipse(
        hcx3,
        hcyr + hrr * 0.22,
        hrr * 0.68,
        hrr * 0.56,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(hcx3 - hrr * 0.36, hcyr - hrr * 0.1, hrr * 0.28, 0, Math.PI * 2);
      ctx.arc(hcx3 + hrr * 0.36, hcyr - hrr * 0.1, hrr * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a0a2e";
      ctx.beginPath();
      ctx.arc(hcx3 - hrr * 0.3, hcyr - hrr * 0.06, hrr * 0.18, 0, Math.PI * 2);
      ctx.arc(hcx3 + hrr * 0.42, hcyr - hrr * 0.06, hrr * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1a0a2e";
      ctx.lineWidth = hrr * 0.18;
      ctx.beginPath();
      ctx.moveTo(hcx3 - hrr * 0.65, hcyr - hrr * 0.46);
      ctx.lineTo(hcx3 - hrr * 0.06, hcyr - hrr * 0.3);
      ctx.moveTo(hcx3 + hrr * 0.06, hcyr - hrr * 0.46);
      ctx.lineTo(hcx3 + hrr * 0.65, hcyr - hrr * 0.3);
      ctx.stroke();
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.arc(hcx3 - hrr * 1.02, hcyr - hrr * 0.2, hrr * 0.38, 0, Math.PI * 2);
      ctx.arc(hcx3 + hrr * 1.02, hcyr - hrr * 0.2, hrr * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `bold ${fz(hrr * 0.72)}px Boogaloo`;
      ctx.textAlign = "center";
      const nmW = ctx.measureText(v.name).width;
      ctx.fillStyle = "rgba(0,0,0,.72)";
      ctx.beginPath();
      ctx.roundRect(
        hcx3 - nmW / 2 - 5,
        hcyr - hrr * 1.55,
        nmW + 10,
        hrr * 0.72,
        4,
      );
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.fillText(v.name, hcx3, hcyr - hrr * 0.94);
      ctx.fillStyle = "rgba(255,255,255,.88)";
      ctx.font = `bold ${fz(mw * 0.6)}px Boogaloo`;
      ctx.fillText(
        v.action === "HIGH" ? "HIGH JUMP!" : v.action + "!",
        0,
        gy - mh * sc - mw * 0.52,
      );
      ctx.restore();
    }
    ctx.restore();
  }

  function drawGems() {
    const t = Date.now() * 0.001;
    for (const c of collectibles) {
      if (c.collected) continue;
      const bob = Math.sin(t * 3 + c.bobOff) * (ch * 0.016);
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      if (c.gem.rarity < 0.05) {
        ctx.shadowColor = c.gem.color;
        ctx.shadowBlur = c.r * 1.6;
      }
      if (c.gem.id === "orb") {
        ctx.strokeStyle = "#c084fc";
        ctx.lineWidth = c.r * 0.35;
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 4);
        ctx.beginPath();
        ctx.arc(0, 0, c.r * 1.65, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = c.gem.color;
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = `${c.r * 1.95}px serif`;
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
    drawGems();
    for (const o of obstacles) drawOb(o);
    drawPunch();
    drawParticles();
  }

  /* Win scene */
  let winRaf = 0;
  function renderWin() {
    cancelAnimationFrame(winRaf);
    const wc = document.getElementById("win-canvas");
    if (!wc) return;
    const wx = wc.getContext("2d"),
      W = wc.width,
      H = wc.height;
    let wf = 0;
    function frame() {
      wf++;
      wx.clearRect(0, 0, W, H);
      const bg3 = wx.createLinearGradient(0, 0, 0, H);
      bg3.addColorStop(0, "#050110");
      bg3.addColorStop(1, "#1a0a2e");
      wx.fillStyle = bg3;
      wx.fillRect(0, 0, W, H);
      for (let i = 0; i < 25; i++) {
        wx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(wf * 0.04 + i * 1.4));
        wx.fillStyle = "white";
        wx.beginPath();
        wx.arc((i * 97) % W, (i * 51) % (H * 0.5), 1.2, 0, Math.PI * 2);
        wx.fill();
      }
      wx.globalAlpha = 1;
      wx.fillStyle = "#ffd166";
      wx.shadowColor = "#ffd16655";
      wx.shadowBlur = 10;
      wx.beginPath();
      wx.arc(W * 0.83, H * 0.18, 14, 0, Math.PI * 2);
      wx.fill();
      wx.shadowBlur = 0;
      wx.fillStyle = "#1a0a3e";
      wx.fillRect(0, H * 0.68, W, H * 0.32);
      wx.strokeStyle = "#2d1b69";
      wx.lineWidth = 2;
      wx.beginPath();
      wx.moveTo(0, H * 0.68);
      wx.lineTo(W, H * 0.68);
      wx.stroke();
      const br = Math.sin(wf * 0.06) * 0.55,
        cxw = W * 0.5,
        cyw = H * 0.72;
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
      wx.strokeStyle = "#1a0a2e";
      wx.lineWidth = 2;
      wx.beginPath();
      wx.arc(13, -20, 5, 0.1, Math.PI - 0.1);
      wx.stroke();
      wx.beginPath();
      wx.arc(27, -20, 5, 0.1, Math.PI - 0.1);
      wx.stroke();
      wx.beginPath();
      wx.arc(20, -12, 3.5, 0.2, Math.PI - 0.2);
      wx.stroke();
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

  /* ─── MAIN LOOP ─────────────────────── */
  function loop(ts) {
    if (state !== "playing" && state !== "tutorial") return;
    const dt = Math.min((ts - lastTS) / 1000, 0.05);
    lastTS = ts;
    if (tutPaused) {
      renderFrame();
      animId = requestAnimationFrame(loop);
      return;
    }
    update(dt);
    renderFrame();
    animId = requestAnimationFrame(loop);
  }

  /* ─── INIT ──────────────────────────── */
  function init() {
    canvas = document.getElementById("cv");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    loadP();
    resize();
    window.addEventListener("resize", resize);
    bindInput();
    score = 0;
    level = 1;
    lives = 3;
    gemsCollected = 0;
    gemsTotal = 0;
    gemLog = {};
    immunoTimer = 0;
    magnetTimer = 0;
    hitCooldown = 0;
    spdBoost = 0;
    obstacles = [];
    collectibles = [];
    particles = [];
    bgX = [0, 0, 0];
    startTime = Date.now();
    devMode = false;
    try {
      const n = (+localStorage.getItem("pm_plays") || 0) + 1;
      localStorage.setItem("pm_plays", n);
    } catch {}
    initLevel(1);
  }

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
