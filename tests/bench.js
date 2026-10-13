const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const wa=require('node-web-audio-api');
const DIR=require('path').resolve(__dirname,'..');
const file=process.argv[2]||'index.html',scenario=process.argv[3]||'demo';
const html=fs.readFileSync(DIR+'/'+file,'utf8');
const m=html.match(/<script>\n\(function\(\)\{[\s\S]*?<\/script>/);
let main=m[0].replace(/^<script>/,'').replace(/<\/script>$/,'');
const body=html.replace(m[0],'');
main=main.replace(/ctx=new AC\(\{latencyHint:'[a-z]+'\}\);/,"ctx=window.__mk();");
main=main.replace("const hot=window.claude","window.__t={state,begin(){playing=true;step=0;songFirst=true;barSong=false;queue.length=0;nextTime=.08;},pump,ensureAudio};\nconst hot=window.claude");
const vc=new VirtualConsole();
const dom=new JSDOM('<!doctype html><html><head></head><body>'+body+'</body></html>',{url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,SR=44100,SEC=8;
w.AudioContext=function(){return w.__mk();};w.__now=0;
const counts={};
w.__mk=()=>{const c=new wa.OfflineAudioContext(2,SEC*SR,SR);w.__ctx=c;
  Object.defineProperty(c,'currentTime',{get:()=>w.__now});
  ['createOscillator','createBufferSource','createGain','createBiquadFilter','createWaveShaper','createDelay','createDynamicsCompressor'].forEach(n=>{const o=c[n].bind(c);c[n]=function(){counts[n]=(counts[n]||0)+1;return o();};});
  return c;};
w.OfflineAudioContext=wa.OfflineAudioContext;w.Float32Array=Float32Array;w.HTMLCanvasElement.prototype.getContext=()=>null;
w.eval(main);
const T=w.__t,S=T.state;
if(scenario==='worst'){
  // alles voll: jede Drum-Spur Sub-Roll auf allen Steps der ersten Takthälfte, dazu Pads
  ['BD','SD','CH','OH','CP','CY'].forEach(id=>{S.patterns.A.sub[id]={};for(let s=0;s<16;s+=2) S.patterns.A.sub[id][s]=new Array(16).fill(0).map((_,k)=>k%2===0?1:0);});
}
S.tempo=120;S.mode='pattern';S.cur='A';S.pat=S.patterns.A;
(async()=>{T.ensureAudio();await new Promise(r=>setTimeout(r,2500));
for(const k of Object.keys(counts)) counts[k]=0;
T.begin();
for(w.__now=0;w.__now<SEC-1;w.__now+=.025) T.pump();
const t0=Date.now();
w.__ctx.startRendering().then(()=>{
  const ms=Date.now()-t0;
  const tot=Object.values(counts).reduce((a,b)=>a+b,0);
  console.log(file,scenario,'| Render 8 s Audio in',ms,'ms (=',(ms/8000*100).toFixed(1),'% Echtzeit) | Knoten/s',Math.round(tot/(SEC-1)),JSON.stringify(counts));
});
})();
