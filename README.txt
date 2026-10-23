DARTHS Firebase setup (v1.0.0)

1. Replace the repository-root firebase-config.js with the file here.
2. Firebase Console > Realtime Database > Rules: paste the ENTIRE content of database.rules.json, then Publish.
   The JSON is a console paste, not automatically deployed merely by uploading it to GitHub.
3. Optionally replace repository-root database.rules.json so GitHub reflects the published rules.
4. Confirm Firebase Authentication > Sign-in method > Anonymous is enabled.
5. Wait for GitHub Pages deployment. Open DARTHS on phone, start a match, tap Share.
6. Open the link on a laptop and press F11 for full screen.

Note: the Realtime Database rules require an authenticated viewer who knows the random 36-character room ID. Anyone with that link can watch. The match owner is the only writer to that room. Keep links private.
The rules have not been deployed or tested against the live Firebase project; verify in the Rules Playground / Emulator before public use.
