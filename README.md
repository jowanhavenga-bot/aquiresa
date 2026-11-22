# Acquire SA

A browser version of the classic tile-laying takeover board game, played with seven South African companies.
Found companies, grow them, hold the biggest stakes when they merge, and finish with the most cash.

## Ways to play

- **Solo against AI**: 1 to 5 computer opponents.
- **Pass and play**: 2 to 6 people on one phone, each with their own name. A cover screen hides each player's tiles while the phone changes hands. AI seats are optional.
- **Online rooms**: share a 5-letter code. This needs the Claude artifact runtime (shared database and sign-in), so it only works when the page is opened as a Claude artifact. On a plain host such as GitHub Pages, solo and pass and play work and online rooms are switched off.

## Rules in brief

- Each turn: play a tile, buy up to 3 shares, draw back to 6 tiles. Start with R6 000.
- A tile next to nothing sits there; next to a lone tile it founds a company (free share); next to a company it grows it; between companies it merges them.
- A company with 11+ tiles is safe. A tile that would join two safe companies is dead and is swapped.
- The biggest company survives a merger. The swallowed company pays bonuses, then shareholders sell, trade 2 for 1, or keep.
- **Tycoon mode** (default): the top 3 shareholders are paid 10x, 5x and 3x the share price on every merger and at the end. Players tied on shares pool the prizes for the places they share and split them (rounded up to R100); the next player takes the next place. **Classic mode** pays the top 2 (10x and 5x).
- The game can be ended once a company reaches 41 tiles or every company on the board is safe.
- At the end: a net worth graph for every player and a set of stats (comeback, best return on investment, biggest payout and more).

| Company | Colour | Tier |
| --- | --- | --- |
| Mr Price | orange | entry |
| Checkers | teal | entry |
| Takealot | blue | mid |
| MTN | yellow | mid |
| Nedbank | green | mid |
| Vodacom | red | premium |
| Woolworths | black | premium |

Market cap is the share price times the 25 shares in each company.

## Run it

Open `index.html` in a browser. To rebuild it after editing `src/`:

```
python3 build.py
```

## Tests

The rules engine (`src/engine.js`) is plain JavaScript with no dependencies:

```
node tests/test.js    # unit tests, tycoon tie cases, 750 simulated games with invariants
node tests/edge.js    # stalls, dead tiles, safe-company mergers
```

## Notes

An unofficial, non-commercial fan game based on the classic tile-and-stock board game. Company names are used as in-game labels only, with no logos, and are not affiliated with or endorsed by the companies.
