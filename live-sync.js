
import { firebaseConfig } from './firebase-config.js';

const params = new URLSearchParams(location.search);
const viewing = params.has('watch');

const configured = !Object.values(firebaseConfig).some(value =>
  !value || String(value).includes('PASTE_')
);

const escapeHTML = value =>
  String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

if (viewing) {
  document.body.innerHTML = `
    <main class="watch-shell">
      <header class="watch-header">
        <div class="watch-brand">
          <img src="./icons/icon-192.png" alt="">
          DARTHS
        </div>
        <span id="connection">Connecting…</span>
      </header>
      <div id="watchContent" class="watch-content">
        Loading live scores…
      </div>
    </main>
  `;

  document.title = 'DARTHS · Live Scoreboard';
}

if (!configured) {
  if (viewing) {
    document.getElementById('watchContent').textContent =
      'Firebase is not configured yet. Edit firebase-config.js first.';
  }

  console.warn('DARTHS: Firebase configuration is incomplete.');
} else {
  try {
    const [
      { initializeApp },
      { getAuth, signInAnonymously },
      { getDatabase, ref, set, onValue, remove }
    ] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js')
    ]);

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const database = getDatabase(app);

    const credential = await signInAnonymously(auth);
    const uid = credential.user.uid;

    // New storage key avoids reusing an older room.
    const KEY = 'darths_live_room_v4';

    let room = localStorage.getItem(KEY);
    let pending = Promise.resolve();

    // DARTHS room IDs are 36 hexadecimal characters.
    const validRoom = id => /^[a-f0-9]{36}$/.test(id);

    const newRoom = () => {
      const bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);

      return Array.from(
        bytes,
        byte => byte.toString(16).padStart(2, '0')
      ).join('');
    };

    const roomRef = id =>
      ref(database, 'liveMatches/' + id);

    // Only send fields allowed by Firebase rules.
    const payload = game => ({
      owner: uid,
      updatedAt: Date.now(),
      game: JSON.parse(JSON.stringify(game))
    });

    // Serialize writes to preserve score update order.
    function enqueue(game) {
      if (!room || !validRoom(room)) {
        return Promise.reject(
          new Error('Share a match first')
        );
      }

      const data = payload(game);

      pending = pending
        .catch(() => {})
        .then(() => set(roomRef(room), data));

      return pending;
    }

    window.DARTHS_SYNC = {
      async share(game) {
        if (!room || !validRoom(room)) {
          room = newRoom();
          localStorage.setItem(KEY, room);
        }

        await enqueue(game);

        return new URL(
          './?watch=' + room,
          location.href
        ).href;
      },

      async publish(game) {
        if (!room) return;
        return enqueue(game);
      },

      async refresh(game) {
        if (!room) {
          return this.share(game);
        }

        return enqueue(game);
      },

      async stop() {
        if (!room) return;

        await pending.catch(() => {});
        await remove(roomRef(room));

        localStorage.removeItem(KEY);
        room = null;
      }
    };

    window.dispatchEvent(
      new Event('darths-sync-ready')
    );

    // Spectator / laptop scoreboard.
    if (viewing) {
      const id = params.get('watch');

      if (!validRoom(id)) {
        throw new Error('Invalid sharing code');
      }

      onValue(
        roomRef(id),

        snapshot => {
          const content =
            document.getElementById('watchContent');

          const status =
            document.getElementById('connection');

          const record = snapshot.val();

          if (!record?.game) {
            status.textContent = 'WAITING';
            content.textContent =
              'No active shared match found.';
            return;
          }

          status.textContent = '● LIVE';

          const game = record.game;

          document.body.classList.toggle(
            'many-players',
            game.participants.length >= 4
          );

          content.innerHTML = `
            <section class="watch-overview">
              <h1>${game.points} Darts</h1>

              <div class="overview-grid">
                <div>
                  <small>START SCORE</small>
                  <strong>${game.points}</strong>
                </div>

                <div>
                  <small>CHECK-IN</small>
                  <strong>${escapeHTML(game.checkin)}</strong>
                </div>

                <div>
                  <small>CHECKOUT</small>
                  <strong>${escapeHTML(game.checkout)}</strong>
                </div>
              </div>

              <p>
                Set ${game.setNumber} ·
                Leg ${game.legNumber} ·
                Round ${game.round} ·
                ${game.format === 'best' ? 'Best of' : 'First to'}
                ${game.legs} legs
              </p>
            </section>

            <section class="watch-rows">
              ${game.participants.map((player, index) => {
                const shown =
                  index === game.current && game.turn.length
                    ? game.turn
                    : (player.last || []);

                const bust =
                  !!player.lastBust && index !== game.current;

                const average = player.stats.darts
                  ? (
                      player.stats.scored /
                      player.stats.darts * 3
                    ).toFixed(2)
                  : '0.00';

                const total = bust
                  ? 0
                  : shown.reduce(
                      (sum, dart) => sum + (dart.score || 0),
                      0
                    );

                return `
                  <div class="watch-row
                    ${index === game.current ? 'active' : ''}
                    ${bust ? 'bust' : ''}">

                    <div class="watch-left">
                      <strong>${player.remaining}</strong>
                      <span>${escapeHTML(player.label)}</span>
                    </div>

                    <div class="watch-middle">
                      <div class="watch-darts">
                        ${[0, 1, 2].map(dartIndex => `
                          <div>
                            ${
                              shown[dartIndex]
                                ? escapeHTML(shown[dartIndex].label)
                                : ''
                            }
                          </div>
                        `).join('')}
                      </div>

                      <b>${total}</b>
                    </div>

                    <div class="watch-right">
                      <small>
                        Sets: ${player.sets} ·
                        Legs: ${player.legs}
                      </small>

                      <span>🎯 ${player.stats.darts}</span>
                      <span>⊘ ${average}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </section>

            <footer>
              ${escapeHTML(
                game.participants[game.current]?.label || 'Player'
              )}'s turn
            </footer>
          `;
        },

        error => {
          document.getElementById('connection').textContent =
            'ERROR';

          document.getElementById('watchContent').textContent =
            error.message;
        }
      );
    }
  } catch (error) {
    console.warn(
      'DARTHS live sharing unavailable:',
      error
    );

    if (viewing) {
      document.getElementById('connection').textContent =
        'ERROR';

      document.getElementById('watchContent').textContent =
        error.message;
    }
  }
}
