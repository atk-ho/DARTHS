# DARTHS v1.0.0 — GitHub Pages + Firebase

## Upload to GitHub
Extract this ZIP and upload its **contents** to `atk-ho/DARTHS` (repository root), including the `icons` folder. Enable GitHub Pages from `main` / `(root)`.

## Configure Firebase (required for sharing)
1. Create a Firebase project and register a Web app.
2. Create a **Realtime Database** in **locked mode**. Copy its URL.
3. Enable **Authentication > Sign-in method > Anonymous**.
4. In Firebase Realtime Database > Rules, replace the rules with the contents of `database.rules.json` and publish.
5. Edit `firebase-config.js`: paste your Firebase Web app config **including `databaseURL`**.
6. Commit the updated file to GitHub. Wait for GitHub Pages to deploy.
7. Open DARTHS on your phone, start a game, tap **Share**, and open the copied link on your laptop. Press F11.

Both devices need internet. The laptop scoreboard is read-only. Sharing links use random 36-character IDs; anyone with the link can view the match. The Firebase rules require anonymous sign-in and restrict writes to the original room owner. Firebase project quota and security rules still apply.

## Notes
- The original scorekeeper remains on the phone; the laptop opens the separate `?watch=...` view.
- Match state and history remain saved in phone localStorage.
- For live sharing to work, the owner must keep their phone online. Sharing is not available until Firebase is configured.
- A saved room is reused on the same phone until the site data is cleared. For privacy, share links only with intended spectators.
- The live sync integration has not been tested against your actual Firebase project; verify rules and full match flow before relying on it in a tournament.


## Live scoreboard sync fix

- Use **Share** on the phone to create the viewing link. Open it on the laptop.
- The phone now offers **↻ Refresh** to resend the complete current match.
- Dart changes are written to Firebase in order, including the third dart and completed turn.
- Both devices require an internet connection. Firebase Anonymous Authentication and Realtime Database rules must be enabled.
- The supplied `firebase-config.js` contains placeholders: add your own Firebase web app configuration before deploying.

