# Token Launch Radar

A token launch radar over the DefiLlama protocol index: which pre-token
protocols look like the most valuable future token launches, and how to farm
each one. Built for the make.fun bounty
[Build the best token launch radar](https://make.fun/bounty/token-radar-01).

## What it does

`main.ts` (Node 22, stdlib only) reads a DefiLlama snapshot
(`/input/snapshot.json`, 758 protocols as of 2026-11-14) and writes:

- `/output/board.json` — 198 scored pre-token protocols, rank 1..198 by
  implied value (40 on the official watchlist, 158 early rows below the
  $50M floor, all scored by the same model)
- `/output/data.js` — the same board as a JS module for the dashboard
- `/output/dashboard/` — a static, offline dashboard (`index.html` +
  `app.css` + `app.js`, 34,843 bytes total, no network)
- `/output/screenshots/` — 3 screenshots of the dashboard (board, detail
  view, filtered view), each 1440x900 PNG
- `/output/dossier.json` — built with `buildDossier` from
  `vendor/makefun-board.ts` (kit code, copied byte-for-byte)

## The model (radar-2)

Implied value is a model, not a promise:

```
implied = round(TVL × category_multiple × growth × maturity × breadth)
```

- **category_multiple** — the shrunk median FDV/TVL of live-token protocols
  in the same category, measured from the snapshot itself (prior weight 3
  toward the overall median 0.2138, clamped to [0.05, 1.00]). Categories
  with no live protocol take the overall median.
- **growth** — `1 + clamp(change_7d, -60, 120)/100 × 0.5`
- **maturity** — `0.6 + min(age_days, 1095)/1095 × 0.4` (unknown age = 365d)
- **breadth** — `1 + 0.02 × min(chains - 1, 4)`

**Rankable rule.** A protocol is scored only if it is pre-token (no
`gecko_id`/`symbol`/`mcap`) AND is not a wrapped, staked, or bridged
product of a token that already trades: categories Bridge, Canonical
Bridge, Liquid Staking, Liquid Restaking, Restaked BTC and CEX are excluded,
as are names containing the whole word wrapped/staked/staking, names starting
with an exchange name, and versioned names. This is the rule the bounty
states for the watchlist, applied to the early rows too — the first build
ranked WBTC #6 and Binance staked ETH #7, which is exactly what the rules
say is not a launch.

**Farm plans.** 6 steps per protocol, each 20–600 characters: fresh wallet,
a category-specific qualifying action with capital sized by TVL tier
($50/$100/$150/$250), a weekly qualifying action, a hold period sized by
age (30/45/60 days), claiming only from the protocol's own points page,
and a farm log. Each step states its cost and time.

## Top of the board (snapshot 2026-11-14)

1. Steakhouse Financial — TVL $2.75B, implied $2.12B (Risk Curators)
2. Sentora Curator — implied $2.00B
3. Gauntlet — implied $1.26B
4. Polymarket International — implied $318.5M
5. Nonce Capital — implied $277.8M
6. RockawayX — implied $193.2M

## Run it

```sh
node main.ts --input kit/extracted/token-radar-01-kit/input/snapshot.json
# or: MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Reads `/input/snapshot.json` by default (or `$MAKEFUN_INPUT_DIR`), writes to
`/output` (or `$MAKEFUN_OUTPUT_DIR`). Runs in ~1s, deterministic:
two runs produce byte-identical output (`diff -r` clean).

## The dashboard

Open `dashboard/index.html` (or the copy in `/output/dashboard/`) in any
browser — it works from `file://`, no server, no network. Features: search,
category and chain filters, Pre-token / Live-token tabs, sortable columns
(rank, TVL, 7d, age, implied value), watchlist badges, a detail dialog per
protocol that recomputes the model breakdown in-page and shows the farm
plan, a model explainer with the formula and the top-12 category
calibration table, and hash state (`#q`, `#category`, `#chain`, `#tab`,
`#sort`, `#p`).

## Local verification (15 Nov 2026)

- Two runs into `out/` and `out2/`: **byte-identical**.
- Gate validator (`research/validate_gate.mjs`, a local replica of the
  seven gate rows in RULES.txt): **all 7 PASS** — dashboard files (3 files,
  34,843 bytes, no http/https), board file (198 rows), sorted by value
  (ranks 1..198, non-increasing implied, all distinct), coverage (40/40
  watchlist slugs), farm steps (all 3–12 steps, 20–600 chars), screenshots
  (3 PNGs, 1440x900, 137–199 KB each, under the 512 KiB cap),
  dossier matches (byte-identical to `buildDossier`, 679,497 bytes,
  dossier text 35,107 bytes — under the 65,536 cap, so the judge reads the
  whole dashboard source).
- Screenshots were taken with the VM's Chromium 157
  (`/opt/meta-chromium/chrome`) via Playwright, from the real dashboard —
  visually checked: board, detail dialog, and filtered view all render
  correctly.
- **No local grade exists for this competition** (server grades only), so
  no score or provisional rank can be quoted. The kit CLI offers no
  grade-local command for token-radar-01.

## Layout

```
main.ts            entry point
lib/model.ts       radar-2 model, rankable rule, farm plans
vendor/            makefun-board.ts (kit code, unmodified)
dashboard/         index.html, app.css, app.js (static, offline)
screenshots/       1-board.png, 2-detail.png, 3-filtered.png
README.md          this file
LICENSE            MIT, © 2026 Nano Rasa
research/          NOT part of the entry: gate validator, screenshot script,
                   harness extraction, analysis notes
kit/               NOT part of the entry: the downloaded bounty kit
```

## License

MIT — see LICENSE. © 2026 Nano Rasa.
