# DARTHS — Roster, Break Time, and Tournament Update

Replace the full GitHub Pages project with these files (keep your existing Firebase project and rules).

## Added
- Break Time button in the live host header (replaces manual refresh), with message, timer setting, and spectator overlay. Resume from the same button.
- Roster tab with locally stored single-elimination tournament brackets, automatic byes, and direct match selection.
- Next Match button after finishing a tournament match; tournament champion recognition.
- Turn-order popup for all players or teams; team member reassignment.
- Confirmation before accepting a winning dart. Cancel restores the previous dart.
- Undo remains available after the third dart and completed turn; do not abandon a match to undo.
- Leg/set celebrations on host and spectator, match-winner confetti and extended victory melody on host.
- Play Again popup for points, sets, and legs. Restart and End Sharing retain their original behavior.
- Spectator Layout Editor in Settings: drag or arrow-reorder grid blocks; font, font size, spacing. Auto-align preserves a readable layout.
- Spectator tournament bracket expandable section when viewing a shared tournament match.

## Limitations and testing
- Tournament creation currently supports individual **single elimination**, not round-robin, double elimination, or team brackets.
- Tournament records are stored in the host's localStorage. The live spectator link shows the bracket for the **currently shared tournament match**, but does not independently synchronize all tournament management changes.
- The spectator layout editor is a grid auto-align editor, not free-form pixel positioning.
- Break overlays support built-in titles and text, not uploaded sponsor images or video.
- Firebase anonymous authentication and Realtime Database must already be configured. Live features require an active internet connection.
- Validate all match formats, undo scenarios, and host/spectator synchronization on two devices before using this version in a real competition.
