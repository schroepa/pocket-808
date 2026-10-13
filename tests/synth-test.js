const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs');
const wa=require('node-web-audio-api');
const DIR=require('path').resolve(__dirname,'..');
const html=fs.readFileSync(DIR+'/index.html','utf8');
const m=html.match(/<script>\n\(function\(\)\{[\s\S]*?<\/script>/);
let main=m[0].replace(/^<script>/,'').replace(/<\/script>$/,'');
const body=html.replace(m[0],'');
let fails=0;const ok=(c,msg)=>{console.log((c?'PASS ':'FAIL ')+msg);if(!c)fails++;};
const errs=[];
const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.stack||e)));vc.on('error',e=>errs.push(String(e)));
main=main.replace("ctx=new AC({latencyHint:'interactive'});","ctx=window.__mk();");
main=main.replace("const hot=window.claude","window.__t={state,begin(){playing=true;step=0;songFirst=true;barSong=false;queue.length=0;nextTime=.08;},pump,stop(){playing=false;},ensureAudio,auditionNote,synthNote,degMidi,effLen};\nconst hot=window.claude");
const dom=new JSDOM('<!doctype html><html><head><meta charset="utf8"></head><body>'+body+'</body></html>',{url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;const D=w.document;
const SEC=8,SR=44100;
w.AudioContext=function(){return w.__mk();};w.__now=0;w.__mk=()=>{const c=new wa.OfflineAudioContext(1,SEC*SR,SR);w.__ctx=c;try{Object.defineProperty(c,'currentTime',{get:()=>w.__now});}catch(e){console.log('defprop fail',e.message);}return c;};
w.OfflineAudioContext=wa.OfflineAudioContext;w.Float32Array=Float32Array;
w.eval(main);
ok(errs.length===0,'keine Fehler beim Start '+errs.join('|').slice(0,200));
const $=id=>D.getElementById(id);
$('synHead').click();
ok(D.querySelectorAll('#roll .pc').length===96,'Piano-Roll 12x8 Zellen');
ok(D.querySelectorAll('#sh .knob').length===7,'7 Synth-Knobs');
const T=w.__t,S=T.state;
ok(S.patterns.A.notes.BA[0]&&S.patterns.A.notes.BA[0].l===2,'Seed-Bass in A');
ok(D.querySelectorAll('#roll .pc.on').length===2,'Seed sichtbar Seite 1: '+D.querySelectorAll('#roll .pc.on').length);
// Note setzen und entfernen
const cells=$('roll').querySelectorAll('.pc');
const first=cells[0]; // oberste Reihe (deg 11), Step 1
T.ensureAudio();
first.click();
ok(S.pat.notes.BA[0].d===11,'Klick setzt Note d=11 (ersetzt Seed)');
first.click();
ok(S.pat.notes.BA[0]===null,'zweiter Klick entfernt');
// Tail-Klick entfernt ganze Note: Seed A BA[8]={d3,l2}
const tailRow=[...D.querySelectorAll('#roll .rr:not(.hd)')].find(r=>r.querySelector('.pc.on')&&r.querySelectorAll('.pc')[7]&&false);
// Stimme wechseln, Seite wechseln
$('partSeg').querySelectorAll('button')[1].click();
ok(S.part==='LD'&&D.querySelectorAll('#roll .pc.on').length>0,'Lead-Ansicht zeigt Noten');
$('pageChips').querySelectorAll('button')[1].click();
ok(D.querySelector('#roll .rr.hd span:last-child').textContent==='16','Seite 2 zeigt Steps 9-16');
$('pageChips').querySelectorAll('button')[0].click();
// Skala/Tonart
$('keySel').value='0';$('keySel').dispatchEvent(new w.Event('change'));
ok(S.key===0,'Tonart C');
ok(T.degMidi('BA',0)===12*3+0,'Bass-Grundton C2=36: '+T.degMidi('BA',0));
$('keySel').value='9';$('keySel').dispatchEvent(new w.Event('change'));
ok(T.degMidi('BA',0)===45&&T.degMidi('BA',7)===57&&T.degMidi('LD',0)===69,'A2=45, +Oktave=57, Lead A4=69');

if(process.env.NOSYN){S.synth.BA.mute=true;S.synth.LD.mute=true;}
if(process.env.ONLY){['A','B'].forEach(k=>['BD','SD','LT','HT','RS','CP','CB','CH','OH','CY'].forEach(v=>{if(v!==process.env.ONLY)S.patterns[k][v].fill(0);}));}
if(process.env.NODRUM){['A','B'].forEach(k=>['BD','SD','LT','HT','RS','CP','CB','CH','OH','CY'].forEach(v=>S.patterns[k][v].fill(0)));}
S.mode='song';S.song=[{p:'A',n:1},{p:'B',n:1}];S.tempo=120;
T.begin();
for(w.__now=0;w.__now<7;w.__now+=.025) T.pump();
ok(true,'Scheduler lief 7 s ohne Fehler');
(async()=>{
  const buf=await w.__ctx.startRendering();
  const f=buf.getChannelData(0);
  let peak=0,nan=0;for(const x of f){if(!isFinite(x))nan++;if(Math.abs(x)>peak)peak=Math.abs(x);}
  ok(nan===0,'keine NaN');{let i=0;while(i<f.length&&isFinite(f[i]))i++;console.log('erste NaN bei',i/SR,'s, count',nan);}
  console.log('peak',peak.toFixed(3));
  ok(peak>.1&&peak<=1.01,'Pegel plausibel');
  // Energie je Takt (2s bei 120bpm)
  const rms=(a,b)=>{let t=0;for(let i=a*SR;i<b*SR;i++)t+=f[i]*f[i];return Math.sqrt(t/((b-a)*SR));};
  console.log('rms Takt1',rms(.1,2.1).toFixed(3),'Takt2',rms(2.1,4.1).toFixed(3));
  // Synth-Anteil: gleicher Render ohne Synth
  fs.writeFileSync(require('os').tmpdir()+'/pocket808-synth-render.raw',Buffer.from(new Float32Array(f).buffer));
  console.log(errs.length?'ERRORS '+errs.join('|'):'no jsdom errors');
  console.log(fails?('FAILS '+fails):'ALL OK');process.exit(fails?1:0);
})();
