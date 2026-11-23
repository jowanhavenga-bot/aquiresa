const E=require('../src/engine.js');
function R(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let fb=0,ofs=0,acc=0,dec=0;
for(let seed=1;seed<=100;seed++){const rng=R(seed);
 let s=E.newGame([{id:'a',name:'A',bot:true},{id:'b',name:'B',bot:true},{id:'c',name:'C',bot:true}],rng,{rules:{founders:true,offers:true}});
 let n=0;while(s.phase!=='over'&&n++<5000){const a=E.actorOf(s);
  if(!s.offer&&(s.phase==='place'||s.phase==='buy')&&s.oc<3&&rng()<0.3){const sz=E.sizes(s.board);const c=[1,2,3,4,5,6,7].find(c=>sz[c]>=2&&s.players[(a+1)%3].stocks[c]>0);
   if(c){const w=E.price(c,sz[c]);const r=E.apply(s,{type:'offer',to:(a+1)%3,chain:c,qty:1,amt:w+100+Math.floor(rng()*6)*100},a);if(r.ok){s=r.state;continue}}}
  s=E.apply(s,E.botAction(s,rng),a).state}
 s.log.forEach(l=>{if(/founder's bonus/.test(l))fb++;if(/offers .* for/.test(l))ofs++;if(/accepts and sells/.test(l))acc++;if(/declines the offer/.test(l))dec++})}
console.log({fb,ofs,acc,dec});
