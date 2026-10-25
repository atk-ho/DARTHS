/* DARTHS Audio Manager — original procedural WebAudio themes, no third-party audio.
   Audio settings are device-local; spectator playback requires an initial user gesture. */
(() => {
'use strict';
const KEY='darths_audio_v1', viewing=new URLSearchParams(location.search).has('watch');
const EVENTS={
 welcome:['Welcome Screen',true],upnext:['Upcoming Match',true],break:['Break Screen',true],
 start:['Match Start',false],dart:['Dart Throw',false],turn:['Turn Complete',false],
 bust:['Bust',false],one80:['180',false],leg:['Leg Win',false],set:['Set Win',false],
 match:['Match Win',false],champion:['Tournament Champion',true]
};
const defaults={master:80,music:true,effects:true,voice:true,duck:true,output:'spectator',events:{}};
let settings;try{settings={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{settings={...defaults}};
settings.events=settings.events||{};
for(const [id,[label,loop]] of Object.entries(EVENTS))
 settings.events[id]={source:'builtin',loop,volume:80,...settings.events[id]};
let ctx=null,master=null,musicBus=null,fxBus=null,themeTimer=null,themeKey='',step=0,media=null,blobUrl=null,watchLastCue='',watchLastMode='',unlocked=false,playingToken=0,customCache=new Map();
const get=(id)=>settings.events[id]||{source:'builtin',loop:false,volume:80};
function persist(){localStorage.setItem(KEY,JSON.stringify(settings))}
function enabled(kind){return (kind==='music'?settings.music:settings.effects)&&settings.master>0}
function context(){
 if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();musicBus=ctx.createGain();fxBus=ctx.createGain();musicBus.connect(master);fxBus.connect(master);master.connect(ctx.destination)}
 master.gain.setTargetAtTime(settings.master/100,ctx.currentTime,.05);
 return ctx;
}
async function unlock(){try{await context().resume();unlocked=true;document.querySelector('#darthsEnableAudio')?.remove();return true}catch{return false}}
function tone(freq,duration=.2,when=0,volume=.16,type='triangle',bus='fx'){
 if(!ctx||ctx.state!=='running')return;
 const at=ctx.currentTime+when,o=ctx.createOscillator(),v=ctx.createGain();
 o.type=type;o.frequency.setValueAtTime(Math.max(40,freq),at);
 v.gain.setValueAtTime(.0001,at);v.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),at+.025);
 v.gain.exponentialRampToValueAtTime(.0001,at+duration);
 o.connect(v);v.connect(bus==='music'?musicBus:fxBus);o.start(at);o.stop(at+duration+.02);
}
const scales={
 welcome:[261.63,329.63,392,523.25,392,329.63,293.66,392],
 upnext:[220,261.63,329.63,392,329.63,261.63,196,246.94],
 break:[196,246.94,293.66,246.94,220,261.63,293.66,220],
 champion:[261.63,329.63,392,523.25,659.25,783.99,659.25,1046.5]
};
function stopMusic(){playingToken++;clearInterval(themeTimer);themeTimer=null;themeKey='';if(media){media.pause();media.currentTime=0;media=null}if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null}}
function melody(key){
 const c=context();if(c.state!=='running')return;
 const notes=scales[key]||scales.welcome,idx=step++%notes.length;
 const conf=get(key),gain=conf.volume/100*.11*(settings.duck&&(typeof speechSynthesis!=='undefined'&&speechSynthesis.speaking)? .35:1);
 tone(notes[idx],key==='champion'?.48:.33,0,gain,'triangle','music');
 if(idx%2===0)tone(notes[idx]*1.5,.2,.04,gain*.25,'sine','music');
 if(idx%4===0){
  const bass=notes[idx]/2;
  tone(bass,1.0,0,gain*.65,'sine','music');
  tone(bass*1.25,.85,.03,gain*.28,'triangle','music');
  tone(bass*1.5,.9,.05,gain*.25,'sine','music');
 }
 if(key==='champion'&&idx%2===1)tone(notes[idx]*2,.4,.08,gain*.24,'sine','music');
}
function storage(){return new Promise((resolve,reject)=>{const r=indexedDB.open('darths-audio-library',1);r.onupgradeneeded=()=>r.result.createObjectStore('tracks');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function saveFile(id,file){const db=await storage();await new Promise((resolve,reject)=>{const t=db.transaction('tracks','readwrite');t.objectStore('tracks').put(file,id);t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close();customCache.set(id,file)}
async function loadFile(id){if(customCache.has(id))return customCache.get(id);const db=await storage();const value=await new Promise((resolve,reject)=>{const t=db.transaction('tracks');const r=t.objectStore('tracks').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();if(value)customCache.set(id,value);return value}
async function startTheme(key){
 if(!enabled('music')||!get(key)||get(key).source==='off'||!unlocked){stopMusic();return}
 if(themeKey===key)return;
 stopMusic();themeKey=key;const token=playingToken,conf=get(key);
 if(conf.source==='custom'){
  try{
   const file=await loadFile(key);
   // Files uploaded on Host are intentionally NOT sent to spectator via Firebase.
   const url=(viewing?conf.url:null)||(file?URL.createObjectURL(file):conf.url);
   if(token!==playingToken)return;
   if(!url){console.warn('No custom audio file or hosted URL for',key);return;}
   if(file&&!viewing)blobUrl=url;
   media=new Audio(url);media.loop=conf.loop;media.volume=Math.min(1,settings.master/100*conf.volume/100);
   await media.play();return;
  }catch(e){console.warn('Custom DARTHS audio unavailable',e);return}
 }
 if(!scales[key])return;
 step=0;const run=()=>{if(themeKey!==key)return;melody(key);if(!conf.loop&&step>=scales[key].length)stopMusic()};
 run();themeTimer=setInterval(run,key==='champion'?260:340);
}
function fx(key){
 if(!enabled('effects')||get(key).source==='off'||!unlocked)return;
 if(get(key).source==='custom'){
  (async()=>{const file=await loadFile(key);const url=(viewing?get(key).url:null)||(file?URL.createObjectURL(file):get(key).url);if(!url)return;const a=new Audio(url);a.volume=settings.master/100*get(key).volume/100;a.loop=get(key).loop;a.play().catch(()=>{});if(file&&!viewing)a.onended=()=>URL.revokeObjectURL(url)})();return;
 }
 const v=get(key).volume/100*.19;
 const sequences={
 dart:[650],turn:[523,659],bust:[230,170,130],one80:[523,659,783,1046,1318],
 leg:[392,523,659,784],set:[392,523,659,784,1046],match:[392,523,784,1046,1318,1568],
 start:[261,392,523]
 };
 (sequences[key]||[500]).forEach((f,i)=>tone(f,key==='bust'?.23:.29,i*(key==='bust'?.14:.17),v,key==='bust'?'sawtooth':'triangle'));
}
function speak(text){
 if(!settings.voice||!text||!('speechSynthesis'in window))return;
 try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(text));u.rate=.94;u.volume=settings.master/100;
  if(settings.duck&&musicBus&&ctx)musicBus.gain.setTargetAtTime(.25,ctx.currentTime,.1);
  u.onend=u.onerror=()=>{if(musicBus&&ctx)musicBus.gain.setTargetAtTime(1,ctx.currentTime,.25)};
  speechSynthesis.speak(u)}catch(e){console.warn('Voice unavailable',e)}
}
function cue(type,label){
 if(!type)return;
 if(type==='champion'){fx('match');if(viewing||settings.output==='both'||settings.output==='host')startTheme('champion');speak(`Ladies and gentlemen, your DARTHS tournament champion, ${label||'the winner'}!`)}
 else if(type==='match'){stopMusic();fx('match');speak(`${label||'Player'} wins the match!`)}
 else if(type==='one80'){fx('one80');speak('One hundred and eighty!')}
 else if(type==='leg'||type==='set'){fx(type);speak(`${label||'Player'} wins the ${type}!`)}
 else if(type==='bust'){fx('bust');speak('Bust')}
 else if(type==='turn'){fx('turn');if(label)speak(label)}
 else fx(type);
}
function broadcastSettings(){
 const events={};for(const id of Object.keys(EVENTS)){const c=get(id);events[id]={source:c.source,volume:c.volume,loop:c.loop,...(c.url&&/^https:\/\//.test(c.url)?{url:c.url}:{})}}
 return {output:settings.output,music:settings.music,effects:settings.effects,voice:settings.voice,events};
}
function watchRecord(record){
 if(!viewing)return;
 const remote=record?.tournament?.audioConfig||record?.game?.audioConfig||null;
 if(remote){
  // Spectator controls its own master volume and initial audio permission.
  settings.music=remote.music!==false;settings.effects=remote.effects!==false;settings.voice=remote.voice!==false;
  for(const id of Object.keys(EVENTS))if(remote.events?.[id])settings.events[id]={...get(id),...remote.events[id]};
  if(remote.output==='host'){stopMusic();return}
 }
 const g=record?.game,t=record?.tournament,mode=record?.viewMode||'match';
 const musicKey=g?.finished&&g.championName&&g.resultView!=='results'?'champion':
  g?.finished?'':g?.breakTime?.active?'break':
  mode==='intro'?'welcome':mode==='upnext'?'upnext':mode==='break'||mode==='waiting'?'break':'';
 if(unlocked){if(musicKey)startTheme(musicKey);else stopMusic()}
 else watchLastMode=musicKey;
 const event=g?.audioEvent;
 if(event?.id&&event.id!==watchLastCue){watchLastCue=event.id;if(unlocked && Date.now()-(event.at||0)<12000)cue(event.type,event.label)}
}
function showEnableButton(){
 if(!viewing)return;
 const place=document.querySelector('.watch-header-tools');if(!place||document.querySelector('#darthsEnableAudio'))return;
 const b=document.createElement('button');b.id='darthsEnableAudio';b.type='button';b.textContent='🔊 Enable Audio';b.title='Tap once to enable spectator music and sound';
 b.onclick=async()=>{if(await unlock()){if(watchLastMode)startTheme(watchLastMode);b.remove()}};
 place.prepend(b);
}
const name=(id)=>EVENTS[id][0];
function notify(message){const el=document.getElementById('toast');if(el){el.textContent=message;el.style.display='block';setTimeout(()=>el.style.display='none',3500)}else console.info(message)}
function managerHTML(){
 return `<section class="darths-audio-manager panel" id="darthsAudioManager">
 <h2>🎵 DARTHS Sound & Music</h2><p class="muted">Original built-in synthesized themes, or your own audio files. Settings are saved on this device.</p>
 <div class="darths-audio-switches">
 ${[['music','Background Music'],['effects','Sound Effects'],['voice','Voice Announcer'],['duck','Lower Music During Voice']].map(([id,label])=>`<label><input type="checkbox" data-audio-flag="${id}" ${settings[id]?'checked':''}> ${label}</label>`).join('')}
 </div>
 <label>Master Volume <strong id="audioVolumeLabel">${settings.master}%</strong></label>
 <input type="range" min="0" max="100" step="5" value="${settings.master}" id="audioMaster">
 <label>Music output <select id="audioOutput"><option value="spectator">Spectator Only</option><option value="host">Host Only</option><option value="both">Host & Spectator</option></select></label>
 <div class="darths-audio-event-list">${Object.entries(EVENTS).map(([id,[label]])=>{
 const c=get(id);return `<details class="darths-audio-event"><summary>${label} <small>${c.source==='builtin'?'Built-in DARTHS':c.source==='custom'?'Custom audio':'Off'}</small></summary>
 <div class="darths-audio-event-body"><label>Source<select data-audio-source="${id}"><option value="builtin" ${c.source==='builtin'?'selected':''}>Built-in DARTHS</option><option value="custom" ${c.source==='custom'?'selected':''}>Custom Audio</option><option value="off" ${c.source==='off'?'selected':''}>Off</option></select></label>
 <label>Volume <span data-audio-value="${id}">${c.volume}%</span><input type="range" min="0" max="100" step="5" value="${c.volume}" data-audio-volume="${id}"></label>
 <label><input type="checkbox" data-audio-loop="${id}" ${c.loop?'checked':''}> Loop</label>
 <label>Upload audio (stored on this device)<input type="file" accept="audio/*" data-audio-file="${id}"></label>
 <label>Hosted audio URL for spectators<input type="url" placeholder="https://example.com/music.mp3" data-audio-url="${id}" value="${(c.url||'').replace(/"/g,'&quot;')}"></label>
 <button type="button" data-audio-preview="${id}">▶ Preview</button><button type="button" data-audio-stop>■ Stop</button>
 </div></details>`}).join('')}</div>
 <p class="muted">Spectators must tap Enable Audio once. Uploaded files are local; to share custom music across devices, use a public HTTPS audio URL. Built-in music requires no uploads.</p></section>`;
}
function mountManager(){
 if(viewing||document.querySelector('#darthsAudioManager'))return;
 const settingsPage=document.querySelector('#settings');if(!settingsPage){console.warn('DARTHS: Settings tab missing; audio manager cannot mount');return;}
 const block=document.createElement('div');block.innerHTML=managerHTML();settingsPage.insertBefore(block.firstElementChild,settingsPage.querySelector('.legal-settings'));
 const root=document.querySelector('#darthsAudioManager');root.querySelector('#audioOutput').value=settings.output;
 root.addEventListener('change',async e=>{
  const d=e.target;
  if(d.dataset.audioFlag){settings[d.dataset.audioFlag]=d.checked;persist();if(d.dataset.audioFlag==='music'&&!d.checked)stopMusic()}
  if(d.dataset.audioSource){get(d.dataset.audioSource).source=d.value;persist();root.querySelector(`[data-audio-source="${d.dataset.audioSource}"]`).closest('details').querySelector('summary small').textContent=d.value==='builtin'?'Built-in DARTHS':d.value==='custom'?'Custom audio':'Off'}
  if(d.dataset.audioLoop){get(d.dataset.audioLoop).loop=d.checked;persist()}
  if(d.dataset.audioFile&&d.files?.[0]){const f=d.files[0];if(f.size>15*1024*1024){notify('Please select an audio file smaller than 15 MB');return}try{await saveFile(d.dataset.audioFile,f);get(d.dataset.audioFile).source='custom';persist();root.querySelector(`[data-audio-source="${d.dataset.audioFile}"]`).value='custom';notify('Audio saved locally. Add a hosted URL for spectators.')}catch(err){notify('Could not save audio: '+err.message)}}
 });
 root.addEventListener('input',e=>{
  const d=e.target;
  if(d.id==='audioMaster'){settings.master=Number(d.value);root.querySelector('#audioVolumeLabel').textContent=d.value+'%';persist();if(ctx)master.gain.setTargetAtTime(settings.master/100,ctx.currentTime,.04)}
  if(d.dataset.audioVolume){get(d.dataset.audioVolume).volume=Number(d.value);root.querySelector(`[data-audio-value="${d.dataset.audioVolume}"]`).textContent=d.value+'%';persist()}
  if(d.dataset.audioUrl){const url=d.value.trim();get(d.dataset.audioUrl).url=/^https:\/\//.test(url)?url:'';persist()}
  if(d.id==='audioOutput'){settings.output=d.value;persist();if(d.value==='spectator')stopMusic()}
 });
 root.addEventListener('click',async e=>{
  const preview=e.target.closest('[data-audio-preview]');if(preview){await unlock();const id=preview.dataset.audioPreview;if(scales[id])startTheme(id);else cue(id);return}
  if(e.target.closest('[data-audio-stop]'))stopMusic();
 });
}
if(!viewing)document.addEventListener('pointerdown',()=>{unlock().catch(()=>{})},{once:true,capture:true});
function initAudioUI(){try{mountManager()}catch(err){console.error('DARTHS audio settings failed to initialize:',err)}if(viewing){let attempts=0;const timer=setInterval(()=>{showEnableButton();if(document.querySelector('#darthsEnableAudio')||++attempts>30)clearInterval(timer)},400)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initAudioUI,{once:true});else initAudioUI();
window.DARTHS_AUDIO={unlock,fx,speak,cue,startTheme,stopMusic,watchRecord,broadcastSettings,get settings(){return settings},isUnlocked:()=>unlocked,watchEnable:showEnableButton};
})();
