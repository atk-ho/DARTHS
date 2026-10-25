# DARTHS Tournament Live / Responsive Bracket Patch

## Replace only these three website files
- `index.html`
- `live-sync.js`
- `tournament.css`

The patch is based on the previous DARTHS Bullseye BYEs `index.html` and tournament live-sync files. Keep your existing `firebase-config.js`, `settings.js`, `layout-editor.js`, `layout-editor.css`, other styles, icons and assets. Deploy to your GitHub Pages site and hard-refresh both devices.

## Firebase permission denied
1. Firebase Console → Authentication → Sign-in method → Anonymous → Enable.
2. Firebase Console → Realtime Database → Rules. **Merge** the `liveMatches` rules from `firebase-rules.json` into your existing rules. Do not replace other rules if other app features use them. Publish the rules.
3. Confirm `firebase-config.js` uses the exact Realtime Database URL for this Firebase project.
4. Firebase Realtime Database should have a `liveMatches` node; the Host must create the room by pressing Go Live. Spectators have read-only access to room records.

`firebase-rules.json` is a reference rules file for a database dedicated to this DARTHS live sharing feature. If you have other paths, merge only the `liveMatches` branch; do not overwrite existing application permissions.

## Flow
1. Tournament → Create → Bullseye BYEs (optional).
2. Go Live: spectators initially see a tournament welcome screen.
3. Host: Display Bracket. Spectators see the bracket before any match begins.
4. Host: Tap a bracket match → Start Match → confirm. The original Host scoring screen is used; spectator switches to the original live scorecards.
5. After match completion, spectators see the updated bracket; winning lines animate green.
6. Host can tap Welcome Screen / Display Bracket and copy the spectator URL any time while live.

## Notes
- Host bracket is touch-scrollable horizontally, including phone landscape. Spectator bracket is horizontally scrollable.
- The tournament bracket shows lines between rounds; completed winner paths animate green.
- The existing localStorage tournament data and layouts are not reset by this patch.
- This is a browser-ready patch with JavaScript syntax validation, **not** an end-to-end Firebase-tested release. Test on two devices before a real tournament.
- Firebase Realtime Database anonymous auth and public room-read rules are appropriate only for **public spectator information**; do not include sensitive personal information in shared game/tournament records.
