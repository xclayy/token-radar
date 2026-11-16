// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds every
// other rankable pre-token protocol below the floor: the early rows the radar exists to find. A
// protocol is pre-token when its index entry records no token (no market cap, no CoinGecko id, no
// symbol); the snapshot's live-token protocols are kept apart and shown as the market's own values,
// never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures, and no protocol name is ever
// special-cased: the same function scores every row.
//
//   category multiple = the shrunk median market-cap/TVL of the live-token protocols in the same
//                       category, measured from this snapshot. The snapshot carries market caps, not
//                       fully diluted values, so the ratio is named for what it is. Two hardenings
//                       over radar-2: each live protocol's ratio is winsorised at x5 before any
//                       median is taken (one tiny protocol must not set a 400x median — radar-2's
//                       Prediction Market median was 400.2x from a single protocol, Rain), and the
//                       overall median that shrinks every category is taken over a clean prior pool
//                       only — CEX, bridge and liquid-staking receipts are left out, because their
//                       ratios reflect custody and staking mechanics, not app-token value. Shrinkage
//                       is stronger (prior weight 3 -> 5): with one live protocol a category's
//                       multiple is now 1/6 its own median and 5/6 the prior. The Risk Curators
//                       multiple falls from 0.904 to 0.696 — it rested on one live protocol, Api3
//                       (an oracle, not a vault curator), and there is no true curator comp in the
//                       snapshot (Morpho Blue is pre-token). (clamped to [0.05, 1.00]; a category
//                       with no live protocol takes the overall median.)
//   base       = tvl_usd x category_multiple
//   growth     = clamp(change_7d, -60, 120) per cent
//   growthMult = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity   = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//   breadth    = 1 + 0.02 x min(chains - 1, 4)            (more chains, wider distribution)
//   implied    = max(1, round(base x growthMult x maturity x breadth))
//
// Farm plans are derived per protocol from its category (a playbook table below, duplicated in
// dashboard/app.js so the detail view recomputes the same plan the board carries): a fresh-wallet
// step with gas sized by the main chain, a category-specific qualifying action with capital sized by
// TVL tier, a category-specific weekly action, a hold period sized by age, claiming only from the
// protocol's own points page, a repeat on a second chain for multi-chain protocols, and a farm log.
//
// The constants are stated in the dashboard and changeable in the model sandbox.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  winsor_cap: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  prior_weight: number;
  multiple_floor: number;
  multiple_cap: number;
  breadth_per_chain: number;
  breadth_max_extra: number;
}

export const MODEL: ModelConstants = {
  winsor_cap: 5,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  prior_weight: 5,
  multiple_floor: 0.05,
  multiple_cap: 1.0,
  breadth_per_chain: 0.02,
  breadth_max_extra: 4,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of the category calibration: the multiple the model used, and how it was measured. */
export interface CalibrationRow {
  category: string;
  live_count: number;
  median_mcaptvl: number | null;
  multiple: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  watchlist: boolean;
  category_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  /** The overall median the multiples shrink toward, so the dashboard can print it exactly. */
  overall_multiple: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  calibration: CalibrationRow[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a sorted array of numbers. */
function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The category calibration, measured from this snapshot alone: for every category, the median
 * market-cap/TVL of its live-token protocols, shrunk toward the overall median with a prior weight,
 * so a category with one or two live protocols cannot set an extreme multiple. Each ratio is
 * winsorised at the model's cap before any median is taken, and the overall median comes from a clean
 * prior pool that leaves out CEX, bridge and liquid-staking receipts (their ratios reflect custody and
 * staking mechanics, not app-token value). Categories with no live protocol take the overall median.
 * Every multiple is clamped to the model's floor and cap, and rounded to four decimals so the
 * dashboard can print it exactly.
 */
// The same categories the board refuses to rank (a wrapped, staked or bridged product of a token that
// already trades) are left out of the prior pool: their ratios are not what a new launch looks like.
const PRIOR_POOL_EXCLUDE = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

export function calibrate(snapshot: Snapshot, model: ModelConstants = MODEL): { byCategory: Map<string, number>; rows: CalibrationRow[]; overall: number } {
  // A market cap of zero is no market cap at all: only a positive one counts as a live token.
  const live = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const ratio = (p: SnapshotProtocol): number => Math.min(p.mcap_usd! / p.tvl_usd, model.winsor_cap);
  const priorPool = live
    .filter((p) => p.category === null || !PRIOR_POOL_EXCLUDE.has(p.category))
    .map(ratio)
    .sort((a, b) => a - b);
  const overall = median(priorPool);
  const byCat = new Map<string, number[]>();
  for (const p of live) {
    const key = p.category ?? 'Other';
    const arr = byCat.get(key);
    if (arr) arr.push(ratio(p));
    else byCat.set(key, [ratio(p)]);
  }
  const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
  const multipleFor = (category: string | null): number => {
    const vals = byCat.get(category ?? 'Other');
    if (!vals || vals.length === 0) return round4(clamp(overall, model.multiple_floor, model.multiple_cap));
    const med = median([...vals].sort((a, b) => a - b));
    const shrunk = (vals.length * med + model.prior_weight * overall) / (vals.length + model.prior_weight);
    return round4(clamp(shrunk, model.multiple_floor, model.multiple_cap));
  };
  const byCategory = new Map<string, number>();
  const rows: CalibrationRow[] = [];
  const categories = new Set<string>();
  for (const p of snapshot.protocols) categories.add(p.category ?? 'Other');
  for (const cat of [...categories].sort()) {
    const vals = byCat.get(cat);
    const med = vals && vals.length > 0 ? median([...vals].sort((a, b) => a - b)) : null;
    const multiple = multipleFor(cat === 'Other' ? null : cat);
    byCategory.set(cat, multiple);
    rows.push({ category: cat, live_count: vals ? vals.length : 0, median_mcaptvl: med === null ? null : round4(med), multiple });
  }
  rows.sort((a, b) => b.multiple - a.multiple || (a.category < b.category ? -1 : 1));
  return { byCategory, rows, overall };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  categoryMultiple: number,
): { implied: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_extra);
  const breadthMult = 1 + extraChains * model.breadth_per_chain;
  const base = protocol.tvl_usd * categoryMultiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * breadthMult));
  return { implied, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * The house watchlist's own exclusion, applied to the whole board: a wrapped, staked or bridged
 * product of a protocol whose token already trades is not a token still to come, so it is never
 * ranked — WBTC, Binance staked ETH and USDT0 are the examples the rules name. The check uses only
 * the snapshot's ten fields: the category, and the name's words and prefix.
 */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

export function isWrappedProduct(p: SnapshotProtocol): boolean {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return true;
  if (WRAPPED_WORD.test(p.name)) return true;
  if (EXCHANGE_PREFIX.test(p.name)) return true;
  return false;
}

/** Whether a protocol is one the board may rank: pre-token, not a wrapped/staked/bridged product of a token that trades, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !isWrappedProduct(p) && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const watch = new Set(snapshot.watchlist);
  const calibration = calibrate(snapshot, model);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, below the floor or above it, by the
  // same rule. Never a replacement for a watchlist row: a chosen protocol stays chosen.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
  const scored = [...chosen.values()].map((p) => {
    const catMult = calibration.byCategory.get(p.category ?? 'Other') ?? calibration.overall;
    const v = impliedValue(p, snapshot.as_of, model, catMult);
    return { p, catMult, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    watchlist: watch.has(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_multiple: round4(s.catMult),
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** One playbook row: what a farmer does in a protocol of this kind. */
export interface FarmPlay {
  /** The main qualifying position. */
  action: string;
  /** The recurring qualifying action, repeated weekly, using only the funded capital. */
  weekly: string;
  /** What to claim, and where. */
  claim: string;
}

/**
 * The farm playbook, one row per kind of protocol. The dashboard duplicates this table
 * (dashboard/app.js) so the detail view recomputes the same plan the board carries; the two copies
 * must stay identical. Keys are matched as substrings of the lowercase category, in order, first
 * match wins — 'index' is checked before 'dex' because "Indexes" contains "dex", 'liquidity manager'
 * before 'chain' because no earlier key may claim it, and 'farm' after 'leveraged farm' because
 * "Leveraged Farming" contains "farm". Every category on the board has its own row: no protocol
 * falls back to the generic plan.
 */
function farmPlaybook(p: SnapshotProtocol, capital: number, chain: string): FarmPlay {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const art = /^[aeiou]/i.test(name) ? 'an' : 'a';
  if (c.includes('index')) return {
    action: `Buy $${capital} of the ${name} index on ${chain} and hold it.`,
    weekly: `Rebalance a small amount into the index.`,
    claim: `Claim index rewards from ${name}\u2019s own page, only from the link it publishes.` };
  if (c.includes('curator') || c.includes('allocator')) return {
    action: `Deposit $${capital} into ${art} ${name} vault on ${chain} and keep the shares for the whole season.`,
    weekly: `Move a small amount between two of ${name}\u2019s vaults, or claim and restake the vault rewards.`,
    claim: `Claim vault rewards from ${name}\u2019s own page, only from the link it publishes.` };
  if (c.includes('basis trading')) return {
    action: `Deposit $${capital} of USDC into ${name}\u2019s basis strategy on ${chain} and keep the position open.`,
    weekly: `Check the funding rate and roll a small part of the basis position.`,
    claim: `Claim basis yield from ${name}\u2019s own page, only from the link it publishes.` };
  if (c.includes('rwa')) return {
    action: `Mint $${capital} of the protocol\u2019s tokenised yield asset through ${name} on ${chain} and hold it.`,
    weekly: `Check the yield accrual on the tokenised asset and claim any yield into the same position.`,
    claim: `Claim the accrued yield from ${name}\u2019s own page, only from the link it publishes.` };
  if (c.includes('lending') || c.includes('cdp') || c.includes('collateral')) return {
    action: `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`,
    weekly: `Borrow a small amount against the deposit and repay it, so the position shows both sides.`,
    claim: `Claim supply rewards from ${name}\u2019s own page, only from the link it publishes.` };
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return {
    action: `Provide $${capital} of liquidity to ${name}\u2019s main pool on ${chain} and keep the position open.`,
    weekly: `Swap a small amount through the pool and claim any liquidity rewards.`,
    claim: `Claim pool fees and rewards from ${name}\u2019s own page, only from the link it publishes.` };
  if (c.includes('liquidity manager')) return {
    action: `Deposit $${capital} into ${art} ${name} managed vault on ${chain} and keep the shares for the whole season.`,
    weekly: `Claim and restake a small amount of the vault rewards.`,
    claim: `Claim vault rewards from ${name}\u2019s own page, only from the link it publishes.` };
  if (c.includes('bridge')) return {
    action: `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`,
    weekly: `Bridge a small amount out and back through ${name}.`,
    claim: `Check ${name}\u2019s rewards page for bridge volume points, only from the link it publishes.` };
  if (c.includes('staking') || c.includes('restak')) return {
    action: `Stake $${capital} of the chain\u2019s staking asset through ${name} and keep the receipt token.`,
    weekly: `Restake the staking rewards into the same position.`,
    claim: `Claim staking rewards from ${name}\u2019s own page, only from the link it publishes.` };
  if (c.includes('perpetual') || c.includes('derivative')) return {
    action: `Deposit $${capital} of USDC as margin on ${name} and open one small hedged trade.`,
    weekly: `Open and close one small hedged trade on ${name}.`,
    claim: `Claim trading fee rebates from ${name}\u2019s own page, only from the link it publishes.` };
  if (c.includes('prediction')) return {
    action: `Fund $${capital} and place one market position on ${name}.`,
    weekly: `Place one small market position and let it settle.`,
    claim: `Claim market winnings and any points from ${name}\u2019s own page, only from the link it publishes.` };
  if (c.includes('stable')) return {
    action: `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`,
    weekly: `Mint or redeem a small amount of the stable asset through ${name}.`,
    claim: `Claim stability rewards from ${name}\u2019s own page, only from the link it publishes.` };
  if (c.includes('insurance')) return {
    action: `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`,
    weekly: `Review the cover and renew a small part of it.`,
    claim: `Claim cover rewards from ${name}\u2019s own page, only from the link it publishes.` };
  if (c.includes('payment')) return {
    action: `Route $${capital} of payments through ${name} on ${chain} and keep the account funded.`,
    weekly: `Route one payment through ${name}.`,
    claim: `Check ${name}\u2019s rewards page for payment volume points, only from the link it publishes.` };
  if (c.includes('governance')) return {
    action: `Lock $${capital} of voting power with ${name} on ${chain} and vote on one proposal.`,
    weekly: `Vote on one live proposal with ${name}.`,
    claim: `Claim voting rewards from ${name}\u2019s governance page, only from the link it publishes.` };
  if (c.includes('otc')) return {
    action: `Place $${capital} in an OTC order through ${name} on ${chain} and settle it.`,
    weekly: `Settle one small OTC order through ${name}.`,
    claim: `Check ${name}\u2019s rewards page for trading points, only from the link it publishes.` };
  if (c.includes('farm')) return {
    action: `Deposit $${capital} into ${name}\u2019s farm on ${chain} and keep the position open.`,
    weekly: `Harvest and restake a small amount of farm rewards.`,
    claim: `Claim farm rewards from ${name}\u2019s own page, only from the link it publishes.` };
  if (c.includes('anchor') || c.includes('decentralized btc')) return {
    action: `Mint $${capital} of the BTC-backed asset through ${name} on ${chain} and hold it.`,
    weekly: `Mint or redeem a small amount of the BTC-backed asset through ${name}.`,
    claim: `Claim mint rewards from ${name}\u2019s own page, only from the link it publishes.` };
  if (c.includes('cedefi')) return {
    action: `Deposit $${capital} into ${name}\u2019s vault on ${chain} and keep the position open.`,
    weekly: `Check the vault\u2019s yield and claim any rewards into the same position.`,
    claim: `Claim vault rewards from ${name}\u2019s own page, only from the link it publishes.` };
  if (c.includes('card')) return {
    action: `Fund $${capital} on the ${name} card on ${chain} and keep the balance active.`,
    weekly: `Spend a small amount through the ${name} card.`,
    claim: `Claim card rewards from ${name}\u2019s own page, only from the link it publishes.` };
  if (c.includes('chain')) return {
    action: `Bridge $${capital} to the chain and use ${name}\u2019s native app on ${chain} once a week.`,
    weekly: `Use ${name}\u2019s native app on ${chain} once.`,
    claim: `Check ${name}\u2019s rewards page for activity points, only from the link it publishes.` };
  return {
    action: `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`,
    weekly: `Make one qualifying on-chain action on ${name}, such as a deposit, a swap or a vote.`,
    claim: `Open ${name}\u2019s own points or rewards page and claim only from the link it publishes.` };
}

/** The gas a first transaction costs on the protocol's main chain: Ethereum is dear, the rest is not. */
function setupGas(chain: string): number {
  if (chain === 'Ethereum') return 8;
  if (chain === 'Bitcoin') return 2;
  return 4;
}

/**
 * A protocol's farm plan: six steps, seven when it runs on more than one chain. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names: a fresh wallet, the playbook's qualifying action with capital sized by TVL tier, the
 * playbook's weekly action, a hold period sized by age, the playbook's claim step, a repeat on a
 * second chain for multi-chain protocols, and a farm log naming the protocol.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const play = farmPlaybook(p, capital, chain);
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'nothing but the wallet',
      time: '5 minutes',
    },
    {
      text: play.action,
      cost: `$${capital} of capital and about $${setupGas(chain)} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: play.weekly,
      cost: 'no new capital',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: play.claim,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
  ];
  if (p.chains.length >= 2) {
    steps.push({
      text: `Repeat the position on ${p.chains[1]} with half the amount, so the activity is visible on more than one network.`,
      cost: `$${Math.round(capital / 2)} of capital and about $2 of gas`,
      time: '20 minutes',
    });
  }
  steps.push({
    text: `Write the wallet, the dates and every transaction for ${p.name} in a farm log, so you can repeat the position and prove it later.`,
    cost: 'nothing but the log',
    time: '5 minutes',
  });
  return steps;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    watchlist: row.watchlist,
    category_multiple: row.model.category_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const calibration = calibrate(snapshot, model);
  const early = board.filter((r) => !r.watchlist).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    overall_multiple: round4(calibration.overall),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    calibration: calibration.rows,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
