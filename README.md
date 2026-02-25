# Punchie 🐒💨

A fast-paced, mobile-first endless runner inspired by the Ichikawa **Punch monkey!!**  
Punchie blends classic arcade mechanics with modern UI polish, responsive design, and a carefully tuned difficulty curve — all without frameworks.

Punch runs. You react. Miss once, and it’s over.

![Punchh](https://github.com/user-attachments/assets/b917b323-76a5-49b9-b88d-dde1d22defc6)

**[▶ Live Demo →](https://punchie.vercel.app/)**

---

## 🎮 Gameplay Overview

- Endless runner with progressive difficulty
- Jump, duck, and **double-jump** mechanics
- Hanging obstacles that **require ducking**
- Flying obstacles that test timing and positioning
- Collectibles, score multipliers, and immunity pickups
- Interactive tutorial (Level 1)

---

## ⚙️ Tech Stack

No frameworks. No build tools. No abstractions.
Made with Web Audio API to procedurally generate Music and Sfx

This project intentionally avoids React / Next.js to keep:
- load times instant
- input latency minimal
- logic transparent and hackable

---

Most players will play on mobile — the game respects that.. kind of 😂

---

## 🧩 Project Structure
```
/
├── index.html   # Landing page
├── game.html    # Game canvas & HUD
├── game.js      # Core game engine (~2000 lines)
├── style.css    # Global styles & UI
└── about.html   # About page
```
