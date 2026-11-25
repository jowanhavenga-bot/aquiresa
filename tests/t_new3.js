const E=require('../src/engine.js');
function R(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let fb=[],notes=0,auto=0,bad=0;
for(let seed=1;seed<=120;seed++){const rng=R(seed);
 let s=E.newGame([{id:'a',name:'A',bot:true},{id:'b',name:'B',bot:true},{id:'c',name:'C',bot:true}],rng,{rules:{founders:true,offers:true,timer:30}});
 if(s.rules.timer!==30)bad++;
 let n=0;while(s.phase!=='over'&&n++<6000){const a=E.actorOf(s);
  if(n%7===0){const ns=E.autoPlay(s,rng);if(ns){s=ns;auto++;continue}}
  const r=E.apply(s,E.botAction(s,rng),a);if(!r.ok){bad++;break}s=r.state;if(s.mnote)notes++}
 s.log.forEach(l=>{const m=/gets (R[^ ]*\s?[\d\s ]*) as the founder/.exec(l);if(m)fb.push(l)})
 if(s.phase!=='over')bad++}
console.log('bad',bad,'auto moves',auto,'merge notes seen',notes,'founder lines',fb.length,fb[0]);
