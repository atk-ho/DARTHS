import {firebaseConfig} from './firebase-config.js';
const params=new URLSearchParams(location.search);
const viewing=params.has('watch');
const configured=!Object.values(firebaseConfig).some(x=>String(x).includes('PASTE_'));
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(viewing){document.body.innerHTML=`<main class="watch-shell"><header class="watch-header"><div class="watch-brand"><img src="./icons/icon-192.png" alt=""> DARTHS</div><span id="connection">Connecting…</span></header><div id="watchContent" class="watch-content">Loading live scores…</div></main>`;document.title='DARTHS · Live Scoreboard';}
if(!configured){if(viewing)document.getElementById('watchContent').textContent='Firebase is not configured yet. Edit firebase-config.js first.';}
else {
try{
const [{initializeApp},{getAuth,signInAnonymously},{getDatabase,ref,set,onValue,remove}]=await Promise.all([
 import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
 import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
 import('https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js')]);
const app=initializeApp(firebaseConfig);const auth=getAuth(app);const database=getDatabase(app);
const credential=await signInAnonymously(auth);const uid=credential.user.uid;
const KEY='darths_live_room_v4';
let room=localStorage.getItem(KEY);
let pending=Promise.resolve();
let revision=0;
function enqueue(game, force=false){
 if(!room)return Promise.reject(new Error('Share a match first'));
 const data=payload(game); data.revision=++revision;
 // Serialized writes prevent an older throw from overwriting a newer throw.
 pending=pending.catch(()=>{}).then(()=>set(roomRef(),data));
 return pending;
}

const roomRef=()=>ref(database,'liveMatches/'+room);
const newRoom=()=>{const bytes=new Uint8Array(18);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')};
const payload=g=>({owner:uid,updatedAt:Date.now(),game:JSON.parse(JSON.stringify(g))});
window.DARTHS_SYNC={
 async share(g){if(!room){room=newRoom();localStorage.setItem(KEY,room)}await enqueue(g,true);return new URL('./?watch='+room,location.href).href},
 async publish(g){if(room)return enqueue(g)},
 async refresh(g){return enqueue(g,true)},
 async stop(){if(room){await pending.catch(()=>{});await remove(roomRef());localStorage.removeItem(KEY);room=null}}
};
window.dispatchEvent(new Event('darths-sync-ready'));
if(viewing){const id=params.get('watch');if(!/^[a-f0-9]{36}$/.test(id))throw Error('Invalid sharing code');onValue(ref(database,'liveMatches/'+id),snap=>{const content=document.getElementById('watchContent');const status=document.getElementById('connection');const record=snap.val();if(!record?.game){status.textContent='WAITING';content.textContent='No active shared match found.';return}status.textContent='● LIVE';const g=record.game;document.body.classList.toggle('many-players',g.participants.length>=4);content.innerHTML=`<section class="watch-overview"><h1>${g.points} Darts</h1><div class="overview-grid"><div><small>START SCORE</small><strong>${g.points}</strong></div><div><small>CHECK-IN</small><strong>${escapeHTML(g.checkin)}</strong></div><div><small>CHECKOUT</small><strong>${escapeHTML(g.checkout)}</strong></div></div><p>Set ${g.setNumber} · Leg ${g.legNumber} · Round ${g.round} · ${g.format==='best'?'Best of':'First to'} ${g.legs} legs</p></section><section class="watch-rows">${g.participants.map((p,i)=>{const shown=i===g.current&&g.turn.length?g.turn:(p.last||[]);const bust=!!p.lastBust&&i!==g.current;const avg=p.stats.darts?(p.stats.scored/p.stats.darts*3).toFixed(2):'0.00';return `<div class="watch-row ${i===g.current?'active':''} ${bust?'bust':''}"><div class="watch-left"><strong>${p.remaining}</strong><span>${escapeHTML(p.label)}</span></div><div class="watch-middle"><div class="watch-darts">${[0,1,2].map(j=>`<div>${shown[j]?escapeHTML(shown[j].label):''}</div>`).join('')}</div><b>${bust?0:shown.reduce((a,d)=>a+(d.score||0),0)}</b></div><div class="watch-right"><small>Sets: ${p.sets} · Legs: ${p.legs}</small><span>🎯 ${p.stats.darts}</span><span>⊘ ${avg}</span></div></div>`}).join('')}</section><footer>${escapeHTML(g.participants[g.current]?.label||'Player')}'s turn</footer>`;},err=>{document.getElementById('connection').textContent='ERROR';document.getElementById('watchContent').textContent=err.message})}
}catch(e){if(viewing){document.getElementById('connection').textContent='ERROR';document.getElementById('watchContent').textContent=e.message}else{console.warn('DARTHS live sharing unavailable:',e)}}
}
