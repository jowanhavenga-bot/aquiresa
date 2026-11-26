const E=require('./engine.js'),R=E.rngFromSeed;
let gaps=[],maxgap=0,evs=0,rounds=0,texts={},dirs={u:0,d:0},cos={},bad=0,consec=0,sameco=0;
for(let seed=1;seed<=200;seed++){
 const rng=R(seed);let s=E.newGame([{id:'a',name:'A',bot:true},{id:'b',name:'B',bot:true},{id:'c',name:'C',bot:true}],rng,{rules:{events:true}});
 let n=0,last=0,lastRound=1,lastCo=0,prevEvRound=-9;
 while(s.phase!=='over'&&n++<8000){const a=E.actorOf(s);const r=E.apply(s,E.botAction(s,rng),a);if(!r.ok){bad++;break}
   const ns=r.state;
   if(ns.round!==s.round){rounds++; if(ns.ev){evs++;texts[ns.ev.co+':'+ns.ev.text]=1;ns.ev.d>0?dirs.u++:dirs.d++;cos[ns.ev.co]=(cos[ns.ev.co]||0)+1;
      if(ns.round-prevEvRound===1)consec++; if(lastCo===ns.ev.co)sameco++; const g=ns.round-prevEvRound; if(prevEvRound>0){gaps.push(g);maxgap=Math.max(maxgap,g)} prevEvRound=ns.round; lastCo=ns.ev.co}}
   s=ns}
}
console.log('rounds',rounds,'events',evs,'rate',(evs/rounds).toFixed(2),'avg gap',(gaps.reduce((a,b)=>a+b,0)/gaps.length).toFixed(2),'max gap',maxgap,'consecutive rounds',consec,'same company twice in a row',sameco,'up/down',dirs.u,dirs.d,'distinct stories',Object.keys(texts).length,'per company',JSON.stringify(cos),'bad',bad);
