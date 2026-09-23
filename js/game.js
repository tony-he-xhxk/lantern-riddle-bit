/**
 * 抽题与结算相关的纯逻辑，不直接操作 DOM。
 */

import { groupByDifficulty } from './data.js';

export function shuffle(list, rng = Math.random) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export function sampleWithoutReplacement(list, count, rng = Math.random) {
  if (!Array.isArray(list) || list.length === 0 || count <= 0) return [];
  return shuffle(list, rng).slice(0, Math.min(count, list.length));
}

/** 优先避开上一局出现过的题目，题池不足时允许回退重复 */
function pickWithAvoid(pool, count, excludeIds, rng) {
  if (count <= 0) return [];
  const fresh = pool.filter((item) => !excludeIds.has(item.id));
  if (fresh.length >= count) return sampleWithoutReplacement(fresh, count, rng);
  const stale = pool.filter((item) => excludeIds.has(item.id));
  const result = sampleWithoutReplacement(fresh, fresh.length, rng);
  return result.concat(sampleWithoutReplacement(stale, count - result.length, rng));
}

/** 按比例把每局题量分给各难度，用最大余数法保证总和等于 roundSize */
export function allocateByRatio(roundSize, ratio, order) {
  const weights = order.map((id) => {
    const raw = Number(ratio && ratio[id]);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (roundSize <= 0 || total <= 0) return order.map(() => 0);

  const exact = weights.map((weight) => (roundSize * weight) / total);
  const counts = exact.map((value) => Math.floor(value));
  let remainder = roundSize - counts.reduce((sum, value) => sum + value, 0);

  const byFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  let cursor = 0;
  while (remainder > 0 && byFraction.length > 0) {
    counts[byFraction[cursor % byFraction.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  return counts;
}

/** 按题池容量把多出来的题量挪给还有余量的难度 */
function fitCountsToPools(counts, pools, order) {
  const fitted = counts.slice();
  let leftover = 0;

  fitted.forEach((count, index) => {
    const capacity = pools.get(order[index]).length;
    if (count > capacity) {
      leftover += count - capacity;
      fitted[index] = capacity;
    }
  });

  while (leftover > 0) {
    let moved = false;
    for (let i = 0; i < order.length && leftover > 0; i += 1) {
      const capacity = pools.get(order[i]).length;
      if (fitted[i] < capacity) {
        fitted[i] += 1;
        leftover -= 1;
        moved = true;
      }
    }
    if (!moved) break;
  }

  return fitted;
}

export function coefficientFor(config, difficultyId) {
  const mixed = config && config.round && config.round.mixedMode;
  if (mixed && difficultyId === mixed.id) return Number(mixed.coefficient) || 1;
  const found = ((config && config.difficulty) || []).find((item) => item.id === difficultyId);
  return found ? Number(found.coefficient) || 1 : 1;
}

export function findDifficulty(config, difficultyId) {
  return ((config && config.difficulty) || []).find((item) => item.id === difficultyId) || null;
}

/**
 * 生成本局题目。
 * @returns {{ items: object[], coefficient: number, breakdown: {id: string, count: number}[] }}
 */
export function planRound({
  riddles,
  difficultyId,
  roundSize,
  difficultyIds,
  mixed = null,
  coefficient = 1,
  excludeIds = new Set(),
  rng = Math.random,
}) {
  const pools = groupByDifficulty(riddles, difficultyIds);
  const size = Math.max(0, Number(roundSize) || 0);
  const isMixed = Boolean(mixed && mixed.id === difficultyId);

  if (!isMixed) {
    const pool = pools.get(difficultyId) || [];
    const count = Math.min(size, pool.length);
    return {
      items: pickWithAvoid(pool, count, excludeIds, rng),
      coefficient: Number(coefficient) || 1,
      breakdown: [{ id: difficultyId, count }],
    };
  }

  const ratio = (mixed && mixed.ratio) || {};
  const rawCounts = allocateByRatio(size, ratio, difficultyIds);
  const counts = fitCountsToPools(rawCounts, pools, difficultyIds);

  const picked = [];
  const breakdown = [];
  difficultyIds.forEach((id, index) => {
    const pool = pools.get(id) || [];
    const count = counts[index];
    breakdown.push({ id, count });
    picked.push(...pickWithAvoid(pool, count, excludeIds, rng));
  });

  return {
    items: shuffle(picked, rng),
    coefficient: Number(coefficient) || Number(mixed && mixed.coefficient) || 1,
    breakdown,
  };
}
