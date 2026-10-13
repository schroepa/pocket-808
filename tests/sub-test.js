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
w.OfflineAudioContext=wa.OfflineAudioContext;w.Float32Array=Float32Array;w.HTMLCanvasElement.prototype.getContext=()=>null;
w.eval(main);


ok(errs.length===0,'Start ohne Fehler '+errs.join('|').slice(0,300));
const $=id=>D.getElementById(id),T=w.__t,S=T.state;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function wav(n,rate){const b=Buffer.alloc(44+n*2);b.write('RIFF',0);b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(Math.sin(i/12)*Math.exp(-i/6000)*24000),44+i*2);return b;}
(async()=>{
  T.ensureAudio();
  // alles leeren
  ['A','B'].forEach(k=>{['BD','SD','LT','HT','RS','CP','CB','CH','OH','CY'].forEach(v=>S.patterns[k][v].fill(0));S.patterns[k].smp.forEach(r=>r.fill(0));['BA','LD'].forEach(id=>S.patterns[k].notes[id].fill(null));});
  S.tempo=120;
  // Drum-Sample laden
  const wb=wav(20000,44100),ab=wb.buffer.slice(wb.byteOffset,wb.byteOffset+wb.length);
  const input=$('drumFile');
  Object.defineProperty(input,'files',{value:[{name:'mykick.wav',arrayBuffer:async()=>ab}],configurable:true});
  input.dispatchEvent(new w.Event('change'));
  await sleep(700);
  ok(/mykick/.test($('edTitle').textContent),'Titel zeigt Sample: '+$('edTitle').textContent);
  ok(D.querySelector('#tracks .row .lab.cust')!==null,'Spur markiert');
  ok($('drumSmpRow').querySelectorAll('.chip')[1].disabled===false,'Original-Button aktiv');
  const st=JSON.parse(w.localStorage.getItem('pocket808.smp.v1')||'{}');
  ok(st['D:BD']&&st['D:BD'].n==='mykick','persistiert');
  // Sub-Steps
  ok($('drumSubEd').hidden,'Sub-Editor anfangs zu');
  $('drumSubBtn').click();
  ok(!$('drumSubEd').hidden,'Sub-Editor offen');
  const steps=D.querySelectorAll('#steps .step');
  steps[0].click();
  ok(S.pat.BD[0]===0&&steps[0].classList.contains('subsel'),'Step im Sub-Modus nur ausgewählt');
  D.querySelectorAll('#drumSubEd .sb')[0].click();
  ok(S.pat.sub.BD&&S.pat.sub.BD[0][0]===1&&steps[0].classList.contains('sub')&&steps[0].classList.contains('on'),'Sub-Bit setzt Step als Sub');
  D.querySelectorAll('#drumSubEd .chips .chip')[2].click(); // ÷4
  const bits=S.pat.sub.BD[0];
  ok(bits.join('')==='1000100010001000','÷4 = Bits 1,5,9,13: '+bits.join(''));
  // Zählung der Wiedergabe
  const starts=[];
  const cx=w.__ctx,orig=cx.createBufferSource.bind(cx);
  cx.createBufferSource=function(){const s=orig();const st=s.start.bind(s);s.start=(t,...r)=>{starts.push(+t.toFixed(4));return st(t,...r);};return s;};
  S.mode='pattern';
  T.begin();
  for(w.__now=0;w.__now<.5;w.__now+=.025) T.pump();
  const first=starts.filter(t=>t<.3);
  console.log('Starts',first.join(','));
  ok(first.length===4&&Math.abs(first[1]-first[0]-.03125)<.0005,'4 Sub-Treffer im Abstand 31.25 ms');
  // Sampler-Sub
  $('drumSubBtn').click();
  $('smpHead').click();
  $('smpSubBtn').click();
  D.querySelectorAll('#smpSteps .ss')[3].click();
  D.querySelectorAll('#smpSubEd .chips .chip')[1].click(); // ÷2
  ok(S.pat.sub.P0&&S.pat.sub.P0[3].filter(Boolean).length===8,'Pad-Sub ÷2 = 8 Bits');
  ok(D.querySelectorAll('#smpSteps .ss')[3].classList.contains('sub'),'Pad-Step als Sub markiert');
  // Render
  starts.length=0;
  T.begin();
  for(w.__now=0;w.__now<1.2;w.__now+=.025) T.pump();
  const buf=await w.__ctx.startRendering();const f=buf.getChannelData(0);
  let pk=0,nan=0;for(const x of f){if(!isFinite(x))nan++;if(Math.abs(x)>pk)pk=Math.abs(x);}
  ok(nan===0&&pk>.05,'Render sauber, Peak '+pk.toFixed(3));
  // Löschen eines Sub-Steps im Normalmodus
  $('smpSubBtn').click();
  D.querySelectorAll('#smpSteps .ss')[3].click();
  ok(!S.pat.sub.P0,'Normaler Tipp löscht Sub-Step');
  // Original zurück
  $('drumSmpRow').querySelectorAll('.chip')[1].click();
  ok(!/mykick/.test($('edTitle').textContent)&&D.querySelector('#tracks .row .lab.cust')===null,'Original wiederhergestellt');
  // Kopieren/Einfügen enthält Sub
  S.pat.sub.BD={5:[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1]};
  const chips=[...D.querySelectorAll('#tools .chip')];
  chips[0].click();S.cur='A';
  w.document.querySelectorAll('#slots .slot')[2].click();
  chips[1].click();
  ok(S.patterns.C.sub.BD&&S.patterns.C.sub.BD[5][15]===1,'Einfügen kopiert Sub-Steps');
  console.log(errs.length?'ERRORS '+errs.join('|').slice(0,400):'no jsdom errors');
  console.log(fails?('FAILS '+fails):'ALL OK');process.exit(fails?1:0);
})();
