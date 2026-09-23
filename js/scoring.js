/**
 * 纯函数模块：答案归一化、匹配与计分。
 * 不依赖 DOM，浏览器与 Node（tools/test-scoring.mjs）共用同一份实现。
 */

export const DEFAULT_MATCHING = {
  trim: true,
  ignoreSpaces: true,
  ignorePunctuation: true,
  caseInsensitive: true,
  fullWidthToHalf: true,
  stripWords: ['的', '是', '了'],
};

const PUNCTUATION = new RegExp(
  '[\\s\\u3000\\u00b7、。，．,.!！?？;；:：\'"\\u201c\\u201d\\u2018\\u2019「」『』（）()《》〈〉【】\\[\\]{}<>—–~～_…\\/\\\\|+*&#@$%^=`\u2032\u2033]',
  'g'
);

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** 把玩家输入与题库答案放到同一套规则下比较 */
export function normalizeAnswer(value, matching = {}) {
  const m = { ...DEFAULT_MATCHING, ...matching };
  let s = value === null || value === undefined ? '' : String(value);
  if (m.fullWidthToHalf && typeof s.normalize === 'function') s = s.normalize('NFKC');
  if (m.trim) s = s.trim();
  if (m.ignoreSpaces) s = s.replace(/[\s\u3000]+/g, '');
  if (m.caseInsensitive) s = s.toLowerCase();
  if (m.ignorePunctuation) s = s.replace(PUNCTUATION, '');
  const words = Array.isArray(m.stripWords) ? m.stripWords : [];
  for (const word of words) {
    if (!word) continue;
    s = s.split(String(word)).join('');
  }
  return s;
}

/** 一道题认可的全部答案（标准答案 + 等价答案） */
export function answerCandidates(riddle) {
  const list = [riddle && riddle.answer];
  if (riddle && Array.isArray(riddle.acceptedAnswers)) list.push(...riddle.acceptedAnswers);
  return list
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
    .map((value) => String(value));
}

/** 填空题判定：命中任一答案即算对 */
export function matchAnswer(input, riddle, matching = {}) {
  const target = normalizeAnswer(input, matching);
  if (!target) return false;
  return answerCandidates(riddle).some(
    (candidate) => normalizeAnswer(candidate, matching) === target
  );
}

/** 第一次答错后提示的字数：忽略标点与空格 */
export function answerLengthHint(answer) {
  if (answer === null || answer === undefined) return 0;
  let s = String(answer);
  if (typeof s.normalize === 'function') s = s.normalize('NFKC');
  s = s.replace(/[\s\u3000]/g, '').replace(PUNCTUATION, '');
  return Array.from(s).length;
}

/** 剩余时间比例，用于时间加成 */
export function timeBonusRatio(remainingMs, totalMs) {
  if (!(totalMs > 0) || !Number.isFinite(remainingMs)) return 0;
  return clamp01(remainingMs / totalMs);
}

/**
 * 单题得分。
 * 第一次作答（选择/填空）命中：基础分 × 难度系数 × (1 + 加权剩余时间比)
 * 填空题第二次作答命中：基础分 × 难度系数 × fillSecondAttemptFactor（不再叠加时间加成）
 */
export function scoreAnswer({
  base = 100,
  coefficient = 1,
  remainingMs = 0,
  totalMs = 0,
  timeBonusWeight = 0.5,
  secondAttempt = false,
  fillSecondAttemptFactor = 0.6,
} = {}) {
  const b = Number(base) || 0;
  const c = Number(coefficient) || 0;
  if (b <= 0 || c <= 0) return 0;
  if (secondAttempt) {
    return Math.floor(b * c * clamp01(fillSecondAttemptFactor));
  }
  const bonus = clamp01(timeBonusWeight) * timeBonusRatio(remainingMs, totalMs);
  return Math.floor(b * c * (1 + bonus));
}

/** 单题满分，用于结算页显示 */
export function maxScorePerQuestion({ base = 100, coefficient = 1, timeBonusWeight = 0.5 } = {}) {
  const b = Number(base) || 0;
  const c = Number(coefficient) || 0;
  return Math.floor(b * c * (1 + clamp01(timeBonusWeight)));
}

export function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0%';
  return `${Math.round(n * 100)}%`;
}
