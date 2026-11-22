const E=require('../src/engine.js'), assert=require('assert');
const T=(c,r)=>(c-1)+(r.charCodeAt(0)-65)*12;
function mk(n){const s=E.newGame(Array.from({length:n},(_,i)=>({id:'p'+i,name:'P'+i})),()=>0.3);s.board=Array(108).fill(null);s.players.forEach(p=>{p.stocks=[0,0,0,0,0,0,0,0];p.hand=[]});s.discard=[];s.pend=null;s.phase='buy';s.turn=0;s.bag=[];return s;}
// stall: all 7 chains on board, everyone holds only founder-blocked tiles, bag empty
{
 const s=mk(2);
 for(let c=1;c<=7;c++){s.board[T(1,'ABCDEFG'[c-1])]=c;s.board[T(2,'ABCDEFG'[c-1])]=c;}
 s.board[T(8,'I')]=0;                       // unaligned tile
 s.players[0].hand=[T(9,'I')]; s.players[1].hand=[T(7,'I')];   // both would found a chain
 const r=E.apply(s,{type:'buy',buys:{}},0); assert(r.ok,r.error);
 assert.strictEqual(r.state.phase,'over'); console.log('stall ->',r.state.over.reason);
}
// dead tile swap at start of turn when bag has tiles
{
 const s=mk(2);
 for(let i=0;i<11;i++){s.board[T(1+i,'A')]=1;s.board[T(1+i,'C')]=2;}
 s.players[1].hand=[T(3,'B'),T(9,'F'),T(10,'G')]; s.players[0].hand=[T(5,'H')];
 s.bag=[T(12,'I'),T(12,'H'),T(11,'I')];
 const r=E.apply(s,{type:'buy',buys:{}},0); assert(r.ok,r.error);
 const st=r.state; assert.strictEqual(st.turn,1); assert(!st.players[1].hand.includes(T(3,'B')));
 assert.strictEqual(st.discard.length,1); console.log('dead tile swapped; hand',st.players[1].hand.map(E.tileLabel).join(' '),'phase',st.phase);
}
// no playable tile (only blocked) but bag nonempty & someone else can play => skip to buy
{
 const s=mk(2);
 for(let c=1;c<=7;c++){s.board[T(1,'ABCDEFG'[c-1])]=c;s.board[T(2,'ABCDEFG'[c-1])]=c;}
 s.board[T(8,'I')]=0;
 s.players[1].hand=[T(9,'I')]; s.players[0].hand=[T(5,'E')]; s.bag=[T(12,'A')];
 const r=E.apply(s,{type:'buy',buys:{}},0); assert(r.ok,r.error);
 console.log('blocked player ->',r.state.phase,'turn',r.state.turn,r.state.log.slice(-2).join(' | '));
}
// merge involving a safe chain: safe survives, small is absorbed
{
 const s=mk(2); s.phase='place';
 for(let i=0;i<12;i++) s.board[T(1+i,'A')]=3;
 s.board[T(1,'C')]=5; s.board[T(2,'C')]=5;
 s.players[0].hand=[T(1,'B')]; s.players[0].stocks[5]=3; s.bag=[T(12,'I')];
 let r=E.apply(s,{type:'place',t:T(1,'B')},0); assert(r.ok,r.error);
 assert.strictEqual(r.state.pend.survivor,3); assert.strictEqual(r.state.phase,'dispose');
 console.log('safe merge ok, bonus cash', r.state.players[0].cash);
}
