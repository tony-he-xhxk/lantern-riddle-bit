/**
 * 题库编号工具。
 * 编号一律从题库现状推算，不写死任何题量：
 * 每档的编号形如 <难度>-<数字>，下一道题取该档已用最大号 + 1。
 */

export function parseRiddleId(id) {
  const match = /^([A-Za-z][A-Za-z0-9]*)-(\d+)$/.exec(String(id === null || id === undefined ? '' : id).trim());
  if (!match) return null;
  return { prefix: match[1], number: Number(match[2]), digits: match[2].length };
}

export function formatRiddleId(prefix, number, minWidth = 2) {
  const value = Math.trunc(Number(number));
  const width = Math.max(minWidth, String(value).length);
  return `${prefix}-${String(value).padStart(width, '0')}`;
}

/**
 * 该档下一道题可用的编号。
 * 只看前缀相同的编号，自定义前缀（例如校园梗用的 bit-01）不会干扰计数；
 * 万一算出来的编号已被占用，就继续往后找。
 */
export function nextRiddleId(riddles, prefix) {
  const used = new Set();
  let max = 0;
  let width = 2;

  for (const riddle of Array.isArray(riddles) ? riddles : []) {
    const id = riddle && typeof riddle.id === 'string' ? riddle.id : '';
    if (id) used.add(id);
    const parsed = parseRiddleId(id);
    if (parsed && parsed.prefix === prefix && parsed.number > max) {
      max = parsed.number;
      width = Math.max(2, parsed.digits);
    }
  }

  let number = max + 1;
  let candidate = formatRiddleId(prefix, number, width);
  while (used.has(candidate)) {
    number += 1;
    candidate = formatRiddleId(prefix, number, width);
  }
  return candidate;
}

/** 该难度下编号不符合 <难度>-<数字> 规范的条目，便于维护编号连续性 */
export function oddIdsFor(riddles, difficultyId) {
  return (Array.isArray(riddles) ? riddles : [])
    .filter((riddle) => riddle && riddle.difficulty === difficultyId)
    .map((riddle) => String(riddle.id === null || riddle.id === undefined ? '' : riddle.id))
    .filter((id) => {
      const parsed = parseRiddleId(id);
      return !parsed || parsed.prefix !== difficultyId;
    });
}
