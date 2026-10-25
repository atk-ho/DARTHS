import { firebaseConfig } from './firebase-config.js';

const params = new URLSearchParams(location.search);
const viewing = params.has('watch');
const validRoom = id => /^[a-f0-9]{36}$/.test(id || '');
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const configured = Object.values(firebaseConfig).every(x => x && !String(x).includes('PASTE_'));

if (viewing) {
  document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="./tournament.css?v=20261025-1">');
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
    let currentTournament = null;
    let tournamentMode = 'intro';
    let tournamentLiveId = null;
    let generation = 0;
    let chain = Promise.resolve();
    let lastError = null;
    const newRoom = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(16).padStart(2, '0')).join('');
    const roomRef = id => ref(database, 'liveMatches/' + id);
    const copy = game => JSON.parse(JSON.stringify(game));

    // Serialize writes, but read the latest game at the moment each write begins.
    function publishLatest() {
      if (!room || (!currentGame && !currentTournament)) return Promise.resolve();
      const target = room, token = generation;
      const task = chain.catch(() => {}).then(async () => {
        if (target !== room || token !== generation || (!currentGame && !currentTournament)) return;
        const record = {
          owner: uid,
          updatedAt: Date.now(),
          game: currentGame ? copy(currentGame) : null,
          viewMode: currentTournament ? tournamentMode : 'match',
          tournament: currentTournament ? copy(currentTournament) : (currentGame?.tournamentId ? {id:currentGame.tournamentId,name:currentGame.tournamentName,rounds:currentGame.tournamentBracket,players:currentGame.tournamentPlayers||[]} : null)
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
        if(game?.tournamentId && currentTournament?.id !== game.tournamentId) currentTournament = {id:game.tournamentId,name:game.tournamentName,rounds:game.tournamentBracket,players:game.tournamentPlayers||[]};
        if(game?.tournamentId && currentTournament) {currentTournament.rounds=game.tournamentBracket;currentTournament.players=game.tournamentPlayers||currentTournament.players}
        return publishLatest();
      },
      refresh(game) {
        if (game) currentGame = game;
        if (!room) return Promise.reject(new Error('Share the match first'));
        return publishLatest();
      },
      async shareTournament(t,game=null) {
        currentTournament={id:t.id,name:t.name,rounds:t.rounds,players:t.rounds[0].flatMap(m=>[m.a,m.b]).filter(Boolean).map(c=>({...c,stats:window.DARTHS_TOUR_STATS?.(c.id)||{}}))};
        tournamentMode='intro';tournamentLiveId=t.id;
        currentGame=game?.tournamentId===t.id?game:null;
        if(!room){room=newRoom();generation++}
        await publishLatest();
        return new URL('./?watch='+room,location.href).href;
      },
      getTournamentLink(id){return room&&tournamentLiveId===id?new URL('./?watch='+room,location.href).href:null},
      async setTournamentView(t,mode,game=null,options={}){
        if(!room||!currentTournament||currentTournament.id!==t.id)throw new Error('Go Live first to create the spectator session');
        if(!['intro','bracket','match','stats','break','waiting'].includes(mode))throw new Error('Invalid spectator view');
        currentTournament.rounds=t.rounds;
        currentTournament.players=t.rounds[0].flatMap(m=>[m.a,m.b]).filter(Boolean).map(c=>({...c,stats:window.DARTHS_TOUR_STATS?.(c.id)||{}}));
        currentTournament.displayPlayerId=options.playerId??currentTournament.displayPlayerId??null;
        currentTournament.countdownEndsAt=options.endsAt??null;
        tournamentMode=mode;
        if(mode==='match'&&game)currentGame=game;
        if(mode!=='match' && !currentGame?.breakTime?.active)currentGame=null;
        await publishLatest();
      },
      updateTournament(t){
        if(!room||!currentTournament||currentTournament.id!==t.id)return Promise.resolve();
        currentTournament.rounds=t.rounds;
        return publishLatest();
      },
      async stop() {
        const old = room;
        room = null;
        currentGame = null;
        currentTournament = null;
        tournamentLiveId = null;
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

      let tourRecord=null,tourSelected=null,tourTimer=null;
      function tourCountdown(ends){if(!ends)return 'No timer';const seconds=Math.max(0,Math.ceil((ends-Date.now())/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}
      function renderTourView(record){
        lastSignature='';tourRecord=record;const g=record.game,b=g?.breakTime||{},t=record.tournament||{name:g?.tournamentName||'DARTHS',rounds:g?.tournamentBracket||[],players:g?.tournamentPlayers||[]};
        const mode=b.active?b.template:(record.viewMode||'intro'),players=t.players||[],selected=players.find(p=>String(p.id)===String(t.displayPlayerId??b.playerId??tourSelected))||players[0];
        const playerStats=p=>{if(!p)return '<p>Select a player.</p>';const s=p.stats||{};return `<div class="tour-watch-stats"><h2>${escapeHTML(p.label)}</h2><div class="tour-watch-statgrid"><div><b>${s.games??'—'}</b><small>Recorded games</small></div><div><b>${typeof s.average==='number'?s.average.toFixed(2):'—'}</b><small>3-dart average</small></div><div><b>${s.oneEighties??'—'}</b><small>180s</small></div><div><b>${s.high??'—'}</b><small>Highest turn</small></div></div></div>`};
        // Same card geometry and connector paths as the Host's bracket page.
        const bracket=(()=>{
          const rounds=t.rounds||[],width=226,gap=56,step=104;
          if(!rounds.length)return '<p>Waiting for the Host to prepare the bracket.</p>';
          const height=Math.max(190,rounds[0].length*step+54),fullWidth=rounds.length*(width+gap)+20;
          const center=(r,i)=>step*(Math.pow(2,r)*(i+.5))+16;
          const lines=[];
          for(let r=0;r<rounds.length-1;r++)for(let i=0;i<rounds[r].length;i++){
            const m=rounds[r][i],x1=r*(width+gap)+width+12,x2=(r+1)*(width+gap)-8;
            const y1=center(r,i),y2=center(r+1,Math.floor(i/2));
            lines.push(`<path d="M${x1} ${y1} H${x1+gap/2} V${y2} H${x2}" stroke="${m.winner?'#2ce8ad':'#517a9f'}" class="${m.winner?'tour-line-winner':''}"/>`);
          }
          const cards=rounds.map((round,r)=>round.map((m,i)=>{
            const completed=!!m.winner,ready=!!m.a&&!!m.b&&!completed;
            const person=p=>`<span class="tour-node-person ${completed&&m.winner?.id===p?.id?'tour-node-victor':''}">${p?escapeHTML(p.label):'To be determined'}${completed&&m.winner?.id===p?.id?' ✓':''}</span>`;
            return `<div class="tour-node ${completed?'tour-node-done':''} ${ready?'tour-node-ready':''}" style="left:${r*(width+gap)+12}px;top:${center(r,i)-37}px;width:${width}px"><small>${r===rounds.length-1?'FINAL':`ROUND ${r+1}`} · M${i+1}${m.status==='bye'?' · BYE':completed?' · FINISHED':''}</small>${person(m.a)}${person(m.b)}${m.score?`<small>${escapeHTML(m.score)}</small>`:''}</div>`;
          }).join('')).join('');
          return `<div class="tour-bracket-guide">Swipe horizontally to follow the tournament</div><div class="tour-bracket-scroll tour-spectator-scroll" tabindex="0"><div class="tour-bracket-canvas" style="width:${fullWidth}px;height:${height}px"><svg class="tour-bracket-lines" viewBox="0 0 ${fullWidth} ${height}">${lines.join('')}</svg>${cards}</div></div>`;
        })();
        const timerEnds=t.countdownEndsAt??b.endsAt??null;
        const timer=`<strong class="tour-screen-timer" id="tourTimer">${timerEnds?tourCountdown(timerEnds):'Waiting for Host'}</strong>`;
        const oldScroll=content.querySelector('.tour-spectator-scroll'),oldX=oldScroll?.scrollLeft||0,oldY=oldScroll?.scrollTop||0;
        const title=mode==='waiting'?'NEXT MATCH':'BREAK TIME';
        content.innerHTML=`<div class="tour-watch-shell"><div class="tour-watch-heading"><h1>🏆 ${escapeHTML(t.name)}</h1><span class="tour-live-tag">● TOURNAMENT LIVE</span></div>${mode==='intro'?`<div class="tour-watch-intro"><div class="tour-intro-trophy">🏆</div><div class="tour-intro-eyebrow">WELCOME TO</div><h1>DARTHS</h1><h2>${escapeHTML(t.name)}</h2><p>${players.length} players · Single Elimination</p><span>Waiting for the Host to display the bracket</span></div>`:mode==='waiting'||mode==='break'||mode==='commercial'?`<div class="tour-watch-pause"><div>${mode==='waiting'?'🎯':'☕'}</div><h2>${title}</h2>${timer}<p>${timerEnds&&timerEnds<=Date.now()?'READY FOR NEXT MATCH':mode==='waiting'?'Players, please prepare for your next match.':'We will be back shortly.'}</p></div>`:mode==='stats'?`<div class="tour-watch-back">PLAYER STATISTICS</div>${playerStats(selected)}`:`<div class="tour-spectator-bracket"><h2>TOURNAMENT BRACKET</h2>${bracket}</div>`}</div>`;
        const newScroll=content.querySelector('.tour-spectator-scroll');if(newScroll){newScroll.scrollLeft=oldX;newScroll.scrollTop=oldY;}
        clearInterval(tourTimer);if(timerEnds)tourTimer=setInterval(()=>{const el=content.querySelector('#tourTimer');if(el)el.textContent=tourCountdown(timerEnds);else clearInterval(tourTimer)},1000);
        content.querySelectorAll('[data-tour-watch-player]').forEach(el=>el.onclick=()=>{tourSelected=el.dataset.tourWatchPlayer;renderTourView(tourRecord)});

      }
      function renderRecord(record) {
        if(record?.tournament && (record.viewMode!=='match' || !record.game || record.game.breakTime?.active)){status.textContent='● LIVE';renderTourView(record);return}
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