# DARTHS — Complete website (Sync Fix, No IV)

Contains the complete GitHub Pages PWA, including icons, legal pages, MIT license, Firebase configuration, and database rules.

## Install
1. Back up your GitHub repository and export local data from DARTHS Settings.
2. Extract this ZIP and upload the contents to the **root** of `atk-ho/DARTHS`. Keep the `icons/` folder.
3. Firebase Console → Realtime Database → Rules: paste the contents of `database.rules.json` and click Publish.
4. Firebase Authentication → Sign-in method: Anonymous must be enabled.
5. Commit changes and wait for GitHub Pages deployment. Close/reopen the installed PWA or hard-refresh the browser.
6. Start a new match and generate a **new** Share link. Do not reuse older spectator links.

## Changes
- Removed IV counter, IV player entry, and IV visibility setting.
- New share room created each time sharing starts (previous room IDs are not reused).
- Share waits for initial Firebase write before providing the link.
- Every dart, including the third dart after turn completion, publishes the latest match state.
- Manual refresh resends the current state.
- Spectator continues listening for updates and checks Firebase every five seconds for recovery.

## Important
- No Firebase project or authentication deletion required. Existing `liveMatches` data can be left alone.
- `firebase-config.js` contains the previously supplied DARTHS project values. Confirm them in your Firebase Console.
- This code has passed local syntax checks, but live Firebase behavior must be tested after deployment.
