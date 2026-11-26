const E=require('./engine.js');
const R=E.rngFromSeed;
let bad=0,evs=0,games=0,evCo={},tileGames=0,cashGames=0;
function play(defs,rng,opts){let s=E.newGame(defs,rng,opts),n=0;
 while(s.phase!=='over'&&n++<8000){const a=E.actorOf(s);const r=E.apply(s,E.botAction(s,rng),a);if(!r.ok){bad++;console.log('fail',r.error);break}s=r.state;
   if(s.ev){evs++;evCo[s.ev.co]=1;
     // price must reflect event
     E.useState(s);const sz=E.sizes(s.board);if(sz[s.ev.co]>=2){const base=E.price(s.ev.co,sz[s.ev.co]);E.useState(null);const nb=E.price(s.ev.co,sz[s.ev.co]);E.useState(s);if(base!==Math.max(100,nb+s.ev.d)){bad++;console.log('price mismatch')}}
   }
   const tot=s.players.reduce((a,p)=>a+p.stocks.reduce((x,y)=>x+y,0),0);if(tot>25*7){bad++}
   s.players.forEach(p=>{if(p.cash<0){bad++;console.log('neg cash')}})}
 if(s.phase!=='over'){bad++;console.log('not over')}
 return s}
for(let seed=1;seed<=150;seed++){
 const rng=R(seed);
 const s=play([{id:'a',name:'A',bot:true,beg:true},{id:'b',name:'B',bot:true},{id:'c',name:'C',bot:true}],rng,{rules:{events:true,hcap:(seed%2?'tile':'cash')}});games++;
 if(s.ev)bad++; // cleared at end
 const A=s.players.find(p=>p.id==='a');
 if(seed%2){tileGames++;if(!A.beg||A.hand.length>7)bad++}else{cashGames++;if(s.players.find(p=>p.id==='b').c0!==4500||A.c0!==6000)bad++}
}
// determinism: same seed gives same first hands
const mkd=()=>E.newGame([{id:'you',name:'Y'},{id:'x',name:'X',bot:true},{id:'z',name:'Z',bot:true}],R(20261126),{});
const a=mkd(),b=mkd();if(JSON.stringify(a)!==JSON.stringify(b)){bad++;console.log('not deterministic')}
// no handicap if nobody marked
const n=E.newGame([{id:'a',name:'A'},{id:'b',name:'B'}],R(5),{rules:{hcap:'cash'}});if(n.players[0].cash!==6000||n.rules.hcap!=='')bad++;
// extra tile
const t=E.newGame([{id:'a',name:'A',beg:true},{id:'b',name:'B'}],R(6),{rules:{hcap:'tile'}});if(t.players.find(p=>p.id==='a').hand.length!==7||t.players.find(p=>p.id==='b').hand.length!==6)bad++;
// keepOrder
const k=E.newGame([{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}],R(9),{keepOrder:true});if(k.players.map(p=>p.id).join('')!=='abc')bad++;
// events off => never
let off=0;for(let sd=1;sd<=20;sd++){const s=play([{id:'a',name:'A',bot:true},{id:'b',name:'B',bot:true}],R(sd+500),{});if(s.log.some(l=>/Market event/.test(l)))off++}
console.log('games',games,'event-turns',evs,'companies hit',Object.keys(evCo).length,'tile',tileGames,'cash',cashGames,'events when off',off,'BAD',bad);
