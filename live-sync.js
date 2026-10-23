import { firebaseConfig } from './firebase-config.js';

const params = new URLSearchParams(location.search);
const viewing = params.has('watch');
const validRoom = id => /^[a-f0-9]{36}$/.test(id || '');
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const configured = Object.values(firebaseConfig).every(x => x && !String(x).includes('PASTE_'));

if (viewing) {
  document.body.innerHTML = `<main class="watch-shell"><header class="watch-header"><div class="watch-brand"><img src="./icons/icon-192.png" alt=""> DARTHS</div><div class="watch-connection"><span id="ivCounter" class="iv-counter" aria-label="IV refresh counter">IV = 0</span><span id="connection">Connecting…</span></div></header><div id="watchContent" class="watch-content">Loading live scores…</div></main>`;
  document.title = 'DARTHS · Live Scoreboard';
}

if (!configured) {
  if (viewing) document.getElementById('watchContent').textContent = 'Firebase configuration is incomplete.';
  console.error('DARTHS: Check firebase-config.js');
} else {
  try {
    const [{ initializeApp }, { getAuth, signInAnonymously }, { getDatabase, ref, set, get, onValue, remove, onDisconnect }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js')
    ]);
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const database = getDatabase(app);
    const credential = await signInAnonymously(auth);
    const uid = credential.user.uid;
    const KEY = 'darths_live_room_v5_iv';
    let room = localStorage.getItem(KEY);
    if (!validRoom(room)) { room = null; localStorage.removeItem(KEY); }
    let iv = 0;
    let writeChain = Promise.resolve();
    let currentGame = null;
    let initialTimer = null;
    let turnTimer = null;
    let session = 0;
    let lastError = null;
    const newRoom = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(16).padStart(2, '0')).join('');
    const roomRef = id => ref(database, 'liveMatches/' + id);
    const copy = game => JSON.parse(JSON.stringify(game));
    const clearTimers = () => { clearTimeout(initialTimer); clearTimeout(turnTimer); initialTimer = null; turnTimer = null; };

    // Every write uses the freshest state at execution time, not a queued stale snapshot.
    function publishLatest(incrementIV = false) {
      if (!room || !currentGame) return Promise.reject(new Error('No active shared match'));
      const target = room;
      const generation = session;
      writeChain = writeChain.catch(() => {}).then(async () => {
        if (generation !== session || target !== room || !currentGame) return;
        const nextIV = iv + (incrementIV ? 1 : 0);
        const gameData = copy(currentGame);
        // Firebase-only fourth entry. The live game itself is never modified.
        // All players receive the same IV value; entries 0–2 remain actual darts.
        if (Array.isArray(gameData.participants)) {
          for (const player of gameData.participants) {
            const last = Array.isArray(player.last) ? player.last.slice(0, 3) : [];
            last[3] = { label: 'IV', score: nextIV };
            player.last = last;
          }
        }
        try { const saved = JSON.parse(localStorage.getItem('darts_scoreboard_v1') || '{}'); gameData.ivVisible = saved.settings?.showIV !== false; } catch (_) { gameData.ivVisible = true; }
        const record = { owner: uid, updatedAt: Date.now(), iv: nextIV, game: gameData };
        await set(roomRef(target), record);
        iv = nextIV;
        lastError = null;
      }).catch(error => { lastError = error; console.error('DARTHS Firebase write failed:', error); throw error; });
      return writeChain;
    }

    window.DARTHS_SYNC = {
      async share(game) {
        currentGame = game;
        if (!room) {
          room = newRoom();
          localStorage.setItem(KEY, room);
          iv = 0;
          session++;
        }
        // First publish happens before returning the link: spectators see the empty scoreboard.
        await publishLatest(false);
        clearTimeout(initialTimer);
        const generation = session;
        initialTimer = setTimeout(() => {
          if (session === generation && currentGame) publishLatest(true).catch(console.error);
        }, 3000);
        return new URL('./?watch=' + room, location.href).href;
      },
      publish(game) {
        currentGame = game;
        if (!room) return Promise.resolve();
        return publishLatest(false);
      },
      refresh(game) {
        if (game) currentGame = game;
        return publishLatest(true);
      },
      // Called after a completed turn. Refresh the *current* game after 2.5 seconds.
      afterTurn(getGame) {
        if (!room) return;
        clearTimeout(turnTimer);
        const generation = session;
        turnTimer = setTimeout(() => {
          if (generation !== session) return;
          const latest = getGame();
          if (!latest) return;
          currentGame = latest;
          publishLatest(true).catch(console.error);
        }, 2500);
      },
      async stop() {
        clearTimers();
        const oldRoom = room;
        session++;
        room = null;
        currentGame = null;
        iv = 0;
        localStorage.removeItem(KEY);
        if (oldRoom) {
          await writeChain.catch(() => {});
          try { await remove(roomRef(oldRoom)); } catch (error) { console.warn('Unable to remove previous shared room:', error); }
        }
      },
      getLastError() { return lastError; }
    };
    // Resume publishing a match after a phone page reload when its sharing room exists.
    if (!viewing && room) {
      try {
        const saved = JSON.parse(localStorage.getItem('darts_scoreboard_v1') || '{}');
        if (saved.game) { currentGame = saved.game; publishLatest(false).catch(console.error); }
      } catch (error) { console.warn('DARTHS saved match unavailable:', error); }
    }
    window.dispatchEvent(new Event('darths-sync-ready'));

    if (viewing) {
      const id = params.get('watch');
      const content = document.getElementById('watchContent');
      const status = document.getElementById('connection');
      const ivCounter = document.getElementById('ivCounter');
      if (!validRoom(id)) throw new Error('Invalid sharing code');
      let lastUpdate = 0;
      let lastSignature = '';
      const renderRecord = record => {
        if (!record || !record.game) {
          status.textContent = 'WAITING';
          content.textContent = 'No active shared match found.';
          return;
        }
        if (ivCounter) { ivCounter.textContent = 'IV = ' + (Number.isFinite(record.iv) ? record.iv : 0); ivCounter.style.opacity = record.game?.ivVisible === false ? '0' : '1'; }
        const signature = JSON.stringify(record);
        if (signature === lastSignature) return;
        lastSignature = signature;
        lastUpdate = Date.now();
        status.textContent = '● LIVE';
        const g = record.game;
        document.body.classList.toggle('many-players', g.participants.length >= 4);
        content.innerHTML = `<section class="watch-overview"><h1>${g.points} Darts</h1><div class="overview-grid"><div><small>START SCORE</small><strong>${g.points}</strong></div><div><small>CHECK-IN</small><strong>${escapeHTML(g.checkin)}</strong></div><div><small>CHECKOUT</small><strong>${escapeHTML(g.checkout)}</strong></div></div><p>Set ${g.setNumber} · Leg ${g.legNumber} · Round ${g.round} · ${g.format==='best'?'Best of':'First to'} ${g.legs} legs</p></section><section class="watch-rows">${g.participants.map((p,i)=>{const shown=i===g.current&&g.turn.length?g.turn:(p.last||[]);const bust=!!p.lastBust&&i!==g.current;const avg=p.stats.darts?(p.stats.scored/p.stats.darts*3).toFixed(2):'0.00';return `<div class="watch-row ${i===g.current?'active':''} ${bust?'bust':''}"><div class="watch-left"><strong>${p.remaining}</strong><span>${escapeHTML(p.label)}</span></div><div class="watch-middle"><div class="watch-darts">${[0,1,2].map(j=>`<div>${shown[j]?escapeHTML(shown[j].label):''}</div>`).join('')}</div><b>${bust?0:shown.slice(0,3).reduce((a,d)=>a+(d.score||0),0)}</b></div><div class="watch-right"><small>Sets: ${p.sets} · Legs: ${p.legs}</small><span>🎯 ${p.stats.darts}</span><span>⊘ ${avg}</span></div></div>`}).join('')}</section><footer>${escapeHTML(g.participants[g.current]?.label||'Player')}'s turn</footer>`;
      };
      // Real-time listener plus a periodic server re-read for recovery if the stream stalls.
      onValue(roomRef(id), snap => renderRecord(snap.val()), error => {
        status.textContent = 'ERROR';
        content.textContent = error.message;
      });
      setInterval(async () => {
        try {
          const snapshot = await get(roomRef(id));
          renderRecord(snapshot.val());
          if (lastUpdate && Date.now() - lastUpdate > 15000) status.textContent = '● LIVE';
        } catch (error) {
          status.textContent = 'RECONNECTING';
          console.warn('DARTHS spectator reconnect check:', error);
        }
      }, 5000);
    }
  } catch (error) {
    console.error('DARTHS live sharing unavailable:', error);
    if (viewing) {
      document.getElementById('connection').textContent = 'ERROR';
      document.getElementById('watchContent').textContent = error.message;
    }
  }
}
