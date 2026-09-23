#!/usr/bin/env node
/**
 * 纯函数单元测试：node --test tools/test-scoring.mjs
 * 覆盖填空题归一化、多答案、时间加成边界与降分规则。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeAnswer,
  matchAnswer,
  answerLengthHint,
  timeBonusRatio,
  scoreAnswer,
  maxScorePerQuestion,
  formatPercent,
} from '../js/scoring.js';

const MATCHING = {
  trim: true,
  ignoreSpaces: true,
  ignorePunctuation: true,
  caseInsensitive: true,
  fullWidthToHalf: true,
  stripWords: ['的', '是', '了'],
};

test('归一化：去空格、全角、标点与大小写', () => {
  assert.equal(normalizeAnswer(' 桂林 ', MATCHING), '桂林');
  assert.equal(normalizeAnswer('桂林！', MATCHING), '桂林');
  assert.equal(normalizeAnswer('桂 林', MATCHING), '桂林');
  assert.equal(normalizeAnswer('Ｋｕｎｍｉｎｇ', MATCHING), 'kunming');
  assert.equal(normalizeAnswer('KunMing', MATCHING), 'kunming');
  assert.equal(normalizeAnswer('（中秋节）', MATCHING), '中秋节');
});

test('归一化：按配置去掉虚词', () => {
  assert.equal(normalizeAnswer('礼轻的 情意重', MATCHING), '礼轻情意重');
  assert.equal(normalizeAnswer('是中秋', MATCHING), '中秋');
});

test('匹配：标准答案与等价答案都算对', () => {
  const riddle = { answer: '中秋节', acceptedAnswers: ['中秋节', '中秋', '八月节'] };
  assert.equal(matchAnswer('中秋', riddle, MATCHING), true);
  assert.equal(matchAnswer(' 八月节 ', riddle, MATCHING), true);
  assert.equal(matchAnswer('中秋节！', riddle, MATCHING), true);
  assert.equal(matchAnswer('端午', riddle, MATCHING), false);
  assert.equal(matchAnswer('', riddle, MATCHING), false);
  assert.equal(matchAnswer('   ', riddle, MATCHING), false);
});

test('字数提示忽略标点与空格', () => {
  assert.equal(answerLengthHint('礼轻情意重'), 5);
  assert.equal(answerLengthHint('礼轻 情意重'), 5);
  assert.equal(answerLengthHint('嫦娥，仙子'), 4);
  assert.equal(answerLengthHint('长城'), 2);
});

test('时间加成比例被夹在 0 与 1 之间', () => {
  assert.equal(timeBonusRatio(30000, 30000), 1);
  assert.equal(timeBonusRatio(0, 30000), 0);
  assert.equal(timeBonusRatio(-100, 30000), 0);
  assert.equal(timeBonusRatio(60000, 30000), 1);
  assert.equal(timeBonusRatio(15000, 30000), 0.5);
  assert.equal(timeBonusRatio(1000, 0), 0);
});

test('选择题计分：满时间加成与零加成', () => {
  const full = scoreAnswer({
    base: 100,
    coefficient: 1.3,
    remainingMs: 30000,
    totalMs: 30000,
    timeBonusWeight: 0.5,
  });
  assert.equal(full, Math.floor(100 * 1.3 * 1.5));

  const none = scoreAnswer({
    base: 100,
    coefficient: 1.3,
    remainingMs: 0,
    totalMs: 30000,
    timeBonusWeight: 0.5,
  });
  assert.equal(none, Math.floor(100 * 1.3));
});

test('填空题第二次答对：按比例降分且不叠加时间加成', () => {
  const second = scoreAnswer({
    base: 100,
    coefficient: 1.6,
    remainingMs: 40000,
    totalMs: 45000,
    timeBonusWeight: 0.5,
    secondAttempt: true,
    fillSecondAttemptFactor: 0.6,
  });
  assert.equal(second, Math.floor(100 * 1.6 * 0.6));
  assert.ok(second < scoreAnswer({ base: 100, coefficient: 1.6, remainingMs: 40000, totalMs: 45000 }));
});

test('难度系数换算与满分计算', () => {
  const easy = scoreAnswer({ base: 100, coefficient: 1, remainingMs: 0, totalMs: 30000 });
  const hard = scoreAnswer({ base: 100, coefficient: 1.6, remainingMs: 0, totalMs: 30000 });
  assert.equal(easy, 100);
  assert.equal(hard, 160);
  assert.equal(maxScorePerQuestion({ base: 100, coefficient: 1.6, timeBonusWeight: 0.5 }), 240);
});

test('异常输入不会产生负分或 NaN', () => {
  assert.equal(scoreAnswer({ base: 0, coefficient: 1 }), 0);
  assert.equal(scoreAnswer({ base: -50, coefficient: 1 }), 0);
  assert.equal(scoreAnswer({ base: '不是数字', coefficient: 1 }), 0);
  assert.equal(scoreAnswer({ base: 100, coefficient: 0 }), 0);
  assert.equal(scoreAnswer({}), 100); // 未传参数时退回到默认基础分
  assert.ok(Number.isFinite(scoreAnswer({ base: 100, coefficient: 1, remainingMs: NaN })));
  assert.equal(formatPercent(0.789), '79%');
  assert.equal(formatPercent(undefined), '0%');
});
