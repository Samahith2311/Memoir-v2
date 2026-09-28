# ☕ Memoir — Cozy Coffee Journal

> A cozy, premium digital journal web application built with vanilla HTML, CSS, and JavaScript. No frameworks, no libraries, no build tools, no backend, and no external dependencies. Runs 100% offline in your browser.

![Memoir Dashboard](https://raw.githubusercontent.com/Samahith2311/Memoir-v2/main/assets/memoir_dashboard.png)

---

## ✨ Features

- **☕ Coffee Mocha Aesthetic**: Rich warm tones, cream surfaces, Georgia serif headings, and subtle CSS-only paper texture.
- **🌙 Deep Espresso Dark Mode**: Seamless toggle between warm Coffee Mocha and night-time Deep Espresso themes with localStorage persistence.
- **🔥 Mindfulness & Day Streaks**: Dynamic calculation of consecutive journaling days (counts back from today or yesterday).
- **📅 Interactive Monthly Calendar**: Built-in calendar grid with entry indicators, today highlight, and quick entry navigation.
- **✨ Memories & Reflections**: Explore past thoughts, filter by mood (`Happy`, `Calm`, `Okay`, `Sad`, `Excited`), or discover a random memory with 🎲 Random Memory.
- **📊 Mood Distribution & Statistics**: Visual CSS bar charts showing mood proportions, weekly entry count, and your most common emotional rhythm.
- **🔍 Instant Multi-Field Search**: Real-time live search matching across journal notes, highlights, gratitude, moods, and dates.
- **💾 JSON Export & Backup**: Download your entire journal history at any time as `memoir-export-YYYY-MM-DD.json`.
- **📱 Fully Responsive**:
  - **Desktop (≥1100px)**: 3-column layout (Sidebar, Main Content, Entry Panel).
  - **Tablet (700–1099px)**: 2-column layout with stacked entry editor.
  - **Mobile (<700px)**: Fixed bottom navigation bar, 44px+ touch targets, and full-width forms.
- **🔒 Private & Local**: All data is stored strictly in your browser's `localStorage` (`memoir_entries`). No servers, no tracking, and full privacy.

---

## 🚀 Quick Start

No installation or build step required! Simply open `index.html` in any modern web browser:

```bash
# Clone the repository
git clone https://github.com/Samahith2311/Memoir-v2.git

# Navigate to the project directory
cd Memoir-v2

# Open index.html in your browser
# On Windows:
start index.html
# On macOS:
open index.html
# On Linux:
xdg-open index.html
```

---

## 📁 Project Structure

```
Memoir-v2/
├── index.html       # Semantic HTML5 markup, accessible forms, and native dialogs
├── style.css        # Responsive CSS styling, CSS variables, paper texture, and themes
├── script.js        # Vanilla JS logic: storage, stats, router, calendar, and UI renderers
└── README.md        # Documentation and overview
```

---

## 🎨 Design System

| Token | Coffee Mocha (Default) | Deep Espresso (Dark) |
|---|---|---|
| **App Background** | `#241C18` | `#120D0B` |
| **Card Surface** | `#FFF8ED` | `#201714` |
| **Primary Accent** | `#795548` | `#A47E70` |
| **Secondary Accent** | `#C89F7B` | `#D6B290` |
| **Borders** | `#E5D5C3` | `#382A24` |
| **Main Text** | `#30251F` | `#FFF8ED` |

---

## 📄 License

MIT License. Crafted with warm coffee and mindfulness.
