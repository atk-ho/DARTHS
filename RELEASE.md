# DARTHS — Release Notes

**Suggested GitHub release title:** DARTHS — Tournament & Audio Experience Update  
**Suggested tag:** `v1.1.0-beta`  
**Release type:** Pre-release  
**Date:** October 25, 2026

> This is a proposed release description for the current development build. The tag is a suggested name, not an existing GitHub release. End-to-end tests across Host, Spectator, and Firebase have not been confirmed.

## Highlights

### Tournament Formats
- Added **Knockout Elimination** for 2–4 players per match, with no BYEs.
- Retained **Standard Elimination** for 1v1 matches with automatic BYEs.
- Improved tournament creation controls, including compact participant selection and match settings.
- Added manual throwing-order selection before tournament matches.

### Live Spectator Experience
- Improved tournament bracket presentation and responsive spectator displays.
- Added an expanded player statistics dashboard.
- Preserved Host-controlled spectator screens, including Welcome, Bracket, Upcoming Match, Live Scoreboard, Statistics, and Break.
- Removed the extra **View Bracket** link from the live spectator scoreboard; the Host controls bracket presentation.

### Music, Sound & Voice
- Added built-in synthesized themes and event-specific sound effects.
- Added controls for music, effects, voice announcements, volume, looping, and optional custom audio.
- Included sounds for **180, Bust, Leg Win, Set Win, Match Win, and Tournament Champion**.
- Updated Sound & Voice settings initialization and spectator audio handling.

### Interface and Stability
- Renamed Home's **New Game** section to **Casual Game**.
- Continued mobile and landscape usability improvements.
- Addressed reported UI styling and caching issues.

## Deployment Notes

1. Back up your existing repository and local DARTHS data.
2. Deploy the current project files, including the latest audio and UI fixes.
3. Confirm Firebase Anonymous Authentication and Realtime Database rules.
4. Refresh both Host and Spectator browsers to clear stale cached assets.
5. Test a complete Standard and Knockout tournament, audio settings, and spectator synchronization.

## Known Limitations

- Spectator audio may require an initial tap to enable playback.
- Uploaded custom music remains local unless hosted and made available to spectators.
- Firebase permissions and live synchronization require verification in the deployed environment.
- Full regression testing across devices and game modes remains pending.

## Release Checklist

- [ ] Confirm Create Tournament UI matches the intended reference design
- [ ] Confirm Sound & Voice settings appear and save correctly
- [ ] Test leg, set, match, and champion sounds on Host and Spectator
- [ ] Test Standard Elimination BYEs and Knockout Elimination advancement
- [ ] Test countdown, throwing order, and tournament return flow
- [ ] Test portrait, landscape, and spectator fullscreen layouts
- [ ] Confirm GitHub Pages deployment and service-worker refresh

---

**Project:** https://atk-ho.github.io/DARTHS/  
**License:** MIT  
**Developer:** Arthur Reguindin Jr.
