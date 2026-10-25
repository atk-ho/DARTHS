# 🎯 DARTHS — Darts Scoreboard & Tournament Manager

**DARTHS** is a mobile-friendly darts scoreboard and tournament web app with live spectator displays, tournament brackets, player statistics, and customizable audio.

**Live website:** https://atk-ho.github.io/DARTHS/  
**Platform:** Web / installable Progressive Web App (PWA)  
**License:** MIT

> **Status:** Active development. Test match results, tournament advancement, and Firebase sharing on your own devices before running an official event.

## Features

### 🎮 Casual Games
- Individual and team match setup
- Configurable starting score, sets, legs, and checkout rules
- Score entry, turn tracking, undo, and match results
- Player history and statistics saved in the browser

### 🏆 Tournaments
- **Standard Elimination:** head-to-head (1v1) matches with BYEs where needed
- **Knockout Elimination:** 2–4 players in one match, one winner advances, no BYEs
- Participant selection and saved rosters
- Connected bracket paths, match preparation, and winner advancement
- Host-controlled countdown and manual throwing order
- Tournament winner announcements and celebrations

### 📺 Live Spectator Mode
- Share a live viewing link from the Host
- Firebase Realtime Database synchronization
- Host-selected Welcome, Bracket, Upcoming Match, Live Scoreboard, Player Statistics, and Break displays
- Responsive presentation for phones, tablets, monitors, and TVs
- Fullscreen option on supported browsers

### 🔊 Sound & Voice
- Built-in synthesized DARTHS themes for welcome, countdown, breaks, and championship celebrations
- Effects for throws, busts, 180s, leg wins, set wins, and match wins
- Voice score and winner announcements (browser speech synthesis)
- Event-specific volume, looping, and sound selection
- Optional custom audio files; locally uploaded files do **not** automatically sync to spectators
- Spectator audio may require an **Enable Audio** tap due to browser autoplay restrictions

### ⚙️ Personalization
- Host and spectator layout options
- Responsive interface and PWA installation
- Browser-local settings and game data

## Getting Started

### Use the hosted app

Open **https://atk-ho.github.io/DARTHS/** in a modern browser. On supported mobile browsers, use **Add to Home Screen** to install it like an app.

### Host your own copy

1. Upload the project files to the root of a GitHub Pages repository.
2. Create a Firebase project with **Anonymous Authentication** enabled.
3. Create a **Realtime Database** and set the correct project configuration in `firebase-config.js`.
4. Review the supplied `database.rules.json` / `firebase-rules.json` and **merge only the required DARTHS rules** into your database. Do not overwrite unrelated database rules.
5. Deploy with GitHub Pages, then hard-refresh the Host and Spectator browsers.
6. Start a match or tournament, choose **Go Live & Share**, and open the generated link on a separate device.

**Security:** Live spectator links should expose only public match information. Firebase access rules must be configured carefully. Do not store private credentials or sensitive personal information in shared match records.

## How Tournament Play Works

1. Create a tournament and select **Standard Elimination** or **Knockout Elimination**.
2. Choose participants and match settings.
3. Open the bracket and optionally start the live spectator broadcast.
4. Select a match, prepare the countdown, or skip ahead when ready.
5. Manually determine throwing order and start scoring.
6. Record the result; the winner advances and the tournament bracket updates.
7. Continue until a tournament champion is declared.

## Data and Connectivity

- Local game data, settings, and uploaded audio are stored on the current device/browser.
- Clearing browser storage may remove locally saved records and custom audio.
- **Live spectator synchronization requires internet access and correctly configured Firebase permissions.**
- The installed PWA may cache older assets; reload or reopen after deploying updates.

## Project Files

| File | Purpose |
| --- | --- |
| `index.html` | Main DARTHS application and Host interface |
| `live-sync.js` | Firebase live sharing and spectator rendering |
| `firebase-config.js` | Firebase project configuration |
| `database.rules.json`, `firebase-rules.json` | Reference Realtime Database rules |
| `tournament.css`, `tournament-create-fix.css` | Tournament presentation and creation styles |
| `darths-audio.js`, `darths-audio.css` | Music, sound effects, and audio settings |
| `layout-editor.js`, `layout-editor.css` | Display layout customization |
| `settings.js`, `settings.css` | Additional settings UI |
| `sw.js`, `manifest.webmanifest` | PWA caching and installation |

## Known Limitations

- Browser autoplay restrictions can prevent spectator audio until the viewer interacts with the page.
- Custom audio uploaded to one device is not automatically transferred to another; use a hosted HTTPS audio URL for spectator playback.
- Live sharing depends on Firebase Anonymous Authentication and compatible Realtime Database rules.
- The app is under active development; some combinations of match format, device rotation, and display mode may need further testing.

## Author and License

Developed by **Arthur Reguindin Jr.**  
Licensed under the [MIT License](LICENSE).
