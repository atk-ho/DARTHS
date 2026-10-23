import { firebaseConfig } from './firebase-config.js';

const params = new URLSearchParams(location.search);
const viewing = params.has('watch');
const validRoom = id => /^[a-f0-9]{36}$/.test(id || '');
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const configured = Object.values(firebaseConfig).every(x => x && !String(x).includes('PASTE_'));

if (viewing) {
  document.body.innerHTML = `<main class="watch-shell"><header class="watch-header"><div class="watch-brand"><img src="./icons/icon-192.png" alt=""> DARTHS</div><span id="connection">Connecting…</span></header><div id="watchContent" class="watch-content">Loading live scores…</div></main>`;
  document.title = 'DARTHS · Live Scoreboard';
}

if (!configured) {
  if (viewing) document.getElementById('watchContent').textContent = 'Firebase configuration is incomplete.';
  console.error('DARTHS: Check firebase-config.js');
} else {
  try {
    const [{ initializeApp }, { getAuth, signInAnonymously }, { getDatabase, ref, set, get, onValue, remove }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js')
    ]);
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const database = getDatabase(app);
    const uid = (await signInAnonymously(auth)).user.uid;
    // New key means a new room; old IV rooms are not reused.
    const KEY = 'darths_live_room_v6_clean';
    let room = null;
    let currentGame = null;
    let generation = 0;
    let chain = Promise.resolve();
    let lastError = null;
    const newRoom = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(16).padStart(2, '0')).join('');
    const roomRef = id => ref(database, 'liveMatches/' + id);
    const copy = game => JSON.parse(JSON.stringify(game));

    // Serialize writes, but read the latest game at the moment each write begins.
    function publishLatest() {
      if (!room || !currentGame) return Promise.resolve();
      const target = room, token = generation;
      const task = chain.catch(() => {}).then(async () => {
        if (target !== room || token !== generation || !currentGame) return;
        const record = {
          owner: uid,
          updatedAt: Date.now(),
          game: copy(currentGame)
        };
        await set(roomRef(target), record);
        lastError = null;
      });
      chain = task.catch(error => {
        lastError = error;
        console.error('DARTHS Firebase write failed:', error);
      });
      return task;
    }

    window.DARTHS_SYNC = {
      async share(game) {
        currentGame = game;
        if (!room) {
          room = newRoom();
          generation++;
        }
        // Wait for the initial write before returning the spectator link.
        await publishLatest();
        return new URL('./?watch=' + room, location.href).href;
      },
      publish(game) {
        currentGame = game;
        return publishLatest();
      },
      refresh(game) {
        if (game) currentGame = game;
        if (!room) return Promise.reject(new Error('Share the match first'));
        return publishLatest();
      },
      async stop() {
        const old = room;
        room = null;
        currentGame = null;
        generation++;
        await chain;
        if (old) {
          try { await remove(roomRef(old)); }
          catch (error) { console.warn('Unable to remove shared room:', error); }
        }
      },
      getLastError() { return lastError; }
    };
    window.dispatchEvent(new Event('darths-sync-ready'));

    if (viewing) {
      const id = params.get('watch');
      const content = document.getElementById('watchContent');
      const status = document.getElementById('connection');
      if (!validRoom(id)) throw new Error('Invalid sharing code');
      let lastSignature = '';
      function renderRecord(record) {
        if (!record?.game) {
          status.textContent = 'WAITING';
          content.textContent = 'No active shared match found.';
          return;
        }
        status.textContent = '● LIVE';
        const signature = JSON.stringify(record);
        if (signature === lastSignature) return;
        const g = record.game;
        document.body.classList.toggle('many-players', g.participants.length >= 4);
        content.innerHTML = `<section class="watch-overview"><h1>${g.points} Darts</h1><div class="overview-grid"><div><small>START SCORE</small><strong>${g.points}</strong></div><div><small>CHECK-IN</small><strong>${escapeHTML(g.checkin)}</strong></div><div><small>CHECKOUT</small><strong>${escapeHTML(g.checkout)}</strong></div></div><p>Set ${g.setNumber} · Leg ${g.legNumber} · Round ${g.round} · ${g.format==='best'?'Best of':'First to'} ${g.legs} legs</p></section><section class="watch-rows">${g.participants.map((p,i)=>{const shown=i===g.current&&Array.isArray(g.turn)&&g.turn.length?g.turn:(p.last||[]).slice(0,3);const bust=!!p.lastBust&&i!==g.current;const avg=p.stats.darts?(p.stats.scored/p.stats.darts*3).toFixed(2):'0.00';return `<div class="watch-row ${i===g.current?'active':''} ${bust?'bust':''}"><div class="watch-left"><strong>${p.remaining}</strong><span>${escapeHTML(p.label)}</span></div><div class="watch-middle"><div class="watch-darts">${[0,1,2].map(j=>`<div>${shown[j]?escapeHTML(shown[j].label):''}</div>`).join('')}</div><b>${bust?0:shown.reduce((a,d)=>a+(d.score||0),0)}</b></div><div class="watch-right"><small>Sets: ${p.sets} · Legs: ${p.legs}</small><span>🎯 ${p.stats.darts}</span><span>⊘ ${avg}</span></div></div>`}).join('')}</section><footer>${escapeHTML(g.participants[g.current]?.label||'Player')}'s turn</footer>`;
        lastSignature = signature;
      }
      onValue(roomRef(id), snapshot => renderRecord(snapshot.val()), error => {
        status.textContent = 'ERROR';
        content.textContent = error.message;
      });
      // Recovery read for a stalled stream; the initial listener handles normal updates.
      setInterval(async () => {
        try {
          const snapshot = await get(roomRef(id));
          renderRecord(snapshot.val());
        } catch (error) {
          status.textContent = 'RECONNECTING';
          console.warn('DARTHS spectator read failed:', error);
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
