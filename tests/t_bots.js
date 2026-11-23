const E=require('../src/engine.js');
function R(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const P=['balanced','cautious','ruthless','chaotic'],L=['easy','normal','hard'];
const wins={};let bad=0,games=0;
for(let seed=1;seed<=240;seed++){const rng=R(seed);
 const defs=[];for(let k=0;k<4;k++)defs.push({id:'b'+k,name:'B'+k,bot:true,pers:P[(k+seed)%4],lvl:L[Math.floor(seed/4)%3]});
 let s=E.newGame(defs,rng,{rules:{offers:seed%2==0,founders:true}});let n=0;
 while(s.phase!=='over'&&n++<6000){const a=E.actorOf(s);const act=E.botAction(s,rng);const r=E.apply(s,act,a);if(!r.ok){console.log('FAIL',seed,defs[a].pers,defs[a].lvl,act,r.error);bad++;break}s=r.state}
 if(s.phase!=='over'){bad++;console.log('stuck',seed)}else{games++;const pp=E.perPlayer(s);pp.forEach(p=>{const k=s.players[p.i].pers;wins[k]=wins[k]||{w:0,t:0,n:0};wins[k].t+=p.total;wins[k].n++;if(p.winner)wins[k].w++});}
}
console.log('bad',bad,'games',games);for(const k in wins)console.log(k,'wins',wins[k].w,'avg',Math.round(wins[k].t/wins[k].n));
// difficulty strength: 1 hard vs 3 easy
const lw={};for(let seed=1;seed<=200;seed++){const rng=R(seed+500);const lv=['hard','easy','easy','easy'];const defs=lv.map((l,k)=>({id:'b'+k,name:'B'+k,bot:true,lvl:l}));let s=E.newGame(defs,rng,{});let n=0;while(s.phase!=='over'&&n++<6000){const a=E.actorOf(s);s=E.apply(s,E.botAction(s,rng),a).state}
 E.perPlayer(s).forEach(p=>{const l=lv[p.i]+(p.i);if(p.winner)lw[l]=(lw[l]||0)+1})}
console.log('hard(b0) vs easy:',lw);
const s0=E.newGame([{id:'a',name:'A'},{id:'b',name:'B'}],R(3),{});console.log('preview null for non-merge:',E.previewMerge(s0,0,0));
