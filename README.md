# 🎯 DARTHS

**DARTHS** is a mobile-friendly darts scoreboard and tournament
management web app with live spectator displays, player statistics, and
customizable audio.

> **Status:** Beta. Some features require further real-device and
> Firebase testing.

## Features

### 🎮 Casual Games

-   Individual and team game setup
-   Starting scores including 301, 501, 701, and 1001
-   Sets and legs, configurable match format, and checkout options
-   Score entry, turn management, and match results
-   Player selection and throwing-order controls

### 🏆 Tournaments

-   **Standard Elimination:** 1v1 matches with automatic BYEs when
    needed
-   **Knockout Elimination:** 2--4 players per match, without BYEs; one
    winner advances
-   Connected tournament brackets showing progression
-   Manual, random, and statistics-based matchup arrangement
-   Upcoming-match countdown and host-controlled match start
-   Tournament results and champion presentation
-   Dedicated bracket fullscreen viewer (landscape rotation depends on
    browser support)

### 👥 Players & Statistics

-   Add, search, rename, and remove players
-   Player list and separate statistics dashboard
-   Saved performance data such as 3-dart average, highest turn, darts
    thrown, 180s, and busts where recorded

### 📺 Live Spectator Display

-   Shareable live match view through Firebase
-   Host-controlled welcome, bracket, player statistics, break,
    upcoming-match, and scoring screens
-   Countdown and tournament progression synchronization
-   Responsive layouts for phones, tablets, desktop monitors, and TVs

### 🔊 Sound & Voice

-   Voice score announcements and sound effects
-   Built-in music and event audio, including leg, set, match, and
    champion events
-   Custom audio support and playback settings where supported
-   Browser audio may require a user interaction before playback

### 🎨 Display & Offline Support

-   Host and spectator display customization
-   Responsive mobile-first interface
-   Browser-local storage for supported local settings and records
-   Progressive Web App (PWA) assets and service-worker support

## Getting Started

DARTHS is a static web application built with **HTML, CSS, and
JavaScript**. You can host the project on GitHub Pages or another static
hosting service.

1.  Download or clone the repository.
2.  Serve the project using a local development server (recommended) or
    deploy it to a static host.
3.  Open the site in a modern browser.
4.  Add players and start a casual game, or create a tournament.

**Live sharing** requires a correctly configured Firebase project with
Anonymous Authentication and Realtime Database access rules. Do not
publish unrestricted database rules.

### Firebase security notes

-   Enable only the authentication methods your app uses.
-   Restrict writes to the authenticated owner of each live room.
-   Validate allowed fields and room identifiers in Realtime Database
    rules.
-   Test host and spectator access separately before using the app at an
    event.
-   Firebase web configuration is not a substitute for database
    authorization rules.

## Tournament Workflow

1.  Create a tournament and select **Standard Elimination** or
    **Knockout Elimination**.
2.  Choose participants and match settings.
3.  Arrange matchups before the first match (manual, random, or
    stat-balanced).
4.  Optionally start a live spectator broadcast.
5.  Select a match, prepare the countdown, and determine throwing order.
6.  Start the match, record scores, and advance the winner.
7.  Continue until a tournament champion is determined.

## Data & Privacy

DARTHS uses local browser storage for supported settings and records,
and Firebase Realtime Database for supported live sharing. Clearing
browser data may remove locally stored information. Avoid entering
sensitive personal information in player names or publicly shared
screens.

## Security

Please read [SECURITY.md](.github/SECURITY.md) for vulnerability
reporting guidance, if that file is present in your repository.

## Compatibility & Known Limitations

-   Fullscreen and orientation locking depend on browser and device
    support.
-   Audio autoplay restrictions may require tapping **Enable Audio** on
    spectator devices.
-   Live synchronization depends on connectivity, authentication, and
    Firebase rules.
-   The latest UI and audio changes still need end-to-end testing on
    actual devices.

## Contributing

Issues and constructive feedback are welcome. When reporting a bug,
include the device/browser, steps to reproduce, expected behavior, and
relevant console errors (without exposing private credentials).

## License

Refer to the repository's `LICENSE` file, if provided. No license is
implied by this README alone.

------------------------------------------------------------------------

**DARTHS** --- Darts scoring, tournaments, and live spectators.
