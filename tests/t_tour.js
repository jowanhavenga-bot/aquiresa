const E=require('../src/engine.js');
function R(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function run(defsFn,N,label){const w={},tot={};for(let seed=1;seed<=N;seed++){const rng=R(seed*7+1);let defs=defsFn(seed);const rot=seed%defs.length;defs=defs.slice(rot).concat(defs.slice(0,rot));let s=E.newGame(defs,rng,{});let n=0;while(s.phase!=='over'&&n++<6000){const a=E.actorOf(s);s=E.apply(s,E.botAction(s,rng),a).state}
 E.perPlayer(s).forEach(p=>{const k=defs.find(d=>d.id===s.players[p.i].id).tag;w[k]=(w[k]||0)+(p.winner?1:0);tot[k]=(tot[k]||0)+p.total})}
 console.log(label,JSON.stringify(w),'avg',JSON.stringify(Object.fromEntries(Object.entries(tot).map(([k,v])=>[k,Math.round(v/N)]))))}
const P=['balanced','cautious','ruthless','chaotic'];
run(seed=>P.map((p,k)=>({id:'b'+k,name:p,bot:true,pers:p,tag:p})),400,'personalities');
run(seed=>['easy','normal','hard','normal'].map((l,k)=>({id:'b'+k,name:l+k,bot:true,lvl:l,tag:l+(k==3?'2':'')})),400,'levels');
