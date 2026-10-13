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
ok(D.querySelectorAll('#pads .pad').length===8,'8 Pads');
ok(D.querySelectorAll('#smpSteps .ss').length===16,'16 Sampler-Steps');
ok($('synBody').hidden&&$('smpBody').hidden,'Module starten eingeklappt');
$('synHead').click();
ok(!$('synBody').hidden&&$('rackSynth').classList.contains('open')&&$('synHead').getAttribute('aria-expanded')==='true','Synth klappt auf');
$('synHead').click();
ok($('synBody').hidden,'Synth klappt zu');
$('smpHead').click();
ok(!$('smpBody').hidden&&S.open.smp===true,'Sampler klappt auf');
ok(/PAD 1/i.test($('smpSum').textContent)&&/STAB/i.test($('smpSum').textContent),'Sampler-Summary: '+$('smpSum').textContent);
ok(/BASS/i.test($('synSum').textContent),'Synth-Summary: '+$('synSum').textContent);
const pads=D.querySelectorAll('#pads .pad');
S.mix.BA.m=true;S.mix.LD.m=true;S.mix.SM.r=0;T.ensureAudio();
pads[1].click();
ok(S.smp.sel===1&&pads[1].classList.contains('sel'),'Pad 2 gewählt');
ok(pads[7].classList.contains('empty')&&!pads[0].classList.contains('empty'),'leere/volle Pads markiert');
const ss=D.querySelectorAll('#smpSteps .ss');
ok(ss[15].classList.contains('on'),'Seed-Zap auf Step 16');
ss[3].click();
ok(S.pat.smp[1][3]===1&&ss[3].classList.contains('on'),'Step setzen');
ss[3].click();
ok(S.pat.smp[1][3]===0,'Step löschen');
// Datei laden: WAV bauen und decodieren
function wav(n,rate){const b=Buffer.alloc(44+n*2);b.write('RIFF',0);b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(Math.sin(i/20)*20000),44+i*2);return b;}
(async()=>{
  const wb=wav(44100,44100);
  const ab=wb.buffer.slice(wb.byteOffset,wb.byteOffset+wb.length);
  S.smp.sel=7;
  const input=$('smpFile');
  Object.defineProperty(input,'files',{value:[{name:'kick.test.wav',arrayBuffer:async()=>ab}],configurable:true});
  input.dispatchEvent(new w.Event('change'));
  await new Promise(r=>setTimeout(r,800));
  ok(S.smp.pads[7].name==='kick.test'&&!pads[7].classList.contains('empty'),'Datei geladen: '+S.smp.pads[7].name);
  const st=JSON.parse(w.localStorage.getItem('pocket808.smp.v1')||'{}');
  ok(st[7]&&st[7].d.length>1000,'Sample persistiert');
  // Clear
  $('smpTools').querySelectorAll('.chip')[3].click();
  ok(pads[7].classList.contains('empty'),'Pad geleert');
  // Render: nur Sampler

  ['A','B'].forEach(k=>['BD','SD','LT','HT','RS','CP','CB','CH','OH','CY'].forEach(v=>S.patterns[k][v].fill(0)));
  S.mode='song';S.song=[{p:'A',n:1},{p:'B',n:1}];S.tempo=120;
  T.begin();
  for(w.__now=0;w.__now<7;w.__now+=.025) T.pump();
  const buf=await w.__ctx.startRendering();const f=buf.getChannelData(0);
  let peak=0,nan=0;for(const x of f){if(!isFinite(x))nan++;if(Math.abs(x)>peak)peak=Math.abs(x);}
  const e=(a,b)=>{let t=0;for(let i=a*44100;i<b*44100;i++)t+=f[i]*f[i];return Math.sqrt(t/((b-a)*44100));};
  console.log('peak',peak.toFixed(3),'zap(1.9-2.1)',e(1.9,2.1).toFixed(4),'riser(3.3-3.9)',e(3.3,3.9).toFixed(4),'stille(2.5-3.0)',e(2.5,3.0).toFixed(5));
  ok(nan===0,'keine NaN');
  ok(e(1.9,2.1)>.01&&e(3.3,3.9)>.01&&e(2.5,3.0)<.0005,'Sampler-Hits zur richtigen Zeit');
  console.log(errs.length?'ERRORS '+errs.join('|').slice(0,400):'no jsdom errors');
  console.log(fails?('FAILS '+fails):'ALL OK');
})();
