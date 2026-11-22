const E = require('../src/engine.js');
const assert = require('assert');
const { CHAINS } = E;

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- unit tests ----------
// price table
assert.strictEqual(E.price(1, 2), 200); assert.strictEqual(E.price(3, 2), 300); assert.strictEqual(E.price(6, 2), 400);
assert.strictEqual(E.price(1, 6), 600); assert.strictEqual(E.price(1, 10), 600); assert.strictEqual(E.price(1, 11), 700);
assert.strictEqual(E.price(3, 20), 800); assert.strictEqual(E.price(3, 21), 900); assert.strictEqual(E.price(6, 41), 1200);
assert.strictEqual(E.price(7, 40), 1100); assert.strictEqual(E.price(2, 41), 1000);

function mk(n) {
  const s = E.newGame(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, bot: false })), mulberry(7));
  s.board = Array(108).fill(null); s.players.forEach(p => { p.stocks = [0, 0, 0, 0, 0, 0, 0, 0]; p.cash = 6000; p.hand = []; });
  s.pend = null; s.phase = 'place'; s.turn = 0; s.tycoon = false;
  return s;
}
function put(s, chain, tiles) { tiles.forEach(t => s.board[t] = chain); }
const T = (col, row) => (col - 1) + (row.charCodeAt(0) - 65) * 12; // "5C" -> T(5,'C')

// bonuses: single holder gets both
{
  const s = mk(3); s.players[1].stocks[3] = 4;
  const b = E.computeBonuses(s, 3, 400);
  assert.deepStrictEqual(b.map(x => [x.i, x.amt]), [[1, 6000]]);
}
// majority + minority
{
  const s = mk(3); s.players[0].stocks[3] = 5; s.players[1].stocks[3] = 3; s.players[2].stocks[3] = 1;
  const b = E.computeBonuses(s, 3, 400);
  assert.deepStrictEqual(b.map(x => [x.i, x.amt]), [[0, 4000], [1, 2000]]);
}
// tie majority: split sum, round up to 100, no minority
{
  const s = mk(3); s.players[0].stocks[3] = 4; s.players[1].stocks[3] = 4; s.players[2].stocks[3] = 1;
  const b = E.computeBonuses(s, 3, 300); // maj 3000 + min 1500 = 4500 /2 = 2250 -> 2300
  assert.deepStrictEqual(b.map(x => [x.i, x.amt]), [[0, 2300], [1, 2300]]);
}
// tie minority
{
  const s = mk(4); s.players[0].stocks[3] = 5; s.players[1].stocks[3] = 2; s.players[2].stocks[3] = 2; s.players[3].stocks[3] = 1;
  const b = E.computeBonuses(s, 3, 300); // min 1500 /2 = 750 -> 800
  assert.deepStrictEqual(b.map(x => [x.i, x.amt]), [[0, 3000], [1, 800], [2, 800]]);
}
// three-way majority tie
{
  const s = mk(3); [0, 1, 2].forEach(i => s.players[i].stocks[1] = 2);
  const b = E.computeBonuses(s, 1, 200); // (2000+1000)/3 = 1000
  assert.deepStrictEqual(b.map(x => x.amt), [1000, 1000, 1000]);
}

// analysis
{
  const s = mk(2);
  put(s, 1, [T(1, 'A'), T(2, 'A')]);
  assert.strictEqual(E.analyze(s.board, T(3, 'A')).kind, 'grow');
  assert.strictEqual(E.analyze(s.board, T(8, 'E')).kind, 'alone');
  s.board[T(8, 'E')] = 0;
  assert.strictEqual(E.analyze(s.board, T(9, 'E')).kind, 'found');
  // all 7 on board => blocked
  const s2 = mk(2);
  for (let c = 1; c <= 7; c++) put(s2, c, [T(1, 'ABCDEFG'[c - 1]), T(2, 'ABCDEFG'[c - 1])].map(x => x)); // rows A..G cols 1-2
  s2.board[T(8, 'I')] = 0;
  assert.strictEqual(E.analyze(s2.board, T(9, 'I')).kind, 'blocked');
  // safe + safe => dead
  const s3 = mk(2);
  put(s3, 1, Array.from({ length: 11 }, (_, i) => T(1 + i, 'A')).slice(0, 11));
  put(s3, 2, Array.from({ length: 11 }, (_, i) => T(1 + i, 'C')));
  assert.strictEqual(E.analyze(s3.board, T(3, 'B')).kind, 'dead');
  // safe + small => merge
  const s4 = mk(2);
  put(s4, 1, Array.from({ length: 11 }, (_, i) => T(1 + i, 'A')));
  put(s4, 2, [T(3, 'C'), T(4, 'C')]);
  assert.strictEqual(E.analyze(s4.board, T(3, 'B')).kind, 'merge');
}

// full merger flow: Takealot(3 tiles) + Mr Price(2 tiles) via tile in between, with unaligned neighbour
{
  const s = mk(3);
  put(s, 3, [T(1, 'B'), T(2, 'B'), T(3, 'B')]);        // Takealot size 3
  put(s, 1, [T(5, 'B'), T(6, 'B')]);                    // Mr Price size 2
  s.board[T(4, 'C')] = 0;                               // unaligned neighbour of merge tile
  s.players[0].hand = [T(4, 'B'), 0, 1, 2, 3, 4];
  s.players[0].stocks[1] = 2; s.players[1].stocks[1] = 1; s.players[2].stocks[1] = 0;
  s.players[1].stocks[3] = 3;
  let r = E.apply(s, { type: 'place', t: T(4, 'B') }, 0);
  assert(r.ok, r.error); let st = r.state;
  assert.strictEqual(st.pend.survivor, 3);
  assert.strictEqual(st.phase, 'dispose');                // P0 and P1 hold Mr Price
  assert.strictEqual(E.actorOf(st), 0);
  // P0 had majority 2, P1 minority 1; Mr Price size2 => price 200: maj 2000, min 1000
  assert.strictEqual(st.players[0].cash, 8000); assert.strictEqual(st.players[1].cash, 7000);
  // wrong actor
  assert(!E.apply(st, { type: 'dispose', sell: 2, trade: 0 }, 1).ok);
  // too many
  assert(!E.apply(st, { type: 'dispose', sell: 3, trade: 0 }, 0).ok);
  // odd trade
  assert(!E.apply(st, { type: 'dispose', sell: 0, trade: 1 }, 0).ok);
  r = E.apply(st, { type: 'dispose', sell: 0, trade: 2 }, 0); assert(r.ok, r.error); st = r.state;
  assert.strictEqual(st.players[0].stocks[3], 1); assert.strictEqual(st.players[0].stocks[1], 0);
  assert.strictEqual(E.actorOf(st), 1);
  r = E.apply(st, { type: 'dispose', sell: 1, trade: 0 }, 1); assert(r.ok, r.error); st = r.state;
  assert.strictEqual(st.players[1].cash, 7200);
  assert.strictEqual(st.phase, 'buy');
  // everything is Takealot now: 3 + 2 + tile + unaligned neighbour = 7
  assert.strictEqual(E.sizes(st.board)[3], 7); assert.strictEqual(E.sizes(st.board)[1], 0);
  assert.strictEqual(st.board[T(4, 'C')], 3);
}

// tie for survivor: maker chooses; then ordering ties for 3-way merge
{
  const s = mk(2);
  put(s, 3, [T(1, 'B'), T(2, 'B')]); put(s, 1, [T(4, 'B'), T(5, 'B')]); put(s, 2, [T(3, 'A'), T(3, 'C')].concat([T(3, 'D')]));
  // tile 3B touches 3 chains: Takealot(2), Mr Price(2), Checkers(3 incl 3A? 3A,3C,3D are not connected, ensure adjacency)
  s.board[T(3, 'C')] = 2; s.board[T(3, 'A')] = 2; // 3A and 3C are chains pieces; make 3 tile chain valid-ish
  s.players[0].hand = [T(3, 'B'), 0, 1, 2, 3, 4];
  const r = E.apply(s, { type: 'place', t: T(3, 'B') }, 0); assert(r.ok, r.error);
  // sizes: Checkers(2: 3A,3C... 3D disjoint is also chain 2) so Checkers is 3 -> unique largest
  assert.strictEqual(r.state.pend.survivor, 2);
  // defunct Takealot(2) and Mr Price(2) tie => order choice
  assert.strictEqual(r.state.phase, 'mergeOrder');
  assert(!E.apply(r.state, { type: 'pickOrder', chain: 2 }, 0).ok);
  const r2 = E.apply(r.state, { type: 'pickOrder', chain: 3 }, 0); assert(r2.ok, r2.error);
  // nobody has shares => straight to next tie-less defunct then buy
  assert.strictEqual(r2.state.phase, 'buy');
  assert.strictEqual(E.sizes(r2.state.board)[2], 3 + 2 + 2 + 1);
}
{
  const s = mk(2);
  put(s, 3, [T(1, 'B'), T(2, 'B')]); put(s, 1, [T(4, 'B'), T(5, 'B')]);
  s.players[0].hand = [T(3, 'B'), 0, 1, 2, 3, 4];
  const r = E.apply(s, { type: 'place', t: T(3, 'B') }, 0); assert(r.ok, r.error);
  assert.strictEqual(r.state.phase, 'mergePick');
  assert(!E.apply(r.state, { type: 'pickSurvivor', chain: 2 }, 0).ok);
  assert(!E.apply(r.state, { type: 'pickSurvivor', chain: 3 }, 1).ok);
  const r2 = E.apply(r.state, { type: 'pickSurvivor', chain: 1 }, 0); assert(r2.ok);
  assert.strictEqual(r2.state.phase, 'buy'); assert.strictEqual(E.sizes(r2.state.board)[1], 5);
}

// founding: free share, then all tiles join
{
  const s = mk(2);
  s.board[T(5, 'E')] = 0;
  s.players[0].hand = [T(6, 'E'), 0, 1, 2, 3, 4];
  let r = E.apply(s, { type: 'place', t: T(6, 'E') }, 0); assert(r.ok); assert.strictEqual(r.state.phase, 'found');
  assert(!E.apply(r.state, { type: 'found', chain: 9 }, 0).ok);
  r = E.apply(r.state, { type: 'found', chain: 4 }, 0); assert(r.ok);
  assert.strictEqual(r.state.players[0].stocks[4], 1); assert.strictEqual(E.sizes(r.state.board)[4], 2); assert.strictEqual(r.state.phase, 'buy');
  // buying rules
  assert(!E.apply(r.state, { type: 'buy', buys: { 4: 4 } }, 0).ok);                 // >3
  assert(!E.apply(r.state, { type: 'buy', buys: { 3: 1 } }, 0).ok);                 // not on board
  const rb = E.apply(r.state, { type: 'buy', buys: { 4: 3 } }, 0); assert(rb.ok, rb.error);
  assert.strictEqual(rb.state.players[0].cash, 6000 - 3 * 300); assert.strictEqual(rb.state.players[0].stocks[4], 4);
  assert.strictEqual(rb.state.turn, 1);
}
// end condition + final scoring
{
  const s = mk(2);
  put(s, 3, Array.from({ length: 41 }, (_, i) => i)); // 41 tiles
  s.players[0].stocks[3] = 10; s.players[1].stocks[3] = 5;
  assert(E.endCondition(s));
  s.players[0].hand = [100, 101, 102, 103, 104, 105];
  const r = E.apply(s, { type: 'declareEnd' }, 0); assert(r.ok, r.error);
  assert.strictEqual(r.state.phase, 'over');
  // price 41+ tier1 = 1100; maj 11000 min 5500; stocks sold 10*1100 / 5*1100
  assert.strictEqual(r.state.over.results[0].total, 6000 + 11000 + 11000);
  assert.strictEqual(r.state.over.results[1].total, 6000 + 5500 + 5500);
  assert(r.state.over.results[0].winner && !r.state.over.results[1].winner);
}
{
  const s = mk(2);
  put(s, 3, [0, 1, 2]);
  assert(!E.endCondition(s));
  put(s, 3, Array.from({ length: 11 }, (_, i) => i));
  assert(E.endCondition(s));
  put(s, 1, [20, 21, 22]);
  assert(!E.endCondition(s));
}
console.log('unit tests passed');

// ---------- tycoon (top 3) bonuses ----------
function tyc(n){const s=mk(n);s.tycoon=true;return s}
const pay=(s,c,pr)=>E.computeBonuses(s,c,pr).map(x=>[x.i,x.amt]);
{ // 5/3/1 at R400: 4000 / 2000 / 1200
  const s=tyc(3); s.players[0].stocks[3]=5; s.players[1].stocks[3]=3; s.players[2].stocks[3]=1;
  assert.deepStrictEqual(pay(s,3,400),[[0,4000],[1,2000],[2,1200]]);
}
{ // two tied for most share 1st+2nd, the next player takes 3rd
  const s=tyc(3); s.players[0].stocks[3]=4; s.players[1].stocks[3]=4; s.players[2].stocks[3]=1;
  assert.deepStrictEqual(pay(s,3,300),[[0,2300],[1,2300],[2,900]]);
}
{ // tie for second shares 2nd+3rd
  const s=tyc(4); s.players[0].stocks[3]=5; s.players[1].stocks[3]=2; s.players[2].stocks[3]=2; s.players[3].stocks[3]=1;
  assert.deepStrictEqual(pay(s,3,300),[[0,3000],[1,1200],[2,1200]]);   // (1500+900)/2
}
{ // only two holders: unclaimed 3rd goes to the top holder
  const s=tyc(3); s.players[0].stocks[3]=5; s.players[1].stocks[3]=3;
  assert.deepStrictEqual(pay(s,3,300),[[0,3900],[1,1500]]);
}
{ // sole holder takes everything
  const s=tyc(3); s.players[2].stocks[3]=2;
  assert.deepStrictEqual(pay(s,3,300),[[2,5400]]);
}
{ // three-way tie splits all three prizes
  const s=tyc(3); [0,1,2].forEach(i=>s.players[i].stocks[3]=3);
  assert.deepStrictEqual(pay(s,3,300),[[0,1800],[1,1800],[2,1800]]);
}
{ // four holders: 4th gets nothing
  const s=tyc(4); [4,3,2,1].forEach((v,i)=>s.players[i].stocks[1]=v);
  assert.deepStrictEqual(pay(s,1,200),[[0,2000],[1,1000],[2,600]]);
}
{ // tycoon rounding goes up to the next R100
  const s=tyc(3); s.players[0].stocks[1]=2; s.players[1].stocks[1]=2; s.players[2].stocks[1]=2;
  assert.deepStrictEqual(pay(s,1,200),[[0,1200],[1,1200],[2,1200]]);   // 3600/3 = 1200
}
{ // defunct company pays tycoon bonuses during a merger
  const s=mk(3); s.tycoon=true;
  put(s,3,[T(1,'B'),T(2,'B'),T(3,'B')]); put(s,1,[T(5,'B'),T(6,'B')]);
  s.players[0].hand=[T(4,'B'),0,1,2,3,4];
  s.players[0].stocks[1]=3; s.players[1].stocks[1]=2; s.players[2].stocks[1]=1;
  const r=E.apply(s,{type:'place',t:T(4,'B')},0); assert(r.ok,r.error);
  // Mr Price size 2 -> R200: 2000, 1000, 600
  assert.strictEqual(r.state.players[0].cash,8000);
  assert.strictEqual(r.state.players[1].cash,7000);
  assert.strictEqual(r.state.players[2].cash,6600);
  assert.strictEqual(r.state.players[2].st.mbonus,600);
}
console.log('tycoon tests passed');


// ---------- invariants ----------
function check(s, ctx) {
  const tiles = s.board.filter(v => v !== null).length + s.players.reduce((a, p) => a + p.hand.length, 0) + s.bag.length + s.discard.length;
  assert.strictEqual(tiles, 108, 'tile conservation ' + ctx);
  s.players.forEach(p => { assert(p.cash >= 0, 'cash ' + ctx); assert(p.hand.length <= 6, 'hand'); });
  if (s.phase !== 'over') for (let c = 1; c <= 7; c++) assert(E.bankLeft(s, c) >= 0 && E.bankLeft(s, c) <= 25, 'bank ' + c + ' ' + ctx);
  const sz = E.sizes(s.board);
  if (s.phase === 'place' || s.phase === 'buy' || s.phase === 'over') {
    for (let c = 1; c <= 7; c++) assert(sz[c] === 0 || sz[c] >= 2, 'chain size ' + c + ' ' + ctx);
    for (let t = 0; t < 108; t++) {
      const v = s.board[t]; if (v === null) continue;
      E.nbrs(t).forEach(n => {
        const w = s.board[n]; if (w === null) return;
        if (v > 0 && w > 0) assert.strictEqual(v, w, 'two chains touch ' + ctx);
        if ((v > 0 && w === 0) || (v === 0 && w > 0)) assert.fail('unaligned touches chain ' + ctx);
      });
    }
  }
  if (s.phase !== 'over') {
    const nw = E.netWorths(s), pj = E.projected(s).map(r => r.total);
    assert.deepStrictEqual(nw, pj, 'netWorths == projected ' + ctx);
  } else {
    assert.deepStrictEqual(s.hist[s.hist.length - 1], s.over.results.map(r => r.total), 'final hist ' + ctx);
  }
  s.hist.forEach(h => assert.strictEqual(h.length, s.players.length, 'hist width'));
  // no two safe chains can ever be merged => no chain pair shares a cell, covered above
  for (let c = 1; c <= 7; c++) if (s.phase !== 'over') { let held = 0; s.players.forEach(p => held += p.stocks[c]); assert(held <= 25, 'over 25 shares'); }
}

// ---------- fuzz with random legal agent + real bot ----------
function randAction(s, rng) {
  const i = E.actorOf(s), me = s.players[i], sz = E.sizes(s.board);
  const pick = a => a[Math.floor(rng() * a.length)];
  switch (s.phase) {
    case 'place': {
      if (E.endCondition(s) && rng() < 0.5) return { type: 'declareEnd' };
      return { type: 'place', t: pick(me.hand.filter(t => E.isPlayable(s.board, t))) };
    }
    case 'found': { const f = []; for (let c = 1; c <= 7; c++) if (!sz[c]) f.push(c); return { type: 'found', chain: pick(f) }; }
    case 'mergePick': return { type: 'pickSurvivor', chain: pick(s.pend.options) };
    case 'mergeOrder': return { type: 'pickOrder', chain: pick(s.pend.options) };
    case 'dispose': {
      const h = me.stocks[s.pend.cur], bank = E.bankLeft(s, s.pend.survivor);
      const tmax = Math.min(Math.floor(h / 2), bank);
      const trade = 2 * Math.floor(rng() * (tmax + 1));
      const sell = Math.floor(rng() * (h - trade + 1));
      return { type: 'dispose', sell, trade };
    }
    case 'buy': {
      const buys = {}; let n = 0, cash = me.cash;
      const left = {}; for (let c = 1; c <= 7; c++) left[c] = E.bankLeft(s, c);
      const want = Math.floor(rng() * 4);
      for (let k = 0; k < want; k++) {
        const opts = []; for (let c = 1; c <= 7; c++) if (sz[c] >= 2 && left[c] > 0 && E.price(c, sz[c]) <= cash) opts.push(c);
        if (!opts.length) break; const c = pick(opts); buys[c] = (buys[c] || 0) + 1; cash -= E.price(c, sz[c]); left[c]--; n++;
      }
      const a = { type: 'buy', buys };
      if (E.endCondition(s) && rng() < 0.5) a.end = true;
      return a;
    }
  }
}

function play(seed, n, mode) {
  const rng = mulberry(seed);
  const defs = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, bot: true }));
  let s = E.newGame(defs, rng, { tycoon: seed % 3 !== 0 }); let steps = 0; const stats = { merges: 0, found: 0 };
  check(s, 'init');
  while (s.phase !== 'over') {
    const who = E.actorOf(s);
    const a = (mode === 'rand' || (mode === 'mixed' && who % 2)) ? randAction(s, rng) : E.botAction(s, rng);
    assert(a, 'no action phase=' + s.phase);
    const r = E.apply(s, a, who);
    assert(r.ok, 'seed ' + seed + ' mode ' + mode + ' phase ' + s.phase + ' action ' + JSON.stringify(a) + ' -> ' + r.error);
    s = r.state; check(s, 'seed ' + seed + ' step ' + steps);
    if (++steps > 4000) assert.fail('game did not end, seed ' + seed + ' mode ' + mode);
  }
  assert(s.over.results.some(r => r.winner));
  const st = E.computeStats(s);
  assert(st.champion.winners.length >= 1);
  if (st.comeback) assert(st.comeback.from > st.comeback.to);
  if (st.roi) assert(isFinite(st.roi.roi));
  assert.strictEqual(s.tycoon, seed % 3 !== 0);
  return { s, steps, st };
}

const modes = ['bot', 'rand', 'mixed'];
let games = 0, reasons = {}, totalSteps = 0, chainMax = 0;
for (const mode of modes) for (let seed = 1; seed <= 250; seed++) {
  const n = 2 + (seed % 5);
  const { s, steps } = play(seed * 31 + mode.length, n, mode);
  games++; totalSteps += steps;
  const r = s.over.reason.replace(/^.* ended the game\./, 'a player ended the game.'); reasons[r] = (reasons[r] || 0) + 1;
}
console.log('fuzz ok:', games, 'games,', totalSteps, 'actions');
console.log('end reasons:', reasons);

// bot-vs-bot statistics: does the game finish with real mergers & healthy payouts?
let merges = 0, winnerTotals = [], sizesAtEnd = [];
for (let seed = 1; seed <= 60; seed++) {
  const { s } = play(900 + seed, 4, 'bot');
  s.log.length; winnerTotals.push(Math.max(...s.over.results.map(r => r.total)));
  sizesAtEnd.push(E.sizes(s.board).slice(1).filter(x => x > 0).length);
}
let cbs = 0, rois = []; for (let seed = 1; seed <= 40; seed++) { const { st } = play(300 + seed, 4, 'bot'); if (st.comeback) cbs++; if (st.roi) rois.push(st.roi.roi); }
console.log('stats: games with a comeback', cbs + '/40', ' median best ROI', (rois.sort((a, b) => a - b)[rois.length >> 1] * 100).toFixed(0) + '%');
console.log('median winner total:', winnerTotals.sort((a, b) => a - b)[30], ' median chains on board at end:', sizesAtEnd.sort((a, b) => a - b)[30]);
