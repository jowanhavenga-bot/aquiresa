const E=require('../src/engine.js');
function rngSeed(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let bad=0;
for(let seed=1;seed<=300;seed++){
  const rng=rngSeed(seed);
  let s=E.newGame([{id:'a',name:'A',bot:true},{id:'b',name:'B',bot:true},{id:'c',name:'C',bot:true}],rng,{rules:{founders:true,offers:true},hide:{shares:seed%2==0}});
  const total0=()=>s.players.reduce((x,p)=>x+p.cash,0);
  let n=0,founders=0,offers=0,acc=0;
  while(s.phase!=='over'&&n++<5000){
    const a=E.actorOf(s);
    let act=E.botAction(s,rng);
    // sometimes the turn player (bot) makes an offer first
    if(!s.offer&&(s.phase==='place'||s.phase==='buy')&&s.oc<3&&rng()<0.2){
      const sz=E.sizes(s.board);const c=[1,2,3,4,5,6,7].find(c=>sz[c]>=2);
      if(c){const to=(a+1)%3;const worth=E.price(c,sz[c]);
        const r=E.apply(s,{type:'offer',to,chain:c,qty:1,amt:worth+100*(1+Math.floor(rng()*4))},a);
        if(r.ok){s=r.state;offers++;continue}}
    }
    const before=total0();
    const r=E.apply(s,act,a);
    if(!r.ok){console.log('fail',seed,act,r.error);bad++;break}
    if(act.type==='respond'&&act.accept)acc++;
    if(act.type==='respond'&&total0()!==before){}
    s=r.state;
  }
  if(s.phase!=='over'){console.log('stuck',seed);bad++}
  if(s.offer)bad++;
}
console.log('done bad=',bad);
// founder bonus manual check
let s=E.newGame([{id:'a',name:'A',bot:false},{id:'b',name:'B',bot:false}],rngSeed(7),{rules:{founders:true}});
console.log('rules',JSON.stringify(s.rules),'offer-disabled err:',E.apply(E.newGame([{id:'a',name:'A'},{id:'b',name:'B'}],rngSeed(7),{}),{type:'offer',to:1,chain:1,qty:1,amt:1000},0).error);
