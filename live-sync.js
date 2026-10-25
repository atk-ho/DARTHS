import { firebaseConfig } from './firebase-config.js';

const params = new URLSearchParams(location.search);
const viewing = params.has('watch');
const validRoom = id => /^[a-f0-9]{36}$/.test(id || '');
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const configured = Object.values(firebaseConfig).every(x => x && !String(x).includes('PASTE_'));

if (viewing) {
  document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="./tournament.css?v=20261025-1">');
  document.body.innerHTML = `<main class="watch-shell"><header class="watch-header"><div class="watch-brand"><img src="./icons/icon-192.png" alt=""> DARTHS</div><div class="watch-header-tools"><button id="watchFullscreen" type="button" aria-label="Enter spectator fullscreen">⛶ Fullscreen</button><span id="connection">Connecting…</span></div></header><div id="watchFullscreenPrompt" class="watch-fullscreen-prompt" hidden><span>Host requested fullscreen</span><button id="watchAcceptFullscreen" type="button">Enter Fullscreen</button><button id="watchDismissFullscreen" type="button" aria-label="Dismiss">✕</button></div><div id="watchContent" class="watch-content">Loading live scores…</div></main>`;
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
    let spectatorBracketSettings={zoom:100,fit:'auto'};
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
          tournament: currentTournament ? {...copy(currentTournament),bracketDisplay:copy(spectatorBracketSettings),audioConfig:window.DARTHS_AUDIO?.broadcastSettings?.()||null} : (currentGame?.tournamentId ? {id:currentGame.tournamentId,name:currentGame.tournamentName,rounds:currentGame.tournamentBracket,players:currentGame.tournamentPlayers||[]} : null)
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
      getBracketDisplay(){return {...spectatorBracketSettings}},
      async setBracketDisplay(options){
        spectatorBracketSettings={zoom:Math.max(50,Math.min(200,Number(options.zoom)||100)),fit:['auto','center','manual'].includes(options.fit)?options.fit:'auto'};
        if(room&&currentTournament)await publishLatest();
        return {...spectatorBracketSettings};
      },
      async requestSpectatorFullscreen(){
        if(!room || (!currentTournament && !currentGame))throw new Error('Go Live or share a match first');
        const request=Date.now();
        if(currentTournament)currentTournament.fullscreenRequest=request;
        else currentGame.spectatorFullscreenRequest=request;
        await publishLatest();
      },
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
        currentTournament={id:t.id,name:t.name,config:t.config,rounds:t.rounds,players:t.rounds[0].flatMap(m=>Array.isArray(m.players)?m.players:[m.a,m.b]).filter(Boolean).map(c=>({...c,stats:window.DARTHS_TOUR_STATS?.(c.id)||{}}))};
        tournamentMode='intro';tournamentLiveId=t.id;
        currentGame=game?.tournamentId===t.id?game:null;
        if(!room){room=newRoom();generation++}
        await publishLatest();
        return new URL('./?watch='+room,location.href).href;
      },
      getTournamentLink(id){return room&&tournamentLiveId===id?new URL('./?watch='+room,location.href).href:null},
      async setTournamentView(t,mode,game=null,options={}){
        if(!room||!currentTournament||currentTournament.id!==t.id)throw new Error('Go Live first to create the spectator session');
        if(!['intro','bracket','match','stats','break','waiting','upnext'].includes(mode))throw new Error('Invalid spectator view');
        currentTournament.rounds=t.rounds;currentTournament.config=t.config;
        currentTournament.players=t.rounds[0].flatMap(m=>Array.isArray(m.players)?m.players:[m.a,m.b]).filter(Boolean).map(c=>({...c,stats:window.DARTHS_TOUR_STATS?.(c.id)||{}}));
        currentTournament.displayPlayerId=options.playerId??currentTournament.displayPlayerId??null;
        currentTournament.countdownEndsAt=options.endsAt??null;
        currentTournament.upNext=options.upNext??null;
        tournamentMode=mode;
        if(mode==='match'&&game)currentGame=game;
        if(mode!=='match' && !currentGame?.breakTime?.active)currentGame=null;
        await publishLatest();
      },
      updateTournament(t){
        if(!room||!currentTournament||currentTournament.id!==t.id)return Promise.resolve();
        currentTournament.rounds=t.rounds;currentTournament.config=t.config;
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
       let lastTournamentSignature = '';

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

      if(!document.getElementById('darthsSpectatorStatsCSS')){const style=document.createElement('style');style.id='darthsSpectatorStatsCSS';style.textContent='\n/* Spectator player performance dashboard — scoped to the tournament stats view. */\n.darths-stat-dashboard{box-sizing:border-box;display:grid;gap:clamp(12px,2vw,20px);width:100%;max-width:1500px;margin:0 auto;padding:clamp(6px,1.4vw,18px);color:#f1f8ff}\n.darths-stat-dashboard *{box-sizing:border-box}\n.darths-stat-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}\n.darths-stat-eyebrow{font-size:clamp(11px,1.3vw,16px);font-weight:800;color:#54b9ff;letter-spacing:.08em}\n.darths-stat-heading h2{margin:5px 0 2px;text-align:left;font-size:clamp(26px,3.5vw,48px);line-height:1.1;overflow-wrap:anywhere}\n.darths-stat-heading p{margin:5px 0 0;color:#a8c9e4;font-size:clamp(12px,1.2vw,15px)}\n.darths-stat-heading-icon{display:grid;place-items:center;font-size:clamp(35px,6vw,66px);width:clamp(62px,9vw,110px);aspect-ratio:1;background:linear-gradient(135deg,#123c69,#09243e);border:1px solid #27618c;border-radius:22px}\n.darths-stat-hero{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:clamp(18px,2.6vw,32px);border:1px solid #177cc4;border-radius:17px;background:linear-gradient(115deg,#123f72,#092747 75%);box-shadow:inset 0 1px 0 #ffffff12}\n.darths-stat-hero>div:first-child{display:grid;gap:5px;min-width:0}.darths-stat-hero>div:first-child>span{color:#7fd5ff;font-size:clamp(11px,1.2vw,15px);font-weight:800;letter-spacing:.1em}\n.darths-stat-hero strong{font-size:clamp(38px,7vw,88px);line-height:1.1;letter-spacing:-.03em;font-variant-numeric:tabular-nums}\n.darths-stat-hero small{color:#afcde8;font-size:clamp(11px,1.2vw,15px)}\n.darths-stat-hero-ring{--fill:0%;width:clamp(95px,13vw,158px);aspect-ratio:1;flex:none;border-radius:50%;background:conic-gradient(#00c7f4 var(--fill),#245075 0);display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;isolation:isolate}\n.darths-stat-hero-ring:before{content:"";position:absolute;inset:11px;border-radius:50%;background:#103657;z-index:-1}\n.darths-stat-hero-ring span{font-size:clamp(22px,3vw,37px);font-weight:900}.darths-stat-hero-ring small{font-size:12px}\n.darths-stat-tiles{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}\n.darths-stat-tile{display:flex;flex-direction:column;justify-content:space-between;min-width:0;min-height:132px;padding:clamp(12px,1.4vw,19px);border:1px solid #285b86;border-radius:14px;background:linear-gradient(145deg,#153a60,#102b49)}\n.darths-stat-tile-heading{display:flex;gap:8px;align-items:center;color:#8bd7ff;font-size:clamp(11px,1vw,14px);font-weight:800}.darths-stat-tile-heading span:first-child{font-size:19px}\n.darths-stat-tile strong{font-size:clamp(25px,3vw,42px);line-height:1.15;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}\n.darths-stat-tile small{color:#afcce4;font-size:clamp(10px,.9vw,13px)}\n.darths-stat-tile.gold strong{color:#ffd260}.darths-stat-tile.green strong{color:#4ff0b1}.darths-stat-tile.red strong{color:#ff9a9a}\n.darths-stat-bottom{display:grid;grid-template-columns:1.3fr 1fr;gap:12px}\n.darths-stat-panel{min-width:0;border:1px solid #285b86;border-radius:14px;background:#0f2c4c;padding:clamp(15px,1.8vw,24px)}\n.darths-stat-panel h3{margin:0 0 22px;font-size:clamp(15px,1.5vw,20px)}\n.darths-stat-meter{margin-bottom:20px}.darths-stat-meter-label{display:flex;justify-content:space-between;gap:12px;font-size:clamp(12px,1.2vw,15px);margin-bottom:8px}.darths-stat-meter-label b{font-variant-numeric:tabular-nums}\n.darths-stat-meter-track{height:14px;background:#244966;border-radius:100px;overflow:hidden}.darths-stat-meter-track>span{display:block;height:100%;border-radius:100px;background:linear-gradient(90deg,#1677f2,#1dd9ff)}.darths-stat-meter-track>span.gold{background:linear-gradient(90deg,#e99c22,#ffdd55)}\n.darths-stat-panel p{margin:15px 0 0;color:#a5c3dc;font-size:clamp(11px,1vw,13px);line-height:1.5}\n.darths-stat-summary>div{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #2b5072;font-size:clamp(12px,1.2vw,15px)}.darths-stat-summary>div b{font-variant-numeric:tabular-nums}\n.darths-stat-empty{padding:30px;text-align:center;color:#a7cbe6}\n@media(max-width:900px){.darths-stat-tiles{grid-template-columns:repeat(3,minmax(0,1fr))}.darths-stat-bottom{grid-template-columns:1fr}}\n@media(max-width:560px){.darths-stat-dashboard{gap:10px;padding:3px}.darths-stat-heading-icon{width:60px;border-radius:14px}.darths-stat-hero{padding:15px}.darths-stat-hero-ring{width:90px}.darths-stat-hero-ring:before{inset:8px}.darths-stat-tiles{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.darths-stat-tile{min-height:110px;padding:12px}.darths-stat-tile:last-child{grid-column:1/-1;min-height:86px}.darths-stat-panel{padding:14px}}\n@media(orientation:landscape) and (max-height:520px){.darths-stat-tiles{grid-template-columns:repeat(5,minmax(0,1fr))}.darths-stat-tile{min-height:98px}.darths-stat-bottom{grid-template-columns:1.3fr 1fr}}\n\n/* Compact spectator dashboard: stay within the statistics display. */\n.darths-stat-dashboard{max-width:1400px;gap:10px;padding:5px;animation:none!important;transform:none!important}\n.darths-stat-heading h2{font-size:clamp(23px,2.6vw,36px);margin:2px 0}\n.darths-stat-heading-icon{width:clamp(48px,6vw,76px);border-radius:15px;font-size:clamp(28px,4vw,46px)}\n.darths-stat-hero{padding:clamp(12px,1.5vw,19px);min-height:0}\n.darths-stat-hero strong{font-size:clamp(34px,5vw,62px)}\n.darths-stat-hero-ring{width:clamp(76px,9vw,116px)}\n.darths-stat-hero-ring:before{inset:8px}\n.darths-stat-tiles{gap:9px}\n.darths-stat-tile{min-height:94px;padding:10px 12px}\n.darths-stat-tile strong{font-size:clamp(23px,2.3vw,32px)}\n.darths-stat-tile-heading span:first-child{font-size:16px}\n.darths-stat-bottom{gap:9px}\n.darths-stat-panel{padding:12px 16px}\n.darths-stat-panel h3{margin:0 0 12px;font-size:clamp(14px,1.2vw,17px)}\n.darths-stat-meter{margin-bottom:11px}\n.darths-stat-meter-track{height:10px}\n.darths-stat-panel p{margin:9px 0 0}\n.darths-stat-summary>div{padding:6px 0}\n@media(max-width:560px){.darths-stat-dashboard{gap:9px;padding:2px}.darths-stat-hero{padding:12px}.darths-stat-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.darths-stat-tile{min-height:95px}.darths-stat-tile:last-child{min-height:70px}.darths-stat-panel{padding:12px}}\n\n';document.head.appendChild(style)}
      let tourRecord=null,tourSelected=null,tourTimer=null;
      let lastFullscreenRequest=0;
      const enterFullscreen=async()=>{
        try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();document.getElementById('watchFullscreenPrompt').hidden=true}
        catch(e){document.getElementById('watchFullscreenPrompt').hidden=true;alert('Fullscreen is not supported in this browser. You can try adding DARTHS to your home screen.')}
      };
      document.getElementById('watchFullscreen').onclick=enterFullscreen;
      document.getElementById('watchAcceptFullscreen').onclick=enterFullscreen;
      document.getElementById('watchDismissFullscreen').onclick=()=>{document.getElementById('watchFullscreenPrompt').hidden=true};
      function spectatorFullscreenRequest(record){
        const requested=Number(record?.tournament?.fullscreenRequest||record?.game?.spectatorFullscreenRequest||0);
        if(requested>lastFullscreenRequest){lastFullscreenRequest=requested;document.getElementById('watchFullscreenPrompt').hidden=false}
      }
      function tourCountdown(ends){if(!ends)return 'No timer';const seconds=Math.max(0,Math.ceil((ends-Date.now())/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}
      function renderTourView(record){
        lastSignature='';tourRecord=record;const g=record.game,b=g?.breakTime||{},t=record.tournament||{name:g?.tournamentName||'DARTHS',rounds:g?.tournamentBracket||[],players:g?.tournamentPlayers||[]};
        const mode=b.active?b.template:(record.viewMode||'intro'),players=t.players||[],selected=players.find(p=>String(p.id)===String(t.displayPlayerId??b.playerId??tourSelected))||players[0];
        const playerStats=p=>{
          if(!p)return '<div class="darths-stat-empty">Waiting for the Host to select a player.</div>';
          const s=p.stats||{},safe=n=>Number.isFinite(Number(n))?Math.max(0,Number(n)):null;
          const games=safe(s.games),avg=safe(s.average),high=safe(s.high),darts=safe(s.darts),one80=safe(s.oneEighties),busts=safe(s.busts);
          const value=(n,decimals=0)=>n===null?'—':n.toLocaleString(undefined,{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
          const avgPct=avg===null?0:Math.min(100,avg/180*100),highPct=high===null?0:Math.min(100,high/180*100);
          const card=(icon,label,n,note,accent='blue')=>`<div class="darths-stat-tile ${accent}"><div class="darths-stat-tile-heading"><span aria-hidden="true">${icon}</span><span>${label}</span></div><strong>${n}</strong><small>${note}</small></div>`;
          const bar=(label,n,pct,color)=>`<div class="darths-stat-meter"><div class="darths-stat-meter-label"><span>${label}</span><b>${n}</b></div><div class="darths-stat-meter-track"><span class="${color}" style="width:${pct.toFixed(2)}%"></span></div></div>`;
          return `<section class="darths-stat-dashboard" aria-label="Statistics for ${escapeHTML(p.label)}">
            <div class="darths-stat-heading"><div><span class="darths-stat-eyebrow">🎯 PLAYER PERFORMANCE</span><h2>${escapeHTML(p.label)}</h2><p>${games===null?'Historical statistics unavailable':`${value(games)} recorded ${games===1?'game':'games'}`}</p></div><div class="darths-stat-heading-icon" aria-hidden="true">🎯</div></div>
            <div class="darths-stat-hero"><div><span>3-DART AVERAGE</span><strong>${value(avg,2)}</strong><small>Average points scored per three darts</small></div><div class="darths-stat-hero-ring" style="--fill:${avgPct.toFixed(2)}%"><span>${avg===null?'—':Math.round(avgPct)+'%'}</span><small>of 180</small></div></div>
            <div class="darths-stat-tiles">${card('🎮','Games Played',value(games),'Recorded matches')}${card('🏆','Highest Turn',value(high),'Best turn score','gold')}${card('💥','180s',value(one80),'Maximum turns','green')}${card('🎯','Darts Thrown',value(darts),'Recorded darts')}${card('⚠️','Busts',value(busts),'Recorded busts','red')}</div>
            <div class="darths-stat-bottom"><div class="darths-stat-panel"><h3>📊 Performance Overview</h3>${bar('3-dart average',value(avg,2),avgPct,'blue')}${bar('Highest turn',value(high),highPct,'gold')}<p>Bars are scaled against the maximum possible 180-point turn.</p></div><div class="darths-stat-panel darths-stat-summary"><h3>📋 Career Snapshot</h3><div><span>Games played</span><b>${value(games)}</b></div><div><span>Total darts</span><b>${value(darts)}</b></div><div><span>180-point turns</span><b>${value(one80)}</b></div><div><span>Busts</span><b>${value(busts)}</b></div><p>Statistics reflect saved match history shared by the Host.</p></div></div>
          </section>`;
        };
        // Same card geometry and connector paths as the Host's bracket page.
        const bracket=(()=>{
          const rounds=t.rounds||[],width=226,gap=56,knockout=t.config?.elimination==='knockout',step=knockout?166:104;
          if(!rounds.length)return '<p>Waiting for the Host to prepare the bracket.</p>';
          const fullWidth=rounds.length*(width+gap)+20;
          const centers=[];
          for(let r=0;r<rounds.length;r++){
            centers[r]=[];
            for(let i=0;i<rounds[r].length;i++){
              if(!knockout)centers[r][i]=104*(Math.pow(2,r)*(i+.5))+16;
              else if(r===0)centers[r][i]=step*(i+.5)+20;
              else{const sources=rounds[r][i].sourceMatches||[];centers[r][i]=sources.length?sources.reduce((a,k)=>a+centers[r-1][k],0)/sources.length:step*(i+.5)+20}
            }
          }
          const height=Math.max(190,rounds[0].length*(knockout?step:104)+54);
          const lines=[];
          for(let r=0;r<rounds.length-1;r++)for(let i=0;i<rounds[r].length;i++){
            const m=rounds[r][i],target=knockout?m.next?.match:Math.floor(i/2);if(target==null)continue;
            const x1=r*(width+gap)+width+12,x2=(r+1)*(width+gap)-8;
            const y1=centers[r][i],y2=centers[r+1][target];
            lines.push(`<path d="M${x1} ${y1} H${x1+gap/2} V${y2} H${x2}" stroke="${m.winner?'#2ce8ad':'#517a9f'}" class="${m.winner?'tour-line-winner':''}"/>`);
          }
          const cards=rounds.map((round,r)=>round.map((m,i)=>{
            const people=Array.isArray(m.players)?m.players:[m.a,m.b],completed=!!m.winner,ready=people.length>=2&&people.every(Boolean)&&!completed;
            const person=p=>`<span class="tour-node-person ${completed&&m.winner?.id===p?.id?'tour-node-victor':''}">${p?escapeHTML(p.label):'To be determined'}${completed&&m.winner?.id===p?.id?' ✓':''}</span>`;
            const top=centers[r][i]-(knockout?(people.length*26+27)/2:37);
            return `<div class="tour-node ${knockout?'tour-node-multi':''} ${completed?'tour-node-done':''} ${ready?'tour-node-ready':''}" style="left:${r*(width+gap)+12}px;top:${top}px;width:${width}px"><small>${r===rounds.length-1?'FINAL':`ROUND ${r+1}`} · M${i+1}${m.status==='bye'?' · BYE':completed?' · FINISHED':''}</small>${people.map(person).join('')}${m.score?`<small>${escapeHTML(m.score)}</small>`:''}</div>`;
          }).join('')).join('');
          return `<div class="tour-bracket-scroll tour-spectator-scroll" tabindex="0"><div class="tour-bracket-canvas" style="width:${fullWidth}px;height:${height}px"><svg class="tour-bracket-lines" viewBox="0 0 ${fullWidth} ${height}">${lines.join('')}</svg>${cards}</div></div>`;
        })();
        const settings=t.bracketDisplay||{zoom:100,fit:'auto'};
        const bracketScale=Math.max(.5,Math.min(2,(Number(settings.zoom)||100)/100));
        const bracketFit=['auto','center','manual'].includes(settings.fit)?settings.fit:'auto';
        const timerEnds=t.countdownEndsAt??b.endsAt??null;
        const timer=`<strong class="tour-screen-timer" id="tourTimer">${timerEnds?tourCountdown(timerEnds):'Waiting for Host'}</strong>`;
        const oldScroll=content.querySelector('.tour-spectator-scroll'),oldX=oldScroll?.scrollLeft||0,oldY=oldScroll?.scrollTop||0;
        const title=mode==='waiting'?'NEXT MATCH':'BREAK TIME';
        content.innerHTML=`<div class="tour-watch-shell">${mode==='intro'?`<div class="tour-watch-intro"><div class="tour-intro-trophy">🏆</div><div class="tour-intro-eyebrow">WELCOME TO</div><h1>DARTHS</h1><h2>${escapeHTML(t.name)}</h2><p>${players.length} players · ${t.config?.elimination==='knockout'?'Knockout':'Standard'} Elimination</p><span>Waiting for the Host to display the bracket</span></div>`:mode==='upnext'?`<div class="tour-watch-upnext"><div class="tour-upnext-label">🎯 UP NEXT · ROUND ${t.upNext?.round||1} · MATCH ${t.upNext?.match||1}</div><div class="tour-watch-versus tour-watch-versus-multi">${(t.upNext?.players||[t.upNext?.a||'Player A',t.upNext?.b||'Player B']).map((p,i,arr)=>`<strong>${escapeHTML(p)}</strong>${i<arr.length-1?'<span>VS</span>':''}`).join('')}</div><p>MATCH STARTS WHEN THE HOST IS READY</p><strong class="tour-screen-timer" id="tourTimer">${t.upNext?.started?tourCountdown(t.upNext?.endsAt):tourCountdown(Date.now()+(t.upNext?.remainingMs||300000))}</strong><p id="tourUpNextStatus">${t.upNext?.started?(t.upNext?.endsAt?'Countdown running':'Countdown paused'):'Waiting for countdown'}</p></div>`:mode==='waiting'||mode==='break'||mode==='commercial'?`<div class="tour-watch-pause"><div>${mode==='waiting'?'🎯':'☕'}</div><h2>${title}</h2>${timer}<p>${timerEnds&&timerEnds<=Date.now()?'READY FOR NEXT MATCH':mode==='waiting'?'Players, please prepare for your next match.':'We will be back shortly.'}</p></div>`:mode==='stats'?`<div class="tour-watch-back">PLAYER STATISTICS</div>${playerStats(selected)}`:`<div class="tour-spectator-bracket" data-bracket-fit="${bracketFit}"><h2>🏆 ${escapeHTML(t.name)}</h2>${bracket}</div>`}</div>`;
        const newScroll=content.querySelector('.tour-spectator-scroll');
        if(newScroll){
          const canvas=newScroll.querySelector('.tour-bracket-canvas');
          const w=canvas.offsetWidth,h=canvas.offsetHeight;
          const fitScale=bracketFit==='auto'?Math.min(1,newScroll.clientWidth/Math.max(1,w),newScroll.clientHeight/Math.max(1,h)):1;
          const actual=Math.max(.25,fitScale*bracketScale);
          canvas.style.transform=`scale(${actual})`;
          canvas.style.transformOrigin='top left';
          const sizing=document.createElement('div');sizing.className='tour-bracket-zoom-space';
          sizing.style.width=`${Math.ceil(w*actual)}px`;sizing.style.height=`${Math.ceil(h*actual)}px`;
          canvas.parentNode.insertBefore(sizing,canvas);sizing.appendChild(canvas);
          newScroll.scrollLeft=oldX;newScroll.scrollTop=oldY;
        }
        clearInterval(tourTimer);
        if(mode==='upnext'){
          const update=()=>{const el=content.querySelector('#tourTimer'),note=content.querySelector('#tourUpNextStatus');if(!el)return;const u=t.upNext||{},left=u.endsAt?Math.max(0,u.endsAt-Date.now()):u.remainingMs??300000;el.textContent=tourCountdown(Date.now()+left);if(note&&u.started&&left===0)note.textContent='READY TO START · Waiting for Host'};
          update();tourTimer=setInterval(update,500);
        }else if(timerEnds)tourTimer=setInterval(()=>{const el=content.querySelector('#tourTimer');if(el)el.textContent=tourCountdown(timerEnds);else clearInterval(tourTimer)},1000);
        content.querySelectorAll('[data-tour-watch-player]').forEach(el=>el.onclick=()=>{tourSelected=el.dataset.tourWatchPlayer;renderTourView(tourRecord)});

      }
      function renderRecord(record) {
        window.DARTHS_AUDIO?.watchRecord(record);
        spectatorFullscreenRequest(record);
        if(record?.tournament && (record.viewMode!=='match' || !record.game || record.game.breakTime?.active)){status.textContent='● TOURNAMENT LIVE';const tournamentSignature=JSON.stringify(record);if(tournamentSignature!==lastTournamentSignature){lastTournamentSignature=tournamentSignature;renderTourView(record)}return}
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
                // A spectator is read-only: host drives winner/results phase via game.resultView.
        if (g.finished) {
          status.textContent = '● LIVE · MATCH FINISHED';
          const winner = g.participants[g.winnerIndex] || g.participants[0];
          const winnerName = escapeHTML(winner?.label || 'Winner');const championText=g.championName?`<h2>🏆 TOURNAMENT CHAMPION</h2><p>${escapeHTML(g.tournamentName||'Championship')}</p>`:'';
          const resultsMode = g.resultView === 'results';
          const sorted = [...g.participants].sort((a,b) => (b.sets||0)-(a.sets||0) || (b.legs||0)-(a.legs||0) || (a.remaining||0)-(b.remaining||0));
          const totalDarts = g.participants.reduce((n,p)=>n+(p.stats?.darts||0),0);
          const resultRows = sorted.map((p,i) => `<tr><td>${i+1}</td><td>${p===winner?'👑 ':''}${escapeHTML(p.label)}</td><td>${p.remaining}</td><td>${p.sets||0}</td><td>${p.legs||0}</td><td>${p.stats?.darts||0}</td><td>${p.stats?.darts?(3*(p.stats.scored||0)/p.stats.darts).toFixed(2):'0.00'}</td><td>${p.stats?.high||0}</td><td>${p.stats?.checkoutHits||0} / ${p.stats?.checkoutAttempts||0}</td><td>${p===winner?'WINNER':'—'}</td></tr>`).join('');
          const overlay = resultsMode
            ? `<div class="watch-modal" role="dialog" aria-label="Match results"><div class="watch-modal-panel watch-results-panel"><h1>🏆 Game Results</h1>${championText}<p>${g.points} Darts · Set ${g.setNumber} · Leg ${g.legNumber}</p><div class="watch-table-scroll"><table><thead><tr><th>#</th><th>Player</th><th>Final</th><th>Sets</th><th>Legs</th><th>Darts</th><th>Average</th><th>High</th><th>Checks</th><th>Status</th></tr></thead><tbody>${resultRows}</tbody></table></div><div class="watch-summary"><div>Total Darts<strong>${totalDarts}</strong></div><div>Rounds<strong>${g.round||1}</strong></div><div>Winner<strong>${winnerName}</strong></div></div><p class="watch-viewonly">Live results · Spectator view only</p></div></div>`
            : `<div class="watch-modal" role="dialog" aria-label="Winner announcement"><div class="watch-modal-panel watch-winner-panel ${g.championName?'tour-champion-celebration':''}">${g.championName?`<div class="tour-confetti" aria-hidden="true">${Array.from({length:45},(_,i)=>`<i style="--x:${(i*37)%100}%;--delay:${(i*13)%31/10}s;--duration:${3+(i%5)}s"></i>`).join('')}</div>`:''}<div class="watch-trophy">🏆</div><h1>CONGRATULATIONS!</h1>${g.championName?`<h2 class="tour-champion-name">${winnerName}</h2>${championText}`:`${championText}<h2>${winnerName} is the Winner!</h2>`}<p>${g.points} Darts · Set ${g.setNumber} · Leg ${g.legNumber}</p><p>Winner by Checkout!</p></div></div>`;
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