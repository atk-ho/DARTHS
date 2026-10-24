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

function leadClass(players,key,i){
 const values=players.map(p=>Math.max(0,Number(p[key])||0)),v=values[i];
 if(!v)return 'neutral';
 const top=Math.max(...values);
 if(v===top)return values.filter(n=>n===top).length>1?'second':'leader';
 const distinct=[...new Set(values.filter(n=>n>0))].sort((a,b)=>b-a);
 return v===distinct[1]?'second':'neutral';
}
function indicator(g,p,i){
 return `<div class="win-indicators">${['sets','legs'].map((key,k)=>`<div class="win-group"><small>${k?'L':'S'}</small><span class="win-box ${leadClass(g.participants,key,i)}">${Number(p[key])||0}</span></div>`).join('')}</div>`;
}
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
        const layout=g.spectatorLayout;
        if(layout){
          const order=layout.order||['score','sets','legs','darts','stats'];
          let st=document.getElementById('watch-custom-layout');if(!st){st=document.createElement('style');st.id='watch-custom-layout';document.head.append(st)}
          const ord=key=>Math.max(1,order.indexOf(key)+1);
          st.textContent=`.watch-row{column-gap:${Math.max(2,Math.min(35,Number(layout.gap)||12))}px!important;font-family:${['Arial','Poppins','Roboto','Inter'].includes(layout.font)?layout.font:'Arial'},sans-serif;font-size:${Math.max(11,Math.min(30,Number(layout.fontSize)||16))}px}.watch-left{order:${ord('score')}}.watch-row>.win-indicators{order:${Math.min(ord('sets'),ord('legs'))}}.watch-middle{order:${ord('darts')}}.watch-right{order:${ord('stats')}}`;
          if(layout.elements){
            const map={score:['.watch-left strong'],name:['.watch-left span'],indicators:['.win-indicators'],darts:['.watch-darts'],total:['.watch-middle>b'],stats:['.watch-right']};
            for(const [key,selectors] of Object.entries(map)){
              const e=layout.elements[key];if(!e)continue;
              const size=Math.max(9,Math.min(100,Number(e.size)||16));
              const color=/^#[0-9a-fA-F]{6}$/.test(e.color)?e.color:'#ffffff';
              st.textContent+=selectors.map(sel=>`${sel}{font-size:${size}px!important;color:${color}!important;${e.visible===false?'display:none!important;':''}}`).join('');
            }
          }
          if(['default','dark','blue'].includes(layout.theme)){
            st.textContent+=`.watch-row{background:${layout.theme==='blue'?'#10325a':layout.theme==='dark'?'#05080e':'#0c2238'}!important}`;
          }
        }
        content.innerHTML = `<section class="watch-overview"><h1>${g.points} Darts</h1><div class="overview-grid"><div><small>START SCORE</small><strong>${g.points}</strong></div><div><small>CHECK-IN</small><strong>${escapeHTML(g.checkin)}</strong></div><div><small>CHECKOUT</small><strong>${escapeHTML(g.checkout)}</strong></div></div><p>Set ${g.setNumber} · Leg ${g.legNumber} · Round ${g.round} · ${g.format==='best'?'Best of':'First to'} ${g.legs} legs</p></section><section class="watch-rows">${g.participants.map((p,i)=>{const shown=i===g.current&&Array.isArray(g.turn)&&g.turn.length?g.turn:(p.last||[]).slice(0,3);const bust=!!p.lastBust&&i!==g.current;const avg=(p.stats?.darts)?(p.stats.scored/p.stats.darts*3).toFixed(2):'0.00';return `<div class="watch-row ${i===g.current?'active':''} ${bust?'bust':''}"><div class="watch-left"><strong>${p.remaining}</strong><span>${escapeHTML(p.label)}</span></div>${indicator(g,p,i)}<div class="watch-middle"><div class="watch-darts">${[0,1,2].map(j=>`<div>${shown[j]?escapeHTML(shown[j].label):''}</div>`).join('')}</div><b>${bust?0:shown.reduce((a,d)=>a+(d.score||0),0)}</b></div><div class="watch-right"><span>🎯 ${p.stats?.darts||0}</span><span>⊘ ${avg}</span></div></div>`}).join('')}</section><footer>${escapeHTML(g.participants[g.current]?.label||'Player')}'s turn</footer>`;
        if(!g.finished && g.celebration?.at && Date.now()-g.celebration.at<4200){
          const event=g.celebration;
          content.insertAdjacentHTML('beforeend',`<div class="watch-modal" id="watchMinorWin"><div class="watch-modal-panel" style="text-align:center;border:2px solid ${event.type==='set'?'#ffce3a':'#198eff'}"><h1>${event.type==='set'?'✨ SET WON!':'🎯 LEG WON!'}</h1><h2>${escapeHTML(event.label)}</h2><p>Set ${event.set} · Leg ${event.leg}</p></div></div>`);
          setTimeout(()=>document.getElementById('watchMinorWin')?.remove(),Math.max(200,4200-(Date.now()-event.at)));
        }
                if(g.breakTime?.active){
          const ends=g.breakTime.endsAt,minutes=ends?Math.max(0,Math.ceil((ends-Date.now())/60000)):null;
          content.insertAdjacentHTML('beforeend',`<div class="watch-modal" role="dialog" aria-label="Break Time"><div class="watch-modal-panel" style="text-align:center"><h1>☕ ${g.breakTime.template==='commercial'?'COMMERCIAL BREAK':'BREAK TIME'}</h1><p>${escapeHTML(g.breakTime.message||'Please stand by')}</p>${minutes!==null?`<h1>${minutes} min</h1>`:''}<p>Live match will resume shortly</p></div></div>`);
        }
                if(g.tournamentBracket?.length){
          const tournamentSummary=g.tournamentBracket.map((round,r)=>`<div><b>${r===g.tournamentBracket.length-1?'Final':`Round ${r+1}`}</b>: ${round.map(m=>`${escapeHTML(m.a?.label||'TBD')} vs ${escapeHTML(m.b?.label||'TBD')}${m.winner?' → '+escapeHTML(m.winner.label):''}`).join(' · ')}</div>`).join('');
          content.insertAdjacentHTML('beforeend',`<details class="watch-tournament"><summary>🏆 ${escapeHTML(g.tournamentName||'Tournament')} — View Bracket</summary>${tournamentSummary}</details>`);
        }
                // A spectator is read-only: host drives winner/results phase via game.resultView.
        if (g.finished) {
          status.textContent = '● LIVE · MATCH FINISHED';
          const winner = g.participants[g.winnerIndex] || g.participants[0];
          const winnerName = escapeHTML(winner?.label || 'Winner');const championText=g.championName?`<h2>🏆 TOURNAMENT CHAMPION: ${escapeHTML(g.championName)}</h2><p>${escapeHTML(g.tournamentName||'Championship')}</p>`:'';
          const resultsMode = g.resultView === 'results';
          const sorted = [...g.participants].sort((a,b) => (b.sets||0)-(a.sets||0) || (b.legs||0)-(a.legs||0) || (a.remaining||0)-(b.remaining||0));
          const totalDarts = g.participants.reduce((n,p)=>n+(p.stats?.darts||0),0);
          const resultRows = sorted.map((p,i) => `<tr><td>${i+1}</td><td>${p===winner?'👑 ':''}${escapeHTML(p.label)}</td><td>${p.remaining}</td><td>${p.sets||0}</td><td>${p.legs||0}</td><td>${p.stats?.darts||0}</td><td>${p.stats?.darts?(3*(p.stats.scored||0)/p.stats.darts).toFixed(2):'0.00'}</td><td>${p.stats?.high||0}</td><td>${p.stats?.checkoutHits||0} / ${p.stats?.checkoutAttempts||0}</td><td>${p===winner?'WINNER':'—'}</td></tr>`).join('');
          const overlay = resultsMode
            ? `<div class="watch-modal" role="dialog" aria-label="Match results"><div class="watch-modal-panel watch-results-panel"><h1>🏆 Game Results</h1>${championText}<p>${g.points} Darts · Set ${g.setNumber} · Leg ${g.legNumber}</p><div class="watch-table-scroll"><table><thead><tr><th>#</th><th>Player</th><th>Final</th><th>Sets</th><th>Legs</th><th>Darts</th><th>Average</th><th>High</th><th>Checks</th><th>Status</th></tr></thead><tbody>${resultRows}</tbody></table></div><div class="watch-summary"><div>Total Darts<strong>${totalDarts}</strong></div><div>Rounds<strong>${g.round||1}</strong></div><div>Winner<strong>${winnerName}</strong></div></div><p class="watch-viewonly">Live results · Spectator view only</p></div></div>`
            : `<div class="watch-modal" role="dialog" aria-label="Winner announcement"><div class="watch-modal-panel watch-winner-panel"><div class="watch-trophy">🏆</div><h1>CONGRATULATIONS!</h1>${championText}<h2>${winnerName} is the Winner!</h2><p>${g.points} Darts · Set ${g.setNumber} · Leg ${g.legNumber}</p><p>Winner by Checkout!</p></div></div>`;
          content.insertAdjacentHTML('beforeend', `<div class="watch-winner-banner">🏆 ${winnerName} is the Winner! 🏆</div>${overlay}`);
        }
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