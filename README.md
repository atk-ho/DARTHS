# DARTHS — Darts Scoreboard PWA (v1.0.3)

Mobile scoring with Firebase Realtime Database live laptop spectator view, offline-capable PWA, player statistics, sound, and legal pages.

## Install / update

1. Back up your current GitHub repository and phone match data (Settings → Export data).
2. Upload **all files** from this ZIP to the **root** of `atk-ho/DARTHS`, keeping the `icons/` folder structure. Do not put the enclosing ZIP folder in the repo.
3. Firebase Console → Realtime Database → Rules: paste `database.rules.json` and Publish.
4. Firebase Authentication → Sign-in method → Anonymous: Enabled.
5. Wait for GitHub Pages deployment. Reload the phone and laptop pages; if installed as a PWA, fully close and reopen it to receive the updated service worker.
6. Start a new match, Share, and open the new link on laptop. The initial match is published immediately; an `iv` refresh follows after 3 seconds. A completed turn schedules a refresh after 2.5 seconds. Manual refresh increments `iv`.

## Firebase deletion

**No Firebase deletion is required.** The new `darths_live_room_v5_iv` localStorage key creates a fresh room. Old rooms can be deleted from Firebase → Realtime Database → Data → `liveMatches` *only if you no longer need their spectator links*. Do not delete the project, database, or Authentication users.

## Important notes

- `iv` is stored in Firebase but never displayed on the scoreboard.
- A spectator listener uses Firebase realtime events and a 5-second server read fallback. This can increase Firebase database reads; use within your Firebase quota.
- The `● LIVE` indicator means the spectator has received match data, not merely that the page loaded.
- `firebase-config.js` contains the Firebase web app configuration you supplied. Check its values against your own Firebase Console.
- `database.rules.json` is for pasting into Firebase Rules; GitHub Pages does not apply it automatically.
- Your player data and local match history remain in browser localStorage. Do not clear site data unless backed up.

## License

DARTHS original source code is available under the [MIT License](LICENSE). Third-party dependencies and assets retain their own licenses.

Copyright © 2026 Arthur Reguindin Jr.

### Hidden spectator IV indicator
A tiny `iv` counter sits immediately left of the LIVE status on the laptop scoreboard. It updates from Firebase but has `opacity: 0`, so it is invisible.
