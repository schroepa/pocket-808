const {page,main0,body,JSDOM,VirtualConsole,wa,SR}=require('./mixlib.cjs');
const {spawnSync}=require('child_process');
let fails=0;const ok=(c,msg)=>{console.log((c?'PASS ':'FAIL ')+msg);if(!c)fails++;};
function scn(name){
  for(let a=0;a<3;a++){
    const r=spawnSync('node',[__dirname+'/mix-scn.cjs',name],{encoding:'utf8',timeout:120000});
    const m=(r.stdout||'').match(/JSON(.*)/);
    if(m) return JSON.parse(m[1]);
    console.log('retry',name,(r.stdout||'').slice(-200),(r.stderr||'').slice(-200));
  }
  throw new Error('scenario failed '+name);
}
(async()=>{
  // --- UI
  {
    const P=page();
    ok(P.errs.length===0,'Start ohne Fehler '+P.errs.join('|').slice(0,300));
    ok(P.D.querySelectorAll('#mixRows .mx').length===13,'13 Mixerkanäle');
    ok(P.$('mixBody').hidden&&P.$('fxBody').hidden,'Mixer und FX starten eingeklappt');
    P.$('mixHead').click();P.$('fxHead').click();
    ok(!P.$('mixBody').hidden&&!P.$('fxBody').hidden&&P.S.open.mix&&P.S.open.fx,'klappen auf');
    ok(P.D.querySelectorAll('#mixKnobs .knob').length===2&&P.D.querySelectorAll('#rvKnobs .knob').length===3&&P.D.querySelectorAll('#djKnobs .knob').length===2,'Knobs (2/3/2)');
    ok(P.D.querySelectorAll('#stPads .stp').length===4,'4 Stutter-Pads');
    const rows=P.D.querySelectorAll('#mixRows .mx');
    rows[1].querySelector('.m').click();
    ok(P.S.mix.SD.m===true&&/1 STUMM/i.test(P.$('mixSum').textContent),'Mute SD, Summary: '+P.$('mixSum').textContent);
    rows[1].querySelector('.m').click();
    rows[2].querySelector('.s').click();
    ok(P.S.mix.LT.s&&!P.T.aud.SD&&P.T.aud.LT&&/SOLO LT/i.test(P.$('mixSum').textContent),'Solo LT: nur LT hörbar');
    rows[2].querySelector('.s').click();
    ok(P.T.aud.SD&&P.T.aud.LT,'Solo aus: alle hörbar');
    // Synth-Stumm-Button
    P.$('synMute').click();
    ok(P.S.mix.BA.m===true&&!P.T.aud.BA,'Synth-Stumm schreibt in den Mixer');
    P.$('synMute').click();
    // Fader
    const f=rows[0].querySelector('input');f.value='40';f.dispatchEvent(new P.w.Event('input'));
    ok(Math.abs(P.S.mix.BD.v-.4)<1e-9,'Fader setzt Level');
    // Persistenz
    await new Promise(r=>setTimeout(r,400));
    const st=JSON.parse(P.w.localStorage.getItem('pocket808.v1'));
    ok(st.mix&&st.mix.BD.v===.4&&st.fx&&st.open.mix===true,'Mixer/FX persistiert');
    // Migration alter Speicherstand mit synth.mute
    const Q=(()=>{const errs=[];return 0;})();
  }
  {
    const w0=page;
    const errs=[];
    const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(String(e)));
    const dom=new JSDOM('<!doctype html><html><head></head><body>'+body+'</body></html>',{url:'https://example.test/',runScripts:'outside-only',virtualConsole:vc});
    const w=dom.window;w.AudioContext=function(){return new wa.OfflineAudioContext(2,SR,SR);};w.OfflineAudioContext=wa.OfflineAudioContext;w.Float32Array=Float32Array;w.HTMLCanvasElement.prototype.getContext=()=>null;
    w.localStorage.setItem('pocket808.v1',JSON.stringify({tempo:100,synth:{BA:{mute:true}}}));
    w.eval(main0);
    ok(w.__t.state.mix.BA.m===true&&w.__t.state.synth.BA.mute===false&&errs.length===0,'Migration: alter Synth-Stumm → Mixer');
    w.localStorage.setItem('pocket808.v1',JSON.stringify({mix:{BD:{v:9,p:-3,m:'x'}},fx:{ret:'a',dj:2}}));
  }

  const R={};for(const n of ['base','mute','solo','faderHalf','faderFull','pan','master1','djLp','djOff','djHp','djOffBd','stutterOff','stutter','stutterRelease','live','reverbDry','reverbWet']) R[n]=scn(n);
  ok(R.base.rms>.01&&R.base.nan===0,'Basis hat Signal, kein NaN ('+R.base.rms.toFixed(4)+')');
  ok(R.mute.rms<1e-6,'Alles stumm = Stille ('+R.mute.rms.toExponential(1)+')');
  ok(R.solo.rms>.003&&R.solo.rms<R.base.rms,'Solo SD leiser als alles ('+R.solo.rms.toFixed(4)+' < '+R.base.rms.toFixed(4)+')');
  ok(R.solo.bd<.002,'BD im Solo-SD-Fall nicht hörbar ('+R.solo.bd.toFixed(5)+')');
  ok((R.faderHalf.v/R.faderFull.v)>.2&&(R.faderHalf.v/R.faderFull.v)<.6,'Fader .4 ~ Gain .25 (Verhältnis '+(R.faderHalf.v/R.faderFull.v).toFixed(3)+')');
  ok(R.master1.nan===0&&R.master1.peak<=.981,'Master 100 %, dichtes Muster: Peak '+R.master1.peak.toFixed(3)+', RMS '+R.master1.rms.toFixed(3));
  ok(R.pan.R>.01&&R.pan.L<R.pan.R*.02,'Pan rechts: L='+R.pan.L.toFixed(5)+' R='+R.pan.R.toFixed(4));
  ok(R.djLp.rms<R.djOff.rms*.35&&R.djLp.nan===0,'DJ Tiefpass dämpft Hats ('+R.djLp.rms.toFixed(4)+' vs '+R.djOff.rms.toFixed(4)+')');
  ok(R.djHp.rms<R.djOffBd.rms*.5&&R.djHp.nan===0,'DJ Hochpass dämpft Kick ('+R.djHp.rms.toFixed(4)+' vs '+R.djOffBd.rms.toFixed(4)+')');
  ok(R.stutter.tail>R.stutterOff.tail*3&&R.stutter.tail>.01&&R.stutter.nan===0,'Stutter wiederholt Slice ('+R.stutter.tail.toFixed(4)+' vs '+R.stutterOff.tail.toFixed(5)+')');
  ok(R.stutterRelease.after<.002&&R.stutterRelease.nan===0,'Nach Loslassen kein Dauerloop ('+R.stutterRelease.after.toFixed(5)+')');
  ok(R.live.nan===0&&R.live.peak<=1&&R.live.errs===0,'Live-Automation ohne NaN, Peak '+R.live.peak.toFixed(3));
  ok(R.reverbDry.v<.0005&&R.reverbWet.v>.003&&R.reverbWet.nan===0&&R.reverbWet.peak<1,'Reverb-Tail (dry '+R.reverbDry.v.toExponential(1)+' wet '+R.reverbWet.v.toFixed(4)+')');
  console.log(fails?('FAILS '+fails):'ALL OK');
})().catch(e=>{console.error('CRASH',e);process.exit(1);});
