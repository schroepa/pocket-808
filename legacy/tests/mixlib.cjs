const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs');
const wa=require('node-web-audio-api');
const DIR=require('path').resolve(__dirname,'..');
const html=fs.readFileSync(DIR+'/index.html','utf8');
const m=html.match(/<script>\n\(function\(\)\{[\s\S]*?<\/script>/);
let main0=m[0].replace(/^<script>/,'').replace(/<\/script>$/,'');
const body=html.replace(m[0],'');
main0=main0.replace("const hot=window.claude","window.__t={state,begin(){playing=true;step=0;songFirst=true;barSong=false;queue.length=0;nextTime=.08;},pump,stop(){playing=false;},ensureAudio,applyMixAll,applyFx,stutterOn,stutterOff,aud,get chan(){return chan;},get st(){return st;}};\nconst hot=window.claude");
const mainNoIR=main0.replace("rvConv.buffer=buildIR(c,state.fx.size,state.fx.damp);","");
if(mainNoIR===main0) throw new Error('IR anchor');
const SEC=5,SR=44100;
function page(full){
  const errs=[];
  const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e.stack||e)));vc.on('error',e=>errs.push(String(e)));
  const dom=new JSDOM('<!doctype html><html><head><meta charset="utf8"></head><body>'+body+'</body></html>',{url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window;w.__now=0;
  w.AudioContext=function(){const c=new wa.OfflineAudioContext(2,SEC*SR,SR);w.__ctx=c;Object.defineProperty(c,'currentTime',{get:()=>w.__now});return c;};
  w.OfflineAudioContext=wa.OfflineAudioContext;w.Float32Array=Float32Array;w.HTMLCanvasElement.prototype.getContext=()=>null;
  w.eval(full?main0:mainNoIR);
  return {w,D:w.document,T:w.__t,S:w.__t.state,errs,$:id=>w.document.getElementById(id)};
}
const rmsOf=(f,a,b)=>{let t=0;const i0=Math.floor(a*SR),i1=Math.floor(b*SR);for(let i=i0;i<i1;i++)t+=f[i]*f[i];return Math.sqrt(t/(i1-i0));};
// Erst nur ein Kanal: Muster leeren, dann gezielt füllen
function clearAll(S){['A','B'].forEach(k=>{const p=S.patterns[k];['BD','SD','LT','HT','RS','CP','CB','CH','OH','CY'].forEach(v=>p[v].fill(0));p.notes.BA.fill(null);p.notes.LD.fill(null);p.smp.forEach(r=>r.fill(0));p.sub={};});S.mode='pattern';S.cur='A';S.pat=S.patterns.A;}
async function run(setup,run_s,pre,full){
  const P=page(full);clearAll(P.S);
  P.S.tempo=120;
  setup(P);
  P.T.ensureAudio();
  await new Promise(r=>setTimeout(r,2500));
  P.w.__now=.001;P.T.applyMixAll();P.w.__now=0;
  if(pre) pre(P);
  P.T.begin();
  const T0=Date.now();
  let calls=0;
  for(P.w.__now=0;P.w.__now<run_s;P.w.__now+=.025){ if(P.hook) P.hook(P); P.T.pump();calls++; }
  const buf=await P.w.__ctx.startRendering();
  return {P,L:buf.getChannelData(0),R:buf.getChannelData(1)};
}

module.exports={page,run,clearAll,rmsOf,SR,SEC,main0,body,JSDOM,VirtualConsole,wa};
