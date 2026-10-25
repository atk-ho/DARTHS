# DARTHS v1.2.0-beta --- Players, Brackets & Tournament Experience

**Release type:** Pre-release\
**Suggested tag:** `v1.2.0-beta`\
**Release status:** Draft --- not published by this document

## Highlights

This beta focuses on tournament management, mobile Host usability, the
Players tab, and the live spectator experience.

### Added / Improved

-   **Redesigned Players tab:** searchable player list, compact cards,
    player management, and separate performance dashboard.
-   **Two tournament formats:** Standard Elimination (1v1 with BYEs) and
    Knockout Elimination (2--4 players per match, no BYEs).
-   **Matchup editor:** simplified match-by-match player assignments,
    with manual swaps, random draw, and stat-balanced arrangement.
-   **Bracket fullscreen:** bracket-only viewing with an exit control;
    landscape orientation requested when supported.
-   **Match preparation:** countdown, Host-controlled skip/start, and
    manual throwing-order selection.
-   **Live spectator displays:** tournament bracket, player performance,
    upcoming match, match results, and champion presentation.
-   **Sound & Voice:** event audio and music controls, including support
    for built-in and custom audio where configured.
-   **Create Tournament form:** compact participant selection and
    streamlined match settings.

### Fixes / Refinements

-   Reduced spectator statistics dashboard overflow and repeated visual
    animation.
-   Removed the spectator live-scoreboard **View Bracket** shortcut;
    Host retains display control.
-   Improved bracket presentation and mobile-focused controls.
-   Updated terminology and layout consistency.

## Installation / Upgrade

1.  Back up your current DARTHS files and local data before replacing
    website files.
2.  Deploy the complete compatible build to your static host (such as
    GitHub Pages).
3.  Refresh the site and, if necessary, clear outdated service-worker
    cache.
4.  Check Firebase Authentication and Realtime Database rules before
    using **Go Live & Share**.
5.  Verify Host and Spectator views on separate devices.

> **Important:** Do not combine files from unrelated patch ZIPs without
> checking compatibility. A GitHub release should contain one tested,
> consistent build.

## Testing Checklist

-   [ ] Add, rename, search, and remove players
-   [ ] Start and finish a casual game
-   [ ] Create Standard Elimination tournaments with odd player counts
    and verify BYEs
-   [ ] Create Knockout Elimination tournaments with 3, 5, and 7 players
-   [ ] Save manual, random, and stat-balanced matchups
-   [ ] Open and exit bracket-only fullscreen on mobile
-   [ ] Start, skip, and cancel upcoming-match countdowns
-   [ ] Set throwing order and complete a tournament match
-   [ ] Verify spectator countdown, scoring, statistics, results, and
    champion screens
-   [ ] Verify Sound & Voice settings and playback on Host and Spectator
    devices
-   [ ] Verify Firebase permissions and reconnection behavior

## Known Limitations

-   Automatic landscape rotation is not supported by every mobile
    browser.
-   Spectator audio may require user interaction to unlock playback.
-   Live sharing requires correct Firebase authentication and security
    rules.
-   Some features have not yet been verified end-to-end across browsers
    and devices.

## Release Guidance

Mark this GitHub release as a **Pre-release** until the testing
checklist passes. Do not claim a production-stable release solely from
syntax checks.

------------------------------------------------------------------------

**DARTHS** --- Tournament & player management beta update.
