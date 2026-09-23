#!/usr/bin/env node
/**
 * 新增题目的编号助手：编号自动从题库现状推算，不用自己数。
 *
 *   node tools/new-riddle.mjs                  列出各档下一道可用编号
 *   node tools/new-riddle.mjs medium           生成 medium 档的选择题模板
 *   node tools/new-riddle.mjs medium fill      生成 medium 档的填空题模板
 *
 * 提示信息走标准错误，模板走标准输出，方便复制。
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { nextRiddleId } from './riddle-utils.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function readJson(relativePath) {
  const file = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`读取 ${relativePath} 失败：${error.message}`);
    process.exit(1);
    return null;
  }
}

const config = readJson('data/config.json');
const payload = readJson('data/riddles.json');
const riddles = Array.isArray(payload.riddles) ? payload.riddles : [];
const difficultyIds = (config.difficulty || []).map((item) => item.id);

const args = process.argv.slice(2).filter((value) => value && !value.startsWith('--'));
const requested = args[0] || '';
const requestedType = (args[1] || 'choice').toLowerCase();

function countOf(difficultyId) {
  return riddles.filter((riddle) => riddle && riddle.difficulty === difficultyId).length;
}

if (!requested) {
  console.error('当前各档编号情况：');
  for (const id of difficultyIds) {
    const label = (config.difficulty.find((item) => item.id === id) || {}).name || id;
    console.error(`  ${id}（${label}）：已有 ${countOf(id)} 题，下一道可用编号 ${nextRiddleId(riddles, id)}`);
  }
  const mixed = config.round && config.round.mixedMode;
  if (mixed && mixed.enabled) {
    console.error('  混合模式不单独编号，它从上面三档里抽题。');
  }
  console.error('');
  console.error('生成模板：node tools/new-riddle.mjs <easy|medium|hard> [choice|fill]');
  process.exit(0);
}

if (!difficultyIds.includes(requested)) {
  console.error(`没有名为「${requested}」的难度。可选：${difficultyIds.join(' / ')}`);
  if (config.round && config.round.mixedMode && config.round.mixedMode.id === requested) {
    console.error('混合模式不需要单独编号，直接从 easy / medium / hard 里抽题。');
  }
  process.exit(1);
}

if (requestedType !== 'choice' && requestedType !== 'fill') {
  console.error(`题型只能是 choice 或 fill，当前为「${args[1]}」`);
  process.exit(1);
}

const id = nextRiddleId(riddles, requested);
const label = (config.difficulty.find((item) => item.id === requested) || {}).name || requested;

console.error(`难度 ${requested}（${label}）当前 ${countOf(requested)} 题，下一道编号：${id}`);
console.error('把下面的片段追加到 data/riddles.json 的 riddles 数组末尾（记得给上一条补一个英文逗号），');
console.error('然后运行 node tools/validate-riddles.mjs 校验。');
console.error('');

const template =
  requestedType === 'choice'
    ? {
        id,
        difficulty: requested,
        type: 'choice',
        topic: '打一字',
        question: '在此填写谜面',
        answer: '在此填写谜底',
        options: ['在此填写谜底', '干扰项一', '干扰项二', '干扰项三'],
        explanation: '一句话写清谜底是怎么扣出来的。',
      }
    : {
        id,
        difficulty: requested,
        type: 'fill',
        topic: '打一成语',
        question: '在此填写谜面',
        answer: '在此填写谜底',
        acceptedAnswers: ['在此填写谜底', '另一种常见写法'],
        explanation: '一句话写清谜底是怎么扣出来的。',
      };

console.log(
  JSON.stringify(template, null, 2)
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n')
);
