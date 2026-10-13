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
const T=w.__t,S=T.state;
S.mix.LD.m=true;S.mix.SM.r=0;S.mix.BA.r=0;
const P=S.synth.BA;Object.assign(P,{wave:0,cut:.7,res:0,env:0,det:0,sub:0,dly:0,lvl:1,fa:.6,fd:.1,fs:1,fr:.5,aa:.6,ad:.1,as:1,ar:.5});
T.ensureAudio();
// Note 1: t=0.5, Dauer 1.0 -> Gate-Ende 1.5, Release (.5)->.02+.25*1.2=.32s
T.synthNote('BA',45,0.5,1.0);
// Note 2 (mono): t=3, ueberschreibt nichts
T.synthNote('BA',45,3.0,0.3);
(async()=>{
  const buf=await w.__ctx.startRendering();const f=buf.getChannelData(0);
  const rms=(a,b)=>{let s=0;const i0=Math.floor(a*SR),i1=Math.floor(b*SR);for(let i=i0;i<i1;i++)s+=f[i]*f[i];return Math.sqrt(s/(i1-i0));};
  const A=.002+.36*1.5; // attack ~0.54s
  const r0=rms(.5,.6),r1=rms(.5+A*.5,.5+A*.5+.1),r2=rms(1.2,1.3),r3=rms(1.55,1.65),r4=rms(2.2,2.5);
  console.log('rms attack-start',r0.toFixed(4),'mid',r1.toFixed(4),'sustain',r2.toFixed(4),'release',r3.toFixed(4),'after',r4.toFixed(5));
  ok(r0<r1*0.5,'Amp-Attack langsam (Start leiser als Mitte)');
  ok(r1<r2,'Amp steigt weiter bis Sustain');
  ok(r3<r2*0.8&&r3>0.0005,'Release klingt aus');
  ok(r4<0.0005,'Stille nach Release');
  ok(rms(3.0,3.1)>0,'zweite Note klingt');
  let nan=0;for(let i=0;i<f.length;i++) if(!isFinite(f[i])) nan++;
  ok(nan===0,'keine NaN');
  console.log(errs.length?errs:'no jsdom errors');
  console.log(fails?'FAILS '+fails:'ALL OK');process.exit(fails?1:0);
})();
