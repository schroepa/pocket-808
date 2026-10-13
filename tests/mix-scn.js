// führt genau ein Audio-Szenario in einem eigenen Prozess aus und druckt Messwerte als JSON
const {page,run,clearAll,rmsOf,SR}=require('./mixlib.js');
const nanCount=(...a)=>{let n=0;for(const f of a)for(const x of f)if(!isFinite(x))n++;return n;};
const peak=f=>{let p=0;for(const x of f)if(isFinite(x)&&Math.abs(x)>p)p=Math.abs(x);return p;};
const pat=(S,o)=>{for(const k in o)for(const i of o[k])S.patterns.A[k][i]=1;};
const SC={
  async base(){const r=await run(({S})=>pat(S,{BD:[0],SD:[4]}),1.9);return{rms:rmsOf(r.L,0,1.9),nan:nanCount(r.L)};},
  async mute(){const r=await run(({S})=>{pat(S,{BD:[0],SD:[4]});S.mix.BD.m=true;S.mix.SD.m=true;},1.9);return{rms:rmsOf(r.L,0,1.9)};},
  async solo(){const r=await run(({S})=>{pat(S,{BD:[0],SD:[4]});S.mix.SD.s=true;},1.9);return{rms:rmsOf(r.L,0,1.9),bd:rmsOf(r.L,.07,.3)};},
  async faderHalf(){const a=await run(({S})=>{pat(S,{BD:[0]});S.mix.BD.v=.4;S.mix.BD.r=0;},1.0);return{v:rmsOf(a.L,.08,.5)};},
  async faderFull(){const a=await run(({S})=>{pat(S,{BD:[0]});S.mix.BD.r=0;},1.0);return{v:rmsOf(a.L,.08,.5)};},
  async master1(){const r=await run(({S})=>{S.master=1;['BD','SD','CH','CP','OH','CY'].forEach((v,k)=>{for(let i=k%2;i<16;i+=2)S.patterns.A[v][i]=1;});},2.0);return{nan:nanCount(r.L,r.R),peak:Math.max(peak(r.L),peak(r.R)),rms:rmsOf(r.L,.2,2)};},
  async pan(){const r=await run(({S})=>{pat(S,{BD:[0]});S.mix.BD.p=1;S.mix.BD.r=0;},1.0);return{L:rmsOf(r.L,.08,.5),R:rmsOf(r.R,.08,.5)};},
  async djLp(){
    const set=({S})=>pat(S,{CH:[0,2,4],CY:[0]});
    const a=await run(({S})=>{set({S});S.fx.dj=.05;},1.4);return{rms:rmsOf(a.L,0,1.4),nan:nanCount(a.L)};},
  async djOff(){const a=await run(({S})=>pat(S,{CH:[0,2,4],CY:[0]}),1.4);return{rms:rmsOf(a.L,0,1.4)};},
  async djHp(){const a=await run(({S})=>{pat(S,{BD:[0]});S.fx.dj=.95;},1.4);return{rms:rmsOf(a.L,0,1.4),nan:nanCount(a.L)};},
  async djOffBd(){const a=await run(({S})=>pat(S,{BD:[0]}),1.4);return{rms:rmsOf(a.L,0,1.4)};},
  async stutterOff(){const r=await run(({S})=>{pat(S,{BD:[0]});S.mix.BD.r=0;},1.7);return{tail:rmsOf(r.L,1.2,1.6)};},
  async stutter(){
    const P=page();clearAll(P.S);P.S.tempo=120;pat(P.S,{BD:[0]});P.S.mix.BD.r=0;
    P.T.ensureAudio();await new Promise(r=>setTimeout(r,2500));P.w.__now=.001;P.T.applyMixAll();P.w.__now=0;P.T.begin();
    let pressed=false;
    for(P.w.__now=0;P.w.__now<1.7;P.w.__now+=.025){if(!pressed&&P.w.__now>=.1){P.T.stutterOn(.125);pressed=true;}P.T.pump();}
    const b=await P.w.__ctx.startRendering();const f=b.getChannelData(0);
    return{tail:rmsOf(f,1.2,1.6),nan:nanCount(f)};},
  async stutterRelease(){
    const P=page();clearAll(P.S);P.S.tempo=120;pat(P.S,{BD:[0],SD:[12]});P.S.mix.BD.r=0;
    P.T.ensureAudio();await new Promise(r=>setTimeout(r,2500));P.w.__now=.001;P.T.applyMixAll();P.w.__now=0;P.T.begin();
    let pr=false,rl=false;
    for(P.w.__now=0;P.w.__now<2.4;P.w.__now+=.025){
      if(!pr&&P.w.__now>=.1){P.T.stutterOn(.125);pr=true;}
      if(!rl&&P.w.__now>=.8){P.T.stutterOff();rl=true;}
      P.T.pump();}
    const b=await P.w.__ctx.startRendering();const f=b.getChannelData(0);
    return{after:rmsOf(f,1.2,1.4),nan:nanCount(f)};},
  async live(){
    const P=page();clearAll(P.S);P.S.tempo=120;
    ['BD','SD','CH','CP'].forEach((v,k)=>{for(let i=k;i<16;i+=4)P.S.patterns.A[v][i]=1;});
    P.T.ensureAudio();await new Promise(r=>setTimeout(r,2500));P.w.__now=.001;P.T.applyMixAll();P.w.__now=0;P.T.begin();
    const rows=P.D.querySelectorAll('#mixRows .mx');
    for(P.w.__now=0;P.w.__now<4;P.w.__now+=.025){
      const k=Math.round(P.w.__now/.025);
      if(k%17===3) rows[k%4].querySelector('.m').click();
      if(k%23===5) rows[(k>>1)%4].querySelector('.s').click();
      if(k%7===0){const f=rows[k%4].querySelector('input');f.value=String((k*13)%101);f.dispatchEvent(new P.w.Event('input'));}
      if(k%11===0){P.S.mix.SD.p=(k%5)/4;P.S.mix.SD.r=(k%3)/2;P.S.fx.dj=(k%9)/8;P.S.fx.djq=(k%4)/3;P.S.fx.ret=(k%6)/5;P.T.applyMixAll();}
      if(k===60) P.T.stutterOn(.25);
      if(k===100) P.T.stutterOff();
      P.T.pump();}
    const b=await P.w.__ctx.startRendering();
    return{nan:nanCount(b.getChannelData(0),b.getChannelData(1)),peak:Math.max(peak(b.getChannelData(0)),peak(b.getChannelData(1))),errs:P.errs.length};},
  async reverbDry(){const r=await run(({S})=>{pat(S,{SD:[0]});S.mix.SD.r=0;},2.4,null,true);return{v:rmsOf(r.L,1,2)};},
  async reverbWet(){const r=await run(({S})=>{pat(S,{SD:[0]});S.mix.SD.r=1;S.fx.ret=1;S.fx.size=.8;},2.4,null,true);return{v:rmsOf(r.L,1,2),nan:nanCount(r.L),peak:peak(r.L)};}
};
SC[process.argv[2]]().then(r=>{console.log('JSON'+JSON.stringify(r));process.exit(0);}).catch(e=>{console.log('ERR'+e.stack);process.exit(1);});
