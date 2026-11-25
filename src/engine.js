/* Acquire SA rules engine. Pure functions over a plain-JSON state. */
(function (root) {
  'use strict';

  var COLS = 12, ROWS = 9, N = 108, HAND = 6, START_CASH = 6000, SHARES = 25;
  var ROW_L = 'ABCDEFGHI';

  // id 1..7. tier 0 cheap, 1 mid, 2 premium.
  var CHAINS = [
    null,
    { id: 1, name: 'Mr Price',   abbr: 'MP', tier: 0, color: '#d95a00', ink: '#ffffff' },
    { id: 2, name: 'Checkers',   abbr: 'CK', tier: 0, color: '#008a8f', ink: '#ffffff' },
    { id: 3, name: 'Takealot',   abbr: 'TK', tier: 1, color: '#0b6bcb', ink: '#ffffff' },
    { id: 4, name: 'MTN',        abbr: 'MT', tier: 1, color: '#ffcb05', ink: '#1a1a1a' },
    { id: 5, name: 'Nedbank',    abbr: 'NB', tier: 1, color: '#00843d', ink: '#ffffff' },
    { id: 6, name: 'Vodacom',    abbr: 'VD', tier: 2, color: '#e60000', ink: '#ffffff' },
    { id: 7, name: 'Woolworths', abbr: 'WW', tier: 2, color: '#1b1b1f', ink: '#ffffff' }
  ];

  function tileLabel(t) { return (t % COLS + 1) + ROW_L[Math.floor(t / COLS)]; }
  function nbrs(t) {
    var r = Math.floor(t / COLS), c = t % COLS, o = [];
    if (r > 0) o.push(t - COLS);
    if (r < ROWS - 1) o.push(t + COLS);
    if (c > 0) o.push(t - 1);
    if (c < COLS - 1) o.push(t + 1);
    return o;
  }
  function tileKey(t) { return (t % COLS) * ROWS + Math.floor(t / COLS); } // closeness to 1A

  function sizes(board) {
    var s = [0, 0, 0, 0, 0, 0, 0, 0];
    for (var i = 0; i < board.length; i++) if (board[i] > 0) s[board[i]]++;
    return s;
  }
  function activeIds(board) {
    var s = sizes(board), a = [];
    for (var c = 1; c <= 7; c++) if (s[c] > 0) a.push(c);
    return a;
  }
  function price(id, size) {
    if (size < 2) return 0;
    var b;
    if (size <= 5) b = size * 100;
    else if (size <= 10) b = 600;
    else if (size <= 20) b = 700;
    else if (size <= 30) b = 800;
    else if (size <= 40) b = 900;
    else b = 1000;
    return b + CHAINS[id].tier * 100;
  }
  function bankLeft(s, c) {
    var n = SHARES;
    for (var i = 0; i < s.players.length; i++) n -= s.players[i].stocks[c];
    return n;
  }
  function ceil100(x) { return Math.ceil(x / 100) * 100; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // What happens if tile t is played on this board.
  function analyze(board, t) {
    var adj = [], adjUn = false, n = nbrs(t), i, v;
    for (i = 0; i < n.length; i++) {
      v = board[n[i]];
      if (v > 0) { if (adj.indexOf(v) < 0) adj.push(v); }
      else if (v === 0) adjUn = true;
    }
    if (adj.length === 0) {
      if (!adjUn) return { kind: 'alone' };
      if (activeIds(board).length >= 7) return { kind: 'blocked', reason: 'All 7 companies are already on the board' };
      return { kind: 'found' };
    }
    if (adj.length === 1) return { kind: 'grow', chain: adj[0] };
    var sz = sizes(board), safe = 0;
    for (i = 0; i < adj.length; i++) if (sz[adj[i]] >= 11) safe++;
    if (safe >= 2) return { kind: 'dead', reason: 'Would merge two safe companies' };
    return { kind: 'merge', chains: adj.slice() };
  }
  function isPlayable(board, t) {
    var k = analyze(board, t).kind;
    return k !== 'dead' && k !== 'blocked';
  }
  // Mark every unaligned tile connected to t (excluding t) with chain c. Returns count.
  function absorb(board, t, c) {
    var stack = [t], seen = {}, count = 0;
    seen[t] = true;
    while (stack.length) {
      var x = stack.pop(), n = nbrs(x);
      for (var i = 0; i < n.length; i++) {
        var y = n[i];
        if (!seen[y] && board[y] === 0) {
          seen[y] = true; board[y] = c; count++; stack.push(y);
        }
      }
    }
    return count;
  }
  function floodCount(board, t) {
    return absorb(board.slice(), t, 9);
  }

  function endCondition(s) {
    var sz = sizes(s.board), act = [], c;
    for (c = 1; c <= 7; c++) if (sz[c] > 0) act.push(c);
    if (!act.length) return false;
    for (c = 0; c < act.length; c++) if (sz[act[c]] >= 41) return true;
    for (c = 0; c < act.length; c++) if (sz[act[c]] < 11) return false;
    return true;
  }

  function ord(n) { return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'); }
  // Pure: who receives which bonus for chain c at share price pr.
  // Tycoon: 1st 10x, 2nd 5x, 3rd 3x. Classic: 1st 10x, 2nd 5x.
  // Players tied on shares pool the prizes of the places they occupy and split them (rounded up to R100);
  // the next player down then takes the next unclaimed place. Prizes nobody can claim go to the top group.
  function computeBonuses(s, c, pr) {
    var mult = s.tycoon === false ? [10, 5] : [10, 5, 3], prizes = mult.map(function (m) { return pr * m; });
    var hold = [], i, out = [];
    for (i = 0; i < s.players.length; i++) if (s.players[i].stocks[c] > 0) hold.push({ i: i, n: s.players[i].stocks[c] });
    if (!hold.length) return out;
    hold.sort(function (a, b) { return b.n - a.n; });
    var groups = [], pos = 0, g = 0, q;
    while (g < hold.length && pos < prizes.length) {
      var n = hold[g].n, k = 0;
      while (g + k < hold.length && hold[g + k].n === n) k++;
      var pool = 0;
      for (q = pos; q < Math.min(pos + k, prizes.length); q++) pool += prizes[q];
      groups.push({ m: hold.slice(g, g + k), pool: pool, pos: pos });
      pos += k; g += k;
    }
    for (q = pos; q < prizes.length; q++) groups[0].pool += prizes[q];
    groups.forEach(function (gr) {
      var amt = ceil100(gr.pool / gr.m.length);
      var kind = gr.m.length === 1 ? ord(gr.pos + 1) + ' place' : 'tied ' + ord(gr.pos + 1) + ' place';
      gr.m.forEach(function (h) { out.push({ i: h.i, amt: amt, kind: kind, place: gr.pos + 1 }); });
    });
    return out;
  }

  function addLog(s, msg) {
    s.log.push(msg);
    if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
  }
  function money(n) { return 'R' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }
  function pname(s, i) { return s.players[i].name; }

  function actorOf(s) {
    if (s.phase === 'dispose' && s.pend) return s.pend.queue[0];
    if (s.phase === 'over') return -1;
    if (s.offer) return s.offer.to;
    return s.turn;
  }

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function newGame(defs, rng, opts) {
    rng = rng || Math.random;
    var bag = [], i;
    for (i = 0; i < N; i++) bag.push(i);
    shuffle(bag, rng);
    var players = defs.map(function (d) {
      return { id: d.id, name: d.name, bot: !!d.bot, pers: d.pers || 'balanced', lvl: d.lvl || 'normal', cash: START_CASH, stocks: [0, 0, 0, 0, 0, 0, 0, 0], hand: [],
        st: { spent: 0, bought: 0, proceeds: 0, mbonus: 0, founded: 0, merges: 0, best: { amt: 0, chain: 0, kind: '', final: false } } };
    });
    var s = { v: 2, rev: 0, tycoon: !(opts && opts.tycoon === false), hide: { shares: !!(opts && opts.hide && opts.hide.shares), worth: !!(opts && opts.hide && opts.hide.worth) }, rules: { founders: !!(opts && opts.rules && opts.rules.founders), offers: !!(opts && opts.rules && opts.rules.offers), timer: ((opts && opts.rules && +opts.rules.timer) | 0) }, mnote: null, founder: {}, oc: 0, offer: null, hist: [], players: players, board: [], bag: bag, discard: [], turn: 0, phase: 'place', pend: null, log: [], over: null };
    for (i = 0; i < N; i++) s.board.push(null);
    // draw for first move: each draws a tile, it goes on the board unaligned.
    var draws = players.map(function (p) { var t = s.bag.shift(); s.board[t] = 0; return { p: p, t: t }; });
    draws.sort(function (a, b) { return tileKey(a.t) - tileKey(b.t); });
    s.players = draws.map(function (d) { return d.p; });
    addLog(s, 'Draw for first move: ' + draws.map(function (d) { return d.p.name + ' ' + tileLabel(d.t); }).join(', ') + '.');
    addLog(s, s.players[0].name + ' goes first.');
    s.players.forEach(function (p) { while (p.hand.length < HAND) p.hand.push(s.bag.shift()); });
    s.turn = 0;
    s.hist.push(netWorths(s));
    addLog(s, s.tycoon ? 'Tycoon payouts: the top 3 shareholders are paid on every merger.' : 'Classic payouts: the top 2 shareholders are paid on every merger.');
    beginTurn(s);
    return s;
  }

  function anyPlayable(s) {
    return s.players.some(function (p) { return p.hand.some(function (t) { return isPlayable(s.board, t); }); });
  }
  function anyDead(s) {
    return s.players.some(function (p) { return p.hand.some(function (t) { return analyze(s.board, t).kind === 'dead'; }); });
  }

  function beginTurn(s) {
    if (s.over) return;
    var pl = s.players[s.turn], replaced = 0;
    s.oc = 0;
    for (;;) {
      var idx = -1;
      for (var k = 0; k < pl.hand.length; k++) if (analyze(s.board, pl.hand[k]).kind === 'dead') { idx = k; break; }
      if (idx < 0) break;
      var t = pl.hand.splice(idx, 1)[0];
      s.discard.push(t);
      replaced++;
      if (s.bag.length) pl.hand.push(s.bag.shift());
    }
    if (replaced) addLog(s, pl.name + ' swapped ' + replaced + ' unplayable tile' + (replaced > 1 ? 's' : '') + '.');
    if (!anyPlayable(s) && (s.bag.length === 0 || !anyDead(s))) {
      finalize(s, 'Nobody can play a tile any more.');
      return;
    }
    if (!pl.hand.some(function (t) { return isPlayable(s.board, t); })) {
      addLog(s, pl.name + ' has no playable tile.');
      s.phase = 'buy';
    } else s.phase = 'place';
  }

  function endTurn(s) {
    var pl = s.players[s.turn];
    while (pl.hand.length < HAND && s.bag.length) pl.hand.push(s.bag.shift());
    s.hist.push(netWorths(s));
    s.turn = (s.turn + 1) % s.players.length;
    s.pend = null;
    s.phase = 'place';
    beginTurn(s);
  }

  // ---- merger ----
  function mergeBegin(s, tile, chains) {
    var sz = sizes(s.board), p = { kind: 'merge', tile: tile, chains: chains.slice(), survivor: 0, sz: {}, defunct: [], cur: 0, price: 0, queue: [], options: [], paid: [] };
    chains.forEach(function (c) { p.sz[c] = sz[c]; });
    s.pend = p;
    s.players[s.turn].st.merges++;
    var max = Math.max.apply(null, chains.map(function (c) { return sz[c]; }));
    var tied = chains.filter(function (c) { return sz[c] === max; });
    if (tied.length > 1) { s.phase = 'mergePick'; p.options = tied; }
    else { p.survivor = tied[0]; mergeStart(s); }
  }
  function mergeStart(s) {
    var p = s.pend;
    p.defunct = p.chains.filter(function (c) { return c !== p.survivor; });
    addLog(s, pname(s, s.turn) + ' merges ' + p.chains.map(function (c) { return CHAINS[c].name; }).join(', ') + '. ' + CHAINS[p.survivor].name + ' survives.');
    mergeNext(s);
  }
  function mergeNext(s) {
    var p = s.pend;
    if (!p.defunct.length) { mergeFinish(s); return; }
    var max = Math.max.apply(null, p.defunct.map(function (c) { return p.sz[c]; }));
    var top = p.defunct.filter(function (c) { return p.sz[c] === max; });
    if (top.length > 1) { s.phase = 'mergeOrder'; p.options = top; return; }
    mergeDefunct(s, top[0]);
  }
  function mergeDefunct(s, c) {
    var p = s.pend;
    p.cur = c;
    p.defunct = p.defunct.filter(function (x) { return x !== c; });
    p.price = price(c, p.sz[c]);
    var pays = computeBonuses(s, c, p.price);
    if (!pays.length) addLog(s, 'Nobody holds ' + CHAINS[c].name + ' shares, so no bonuses.');
    var fbAmt = 0, fo = null;
    if (s.rules && s.rules.founders && s.founder && s.founder[c] != null && s.players[s.founder[c]]) {
      fo = s.players[s.founder[c]];
      fbAmt = 3 * p.price;
      fo.cash += fbAmt; fo.st.mbonus += fbAmt;
      addLog(s, fo.name + ' gets ' + money(fbAmt) + ' as the founder of ' + CHAINS[c].name + ' (the same as a third-place bonus).');
      delete s.founder[c];
    }
    pays.forEach(function (b) {
      var st = s.players[b.i].st;
      s.players[b.i].cash += b.amt;
      st.mbonus += b.amt;
      if (b.amt > st.best.amt) st.best = { amt: b.amt, chain: c, kind: b.kind, final: false };
      addLog(s, pname(s, b.i) + ' takes ' + money(b.amt) + ' for ' + b.kind + ' in ' + CHAINS[c].name + '.');
    });
    p.paid = pays;
    var note = CHAINS[p.survivor].name + ' swallowed ' + CHAINS[c].name + '. ' +
      (pays.length ? 'Bonuses to the biggest shareholders: ' + pays.map(function (b) { return s.players[b.i].name + ' ' + money(b.amt) + ' (' + b.kind + ')'; }).join(', ') + '.' : 'Nobody held shares, so no bonuses.') +
      (fo ? ' Founder ' + fo.name + ' gets ' + money(fbAmt) + '.' : '') +
      ' Now each shareholder sells at ' + money(p.price) + ' a share, trades 2 for 1 into ' + CHAINS[p.survivor].name + ', or keeps them.';
    s.mnote = s.mnote ? s.mnote + ' ' + note : note;
    var n = s.players.length, q = [];
    for (var k = 0; k < n; k++) {
      var i = (s.turn + k) % n;
      if (s.players[i].stocks[c] > 0) q.push(i);
    }
    p.queue = q;
    mergeDispose(s);
  }
  function mergeDispose(s) {
    var p = s.pend;
    if (!p.queue.length) { mergeNext(s); return; }
    s.phase = 'dispose';
  }
  function mergeFinish(s) {
    var p = s.pend, surv = p.survivor, i;
    for (i = 0; i < s.board.length; i++) if (p.chains.indexOf(s.board[i]) >= 0) s.board[i] = surv;
    s.board[p.tile] = surv;
    absorb(s.board, p.tile, surv);
    s.pend = null;
    s.phase = 'buy';
  }

  function finalize(s, reason) {
    var sz = sizes(s.board), bonus = s.players.map(function () { return 0; }), sold = s.players.map(function () { return 0; });
    for (var c = 1; c <= 7; c++) {
      if (sz[c] < 1) continue;
      var pr = price(c, sz[c]);
      computeBonuses(s, c, pr).forEach(function (b) {
        bonus[b.i] += b.amt;
        var st = s.players[b.i].st;
        if (b.amt > st.best.amt) st.best = { amt: b.amt, chain: c, kind: b.kind, final: true };
      });
      for (var i = 0; i < s.players.length; i++) {
        sold[i] += s.players[i].stocks[c] * pr;
      }
    }
    var res = s.players.map(function (p, i) {
      return { i: i, name: p.name, bonus: bonus[i], sold: sold[i], cash: p.cash, total: p.cash + bonus[i] + sold[i] };
    });
    var best = Math.max.apply(null, res.map(function (r) { return r.total; }));
    res.forEach(function (r) { r.winner = r.total === best; });
    s.players.forEach(function (p, i) { p.cash = res[i].total; });
    s.hist.push(res.map(function (r) { return r.total; }));
    s.over = { reason: reason, results: res };
    s.phase = 'over';
    s.pend = null;
    addLog(s, 'Game over. ' + reason);
    addLog(s, res.filter(function (r) { return r.winner; }).map(function (r) { return r.name; }).join(' & ') + ' wins with ' + money(best) + '.');
  }
  // What the standings would be if the game ended right now.
  function projected(s) {
    var c = clone(s);
    finalize(c, 'projection');
    return c.over.results;
  }

  // Net worth if the game ended right now: cash + bonuses + all shares at current prices.
  function netWorths(s) {
    var sz = sizes(s.board), w = s.players.map(function (p) { return p.cash; });
    for (var c = 1; c <= 7; c++) {
      if (sz[c] < 1) continue;
      var pr = price(c, sz[c]);
      computeBonuses(s, c, pr).forEach(function (b) { w[b.i] += b.amt; });
      for (var i = 0; i < s.players.length; i++) w[i] += s.players[i].stocks[c] * pr;
    }
    return w;
  }
  function rankIn(w, i) { var r = 1; for (var k = 0; k < w.length; k++) if (k !== i && w[k] > w[i]) r++; return r; }

  // End-of-game talking points. Only valid once s.over is set.
  function computeStats(s) {
    var n = s.players.length, res = s.over.results, hist = s.hist, i, k;
    var out = {};
    var best = Math.max.apply(null, res.map(function (r) { return r.total; }));
    var winners = res.filter(function (r) { return r.total === best; }).map(function (r) { return r.i; });
    var others = res.filter(function (r) { return r.total !== best; }).map(function (r) { return r.total; });
    out.champion = { winners: winners, total: best, margin: others.length ? best - Math.max.apply(null, others) : 0 };
    // comeback: biggest climb from worst ranking (after the opening rounds) to final ranking
    var from = Math.min(hist.length - 1, 2 * n), cb = null;
    for (i = 0; i < n; i++) {
      var fr = rankIn(hist[hist.length - 1], i), worst = 1, wAt = 0, wDef = 0;
      for (k = from; k < hist.length - 1; k++) {
        var r = rankIn(hist[k], i), lead = Math.max.apply(null, hist[k]), def = lead - hist[k][i];
        if (r > worst || (r === worst && def > wDef)) { worst = r; wAt = k; wDef = def; }
      }
      var gain = worst - fr;
      if (gain > 0 && (!cb || gain > cb.gain || (gain === cb.gain && wDef > cb.deficit)))
        cb = { i: i, from: worst, to: fr, round: Math.floor(wAt / n) + 1, deficit: wDef, gain: gain };
    }
    out.comeback = cb;
    // return on investment: (what shares paid back - what you spent on them) / spent
    var roi = null, pps = null, spender = null, merger = null, founder = null, payout = null, bonusKing = null, fall = null;
    for (i = 0; i < n; i++) {
      var st = s.players[i].st, r2 = res[i];
      var back = st.proceeds + st.mbonus + r2.bonus + r2.sold;
      if (st.spent > 0) {
        var ratio = (back - st.spent) / st.spent;
        if (!roi || ratio > roi.roi) roi = { i: i, roi: ratio, invested: st.spent, back: back };
      }
      if (st.bought > 0) {
        var per = (r2.total - START_CASH) / st.bought;
        if (!pps || per > pps.v) pps = { i: i, v: per, bought: st.bought, gain: r2.total - START_CASH };
      }
      if (!spender || st.spent > spender.spent) spender = { i: i, spent: st.spent };
      if (st.merges > 0 && (!merger || st.merges > merger.n)) merger = { i: i, n: st.merges };
      if (st.founded > 0 && (!founder || st.founded > founder.n)) founder = { i: i, n: st.founded };
      if (st.best.amt > 0 && (!payout || st.best.amt > payout.amt)) payout = { i: i, amt: st.best.amt, chain: st.best.chain, kind: st.best.kind, final: st.best.final };
      var totalB = st.mbonus + r2.bonus;
      if (totalB > 0 && (!bonusKing || totalB > bonusKing.amt)) bonusKing = { i: i, amt: totalB };
      var peak = 0, peakAt = 0;
      for (k = 0; k < hist.length; k++) if (hist[k][i] > peak) { peak = hist[k][i]; peakAt = k; }
      var drop = peak - r2.total;
      if (drop >= 1000 && (!fall || drop > fall.drop)) fall = { i: i, peak: peak, final: r2.total, drop: drop, round: Math.floor(peakAt / n) + 1 };
    }
    out.roi = roi; out.perShare = pps; out.spender = spender; out.merger = merger; out.founder = founder;
    out.payout = payout; out.bonusKing = bonusKing; out.fall = fall;
    return out;
  }

  // ---- action application ----
  function fail(msg) { return { ok: false, error: msg }; }

  function apply(state, action, by) {
    var s = clone(state);
    if (s.phase === 'over') return fail('The game is over.');
    var a = action || {}, actor = actorOf(s), pl, i;
    if (a.type === 'toBot') {
      if (typeof a.index !== 'number' || !s.players[a.index]) return fail('No such player.');
      s.players[a.index].bot = true;
      addLog(s, s.players[a.index].name + ' is now played by the AI.');
      s.rev++;
      return { ok: true, state: s };
    }
    if (a.type === 'cancelOffer') {
      if (!s.offer || by !== s.offer.from) return fail('There is no offer to cancel.');
      addLog(s, s.players[s.offer.from].name + ' withdraws the offer to ' + s.players[s.offer.to].name + '.');
      s.offer = null; s.rev++;
      return { ok: true, state: s };
    }
    if (by !== actor) return fail(s.offer ? 'Answer the offer first.' : 'It is not your turn.');
    if (a.type === 'offer') {
      if (!(s.rules && s.rules.offers)) return fail('Share offers are switched off.');
      if (s.offer || (s.phase !== 'place' && s.phase !== 'buy')) return fail('You cannot make an offer now.');
      if (s.oc >= 3) return fail('You can make up to 3 offers per turn.');
      var tp = s.players[a.to], oc = a.chain, oq = a.qty | 0, oa = +a.amt;
      if (!tp || a.to === actor) return fail('Pick another player.');
      if (!(oc >= 1 && oc <= 7) || sizes(s.board)[oc] < 2) return fail('That company is not on the board.');
      if (oq < 1 || oq > SHARES) return fail('Pick a number of shares.');
      var worth = price(oc, sizes(s.board)[oc]) * oq;
      if (!(oa >= worth + 100) || oa % 100 !== 0) return fail('Offer more than the market value of ' + money(worth) + '.');
      if (oa > s.players[actor].cash) return fail('You do not have that much cash.');
      s.oc++;
      if (tp.stocks[oc] < oq) {
        if (s.hide && s.hide.shares) { addLog(s, s.players[actor].name + ' offers ' + tp.name + ' a deal for ' + CHAINS[oc].name + ' shares. Declined.'); s.rev++; return { ok: true, state: s }; }
        return fail(tp.name + ' does not have that many ' + CHAINS[oc].name + ' shares.');
      }
      s.offer = { from: actor, to: a.to, chain: oc, qty: oq, amt: oa };
      addLog(s, s.players[actor].name + ' offers ' + tp.name + ' ' + money(oa) + ' for ' + oq + ' ' + CHAINS[oc].name + ' share' + (oq > 1 ? 's' : '') + '.');
      s.rev++;
      return { ok: true, state: s };
    }
    if (a.type === 'respond') {
      if (!s.offer) return fail('No offer to answer.');
      var of = s.offer, buyer = s.players[of.from], seller = s.players[of.to];
      s.offer = null;
      if (a.accept && seller.stocks[of.chain] >= of.qty && buyer.cash >= of.amt && sizes(s.board)[of.chain] >= 2) {
        seller.stocks[of.chain] -= of.qty; buyer.stocks[of.chain] += of.qty;
        seller.cash += of.amt; buyer.cash -= of.amt;
        addLog(s, seller.name + ' accepts and sells ' + of.qty + ' ' + CHAINS[of.chain].name + ' share' + (of.qty > 1 ? 's' : '') + ' to ' + buyer.name + ' for ' + money(of.amt) + '.');
      } else {
        addLog(s, seller.name + ' declines the offer from ' + buyer.name + '.');
      }
      s.rev++;
      return { ok: true, state: s };
    }
    pl = s.players[actor];

    switch (a.type) {
      case 'place': {
        if (s.phase !== 'place') return fail('You cannot place a tile now.');
        if (pl.hand.indexOf(a.t) < 0) return fail('That tile is not in your hand.');
        s.mnote = null;
        var an = analyze(s.board, a.t);
        if (an.kind === 'dead' || an.kind === 'blocked') return fail(an.reason);
        pl.hand.splice(pl.hand.indexOf(a.t), 1);
        s.last = a.t;
        var lab = tileLabel(a.t);
        if (an.kind === 'alone') {
          s.board[a.t] = 0; addLog(s, pl.name + ' places ' + lab + '.'); s.phase = 'buy';
        } else if (an.kind === 'found') {
          s.board[a.t] = 0; addLog(s, pl.name + ' places ' + lab + ' and can found a company.');
          s.pend = { kind: 'found', tile: a.t }; s.phase = 'found';
        } else if (an.kind === 'grow') {
          s.board[a.t] = an.chain;
          var got = absorb(s.board, a.t, an.chain);
          addLog(s, pl.name + ' places ' + lab + ', growing ' + CHAINS[an.chain].name + (got ? ' by ' + (got + 1) + ' tiles.' : '.'));
          s.phase = 'buy';
        } else if (an.kind === 'merge') {
          s.board[a.t] = 0;
          addLog(s, pl.name + ' places ' + lab + ' and triggers a merger.');
          mergeBegin(s, a.t, an.chains);
        }
        break;
      }
      case 'found': {
        if (s.phase !== 'found') return fail('Nothing to found right now.');
        var cid = a.chain;
        if (!(cid >= 1 && cid <= 7) || sizes(s.board)[cid] > 0) return fail('That company is already on the board.');
        s.board[s.pend.tile] = cid;
        var n = absorb(s.board, s.pend.tile, cid) + 1;
        pl.st.founded++;
        var free = bankLeft(s, cid) > 0;
        if (free) pl.stocks[cid]++;
        s.founder[cid] = actor;
        addLog(s, pl.name + ' founds ' + CHAINS[cid].name + ' (' + n + ' tiles)' + (free ? ' and gets a free share.' : ', but no shares are left for the founder bonus.'));
        s.pend = null; s.phase = 'buy';
        break;
      }
      case 'pickSurvivor': {
        if (s.phase !== 'mergePick' || s.pend.options.indexOf(a.chain) < 0) return fail('Pick one of the tied companies.');
        s.pend.survivor = a.chain; s.pend.options = [];
        mergeStart(s);
        break;
      }
      case 'pickOrder': {
        if (s.phase !== 'mergeOrder' || s.pend.options.indexOf(a.chain) < 0) return fail('Pick one of the tied companies.');
        s.pend.options = [];
        mergeDefunct(s, a.chain);
        break;
      }
      case 'dispose': {
        if (s.phase !== 'dispose') return fail('No shares to deal with right now.');
        var p = s.pend, c = p.cur, held = pl.stocks[c];
        var sell = a.sell | 0, trade = a.trade | 0;
        if (sell < 0 || trade < 0 || sell !== a.sell || trade !== a.trade) return fail('Invalid amounts.');
        if (trade % 2) return fail('Trade in pairs: 2 shares for 1.');
        if (sell + trade > held) return fail('You do not hold that many shares.');
        if (trade / 2 > bankLeft(s, p.survivor)) return fail('Not enough ' + CHAINS[p.survivor].name + ' shares left in the bank.');
        pl.cash += sell * p.price;
        pl.st.proceeds += sell * p.price;
        pl.stocks[c] -= sell + trade;
        pl.stocks[p.survivor] += trade / 2;
        var parts = [];
        if (sell) parts.push('sells ' + sell + ' for ' + money(sell * p.price));
        if (trade) parts.push('trades ' + trade + ' for ' + (trade / 2) + ' ' + CHAINS[p.survivor].name);
        var keep = held - sell - trade;
        if (keep) parts.push('keeps ' + keep);
        addLog(s, pl.name + (s.hide && s.hide.shares ? ' settles their ' + CHAINS[c].name + ' shares.' : ' ' + parts.join(', ') + ' (' + CHAINS[c].name + ').'));
        p.queue.shift();
        mergeDispose(s);
        break;
      }
      case 'declareEnd': {
        if (s.phase !== 'place') return fail('You can only end the game at the start of your turn or when buying.');
        if (!endCondition(s)) return fail('The game cannot end yet.');
        addLog(s, pl.name + ' declares the game over.');
        finalize(s, pl.name + ' ended the game.');
        break;
      }
      case 'buy': {
        if (s.phase !== 'buy') return fail('You cannot buy shares now.');
        var buys = a.buys || {}, total = 0, cost = 0, sz = sizes(s.board), ids = Object.keys(buys);
        for (i = 0; i < ids.length; i++) {
          var id = +ids[i], q = buys[ids[i]];
          if (!q) continue;
          if (!(id >= 1 && id <= 7) || q !== (q | 0) || q < 0) return fail('Invalid purchase.');
          if (sz[id] < 1) return fail(CHAINS[id].name + ' is not on the board.');
          if (q > bankLeft(s, id)) return fail('Not enough ' + CHAINS[id].name + ' shares left.');
          total += q; cost += q * price(id, sz[id]);
        }
        if (total > 3) return fail('You can buy at most 3 shares per turn.');
        if (cost > pl.cash) return fail('You cannot afford that.');
        var bought = [];
        for (i = 0; i < ids.length; i++) {
          var id2 = +ids[i], q2 = buys[ids[i]];
          if (!q2) continue;
          pl.stocks[id2] += q2;
          bought.push(q2 + ' ' + CHAINS[id2].name);
        }
        pl.cash -= cost;
        pl.st.spent += cost; pl.st.bought += total;
        if (bought.length) addLog(s, pl.name + (s.hide && s.hide.shares ? ' buys shares.' : ' buys ' + bought.join(', ') + ' for ' + money(cost) + '.'));
        if (a.end) {
          if (!endCondition(s)) return fail('The game cannot end yet.');
          addLog(s, pl.name + ' declares the game over.');
          finalize(s, pl.name + ' ended the game.');
        } else endTurn(s);
        break;
      }
      default: return fail('Unknown action.');
    }
    s.rev++;
    return { ok: true, state: s };
  }

  // ---- bot ----
  function leader(s, i) {
    var r = projected(s), me = r[i].total, best = -1;
    r.forEach(function (x, k) { if (k !== i && x.total > best) best = x.total; });
    return me > best;
  }
  function scoreTile(s, i, t, rng) {
    var an = analyze(s.board, t), sz = sizes(s.board), me = s.players[i], sc = 0, others = [], k;
    for (k = 0; k < s.players.length; k++) if (k !== i) others.push(s.players[k]);
    if (an.kind === 'found') sc = 260 + (me.cash > 600 ? 40 : 0);
    else if (an.kind === 'grow') {
      var c = an.chain, extra = floodCount(s.board, t), before = sz[c], after = before + 1 + extra;
      var dp = price(c, after) - price(c, before);
      var maxO = Math.max.apply(null, others.map(function (o) { return o.stocks[c]; }));
      sc = me.stocks[c] * dp * 0.8 - maxO * dp * 0.25 + (me.stocks[c] ? 20 : 0);
      if (after >= 11 && before < 11) sc += me.stocks[c] * 60;
    } else if (an.kind === 'merge') {
      var max = Math.max.apply(null, an.chains.map(function (x) { return sz[x]; }));
      var surv = an.chains.filter(function (x) { return sz[x] === max; })
        .sort(function (a, b) { return me.stocks[b] - me.stocks[a]; })[0];
      an.chains.forEach(function (x) {
        if (x === surv) return;
        var bs = computeBonuses(s, x, price(x, sz[x])), mine = 0, opp = 0;
        bs.forEach(function (b) { if (b.i === i) mine += b.amt; else opp += b.amt; });
        sc += mine - 0.5 * opp / Math.max(1, others.length - 1);
        sc += me.stocks[x] * price(x, sz[x]) * 0.1;
      });
      sc += me.stocks[surv] * 80;
    }
    var pers = me.pers || 'balanced', lvl = me.lvl || 'normal';
    if (an.kind === 'merge') { if (pers === 'cautious') sc = sc * 0.7 - 40; else if (pers === 'ruthless') sc = sc * 1.4 + 60; }
    else if (an.kind === 'found' && pers === 'ruthless') sc += 80;
    var noise = lvl === 'easy' ? 110 : lvl === 'hard' ? 12 : 45;
    if (pers === 'chaotic') noise = Math.max(noise, 220);
    return sc + rng() * noise;
  }
  function stake(s, i, c) { return s.players[i].stocks[c]; }

  function botAction(s, rng) {
    rng = rng || Math.random;
    var i = actorOf(s), me = s.players[i], sz = sizes(s.board), k;
    var P = me.pers || 'balanced', L = me.lvl || 'normal';
    if (s.offer) {
      var of = s.offer, worthB = price(of.chain, sz[of.chain] || 2) * of.qty;
      var P0 = me.pers || 'balanced', L0 = me.lvl || 'normal', need = 1.25 + rng() * 0.4;
      if (P0 === 'cautious') need = 1.15 + rng() * 0.2; else if (P0 === 'ruthless') need = 1.8 + rng() * 0.6;
      if (L0 === 'easy') need = 1.1 + rng() * 0.15; else if (L0 === 'hard') need += 0.3;
      var yes = of.amt >= worthB * need && me.stocks[of.chain] >= of.qty;
      if (P0 === 'chaotic') yes = me.stocks[of.chain] >= of.qty && rng() < 0.5;
      return { type: 'respond', accept: yes };
    }
    switch (s.phase) {
      case 'place': {
        if (!NOEND && endCondition(s) && (leader(s, i) || (P === 'chaotic' && rng() < 0.25))) return { type: 'declareEnd' };
        var best = null, bs = -1e9;
        var playable = me.hand.filter(function (t) { return isPlayable(s.board, t); });
        if (playable.length && ((L === 'easy' && rng() < 0.35) || (P === 'chaotic' && rng() < 0.3))) return { type: 'place', t: playable[Math.floor(rng() * playable.length)] };
        me.hand.forEach(function (t) {
          if (!isPlayable(s.board, t)) return;
          var sc = scoreTile(s, i, t, rng);
          if (sc > bs) { bs = sc; best = t; }
        });
        return { type: 'place', t: best };
      }
      case 'found': {
        var free = [];
        for (var c = 1; c <= 7; c++) if (sz[c] === 0) free.push(c);
        free.sort(function (a, b) { return (CHAINS[b].tier - CHAINS[a].tier) + (rng() - 0.5) * (P === 'chaotic' ? 20 : L === 'easy' ? 6 : 1.5); });
        return { type: 'found', chain: free[0] };
      }
      case 'mergePick':
      case 'mergeOrder': {
        var opts = s.pend.options.slice();
        opts.sort(function (a, b) { return stake(s, i, b) - stake(s, i, a) + (rng() - 0.5) * 0.5; });
        return { type: s.phase === 'mergePick' ? 'pickSurvivor' : 'pickOrder', chain: opts[0] };
      }
      case 'dispose': {
        var p = s.pend, cc = p.cur, held = me.stocks[cc];
        var total = 1, ch;
        for (ch = 0; ch < p.chains.length; ch++) total += p.sz[p.chains[ch]];
        var survPrice = price(p.survivor, total + floodCount(s.board, p.tile));
        var canTrade = Math.min(Math.floor(held / 2) * 2, bankLeft(s, p.survivor) * 2);
        var trade = 0;
        if (total >= 11 || (me.stocks[p.survivor] > 0 && survPrice >= p.price * 1.5)) trade = canTrade;
        if (P === 'ruthless' && me.stocks[p.survivor] > 0) trade = canTrade;
        if (P === 'chaotic') trade = Math.min(canTrade, 2 * Math.floor(rng() * (canTrade / 2 + 1)));

        var rest = held - trade, sell;
        if (me.cash < 3500 || rest <= 1 || total >= 25) sell = rest;
        else sell = Math.floor(rest / 2);
        if (P === 'cautious') sell = rest;
        else if (P === 'ruthless') sell = Math.floor(rest / 3);
        else if (P === 'chaotic') sell = Math.floor(rng() * (rest + 1));
        return { type: 'dispose', sell: sell, trade: trade };
      }
      case 'buy': {
        var buys = {}, cash = me.cash, n = 0;
        var maxBuy = 3, reserve = 0, wPot = 100, wMaj = 40, noiseB = 20;
        if (P === 'cautious') { maxBuy = 3; reserve = 1500; }
        else if (P === 'ruthless') { wMaj = 90; wPot = 110; }
        if (L === 'easy') { maxBuy = 2; noiseB = 60; }
        else if (L === 'hard') { wPot = 220; wMaj = 10; noiseB = 6; }
        if (P === 'chaotic' && rng() < 0.1) maxBuy = 0;
        var left = {};
        for (k = 1; k <= 7; k++) left[k] = bankLeft(s, k);
        var mine = me.stocks.slice();
        while (n < maxBuy) {
          var pick = 0, ps = -1e9;
          for (k = 1; k <= 7; k++) {
            if (sz[k] < 2 || left[k] < 1) continue;
            var pr = price(k, sz[k]);
            if (pr > cash || cash - pr < reserve) continue;
            var maxO = 0;
            for (var o = 0; o < s.players.length; o++) if (o !== i) maxO = Math.max(maxO, s.players[o].stocks[k]);
            var potential = (price(k, sz[k] + 6) - pr) / pr;
            var sc = potential * wPot + (mine[k] + 1 > maxO ? wMaj : 0) + (mine[k] > 0 ? 15 : 0) + (sz[k] >= 41 ? -80 : 0) + rng() * noiseB;
            if (P === 'cautious' && sz[k] >= 8) sc += 50;
            if (P === 'chaotic') sc = rng() * 100;
            if (sc > ps) { ps = sc; pick = k; }
          }
          if (!pick) break;
          buys[pick] = (buys[pick] || 0) + 1;
          cash -= price(pick, sz[pick]); left[pick]--; mine[pick]++; n++;
          if (cash < 300) break;
        }
        var a = { type: 'buy', buys: buys };
        if (!NOEND && endCondition(s) && (leader(s, i) || (P === 'chaotic' && rng() < 0.25))) a.end = true;
        return a;
      }
    }
    return null;
  }

  function previewMerge(s, t, idx) {
    var an = analyze(s.board, t);
    if (an.kind !== 'merge') return null;
    var sz = sizes(s.board), max = Math.max.apply(null, an.chains.map(function (c) { return sz[c]; }));
    var tied = an.chains.filter(function (c) { return sz[c] === max; }), rows = [];
    an.chains.forEach(function (c) {
      if (tied.length === 1 && c === tied[0]) return;
      var pr = price(c, sz[c]), mine = null;
      computeBonuses(s, c, pr).forEach(function (b) { if (b.i === idx) mine = b; });
      var fb = (s.rules && s.rules.founders && s.founder && s.founder[c] === idx) ? 3 * pr : 0;
      rows.push({ chain: c, size: sz[c], price: pr, held: s.players[idx].stocks[c], amt: mine ? mine.amt : 0, kind: mine ? mine.kind : '', place: mine ? mine.place : 0, founder: fb });
    });
    return { tie: tied.length > 1, survivors: tied, rows: rows };
  }
  function perPlayer(s) {
    var n = s.players.length, res = s.over.results, hist = s.hist, from = Math.min(hist.length - 1, 2 * n), out = [], i, k;
    var best = Math.max.apply(null, res.map(function (r) { return r.total; }));
    var others = res.filter(function (r) { return r.total !== best; }).map(function (r) { return r.total; });
    var margin = others.length ? best - Math.max.apply(null, others) : 0;
    for (i = 0; i < n; i++) {
      var fr = rankIn(hist[hist.length - 1], i), worst = 1, wAt = 0, wDef = 0;
      for (k = from; k < hist.length - 1; k++) {
        var r = rankIn(hist[k], i), lead = Math.max.apply(null, hist[k]), def = lead - hist[k][i];
        if (r > worst || (r === worst && def > wDef)) { worst = r; wAt = k; wDef = def; }
      }
      var gain = worst - fr, st = s.players[i].st;
      var rank = 1 + res.filter(function (x) { return x.total > res[i].total; }).length;
      out.push({ i: i, name: s.players[i].name, bot: !!s.players[i].bot, total: res[i].total, rank: rank, winner: res[i].total === best,
        margin: res[i].total === best ? margin : 0, payout: st.best.amt, payoutChain: st.best.chain,
        comeback: gain > 0 ? { from: worst, to: fr, gain: gain, deficit: wDef, round: Math.floor(wAt / n) + 1 } : null });
    }
    return out;
  }

  var NOEND = false;
  function autoPlay(s, rng) {
    var a = actorOf(s);
    if (a < 0) return null;
    NOEND = true;
    var act; try { act = botAction(s, rng || Math.random); } finally { NOEND = false; }
    if (act.type === 'declareEnd') return null;
    if (act.type === 'buy') act.end = false;
    var r = apply(s, act, a);
    if (!r.ok) return null;
    addLog(r.state, r.state.players[a].name + ' ran out of time, so the game played for them.');
    return r.state;
  }

  root.AcquireEngine = {
    autoPlay: autoPlay,
    previewMerge: previewMerge, perPlayer: perPlayer,
    COLS: COLS, ROWS: ROWS, N: N, HAND: HAND, SHARES: SHARES, CHAINS: CHAINS,
    tileLabel: tileLabel, nbrs: nbrs, sizes: sizes, activeIds: activeIds, price: price,
    bankLeft: bankLeft, analyze: analyze, isPlayable: isPlayable, endCondition: endCondition,
    computeBonuses: computeBonuses, newGame: newGame, apply: apply, actorOf: actorOf,
    botAction: botAction, projected: projected, netWorths: netWorths, computeStats: computeStats, floodCount: floodCount, money: money, clone: clone
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.AcquireEngine;
})(typeof window !== 'undefined' ? window : globalThis);
