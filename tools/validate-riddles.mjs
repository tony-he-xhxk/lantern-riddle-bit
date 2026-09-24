#!/usr/bin/env node
/**
 * 题库校验：零依赖，直接 node tools/validate-riddles.mjs
 * 检查字段完整性、题型与选项是否匹配、id 与谜面是否重复，并报告各档题量分布。
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { normalizeAnswer } from '../js/scoring.js';
import { nextRiddleId, oddIdsFor } from './riddle-utils.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const configPath = path.join(root, 'data', 'config.json');
const riddlesPath = path.join(root, 'data', 'riddles.json');

const errors = [];
const warnings = [];
const info = [];

function readJson(file) {
  if (!fs.existsSync(file)) {
    errors.push(`找不到文件：${path.relative(root, file)}`);
    return null;
  }
  const text = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    errors.push(`${path.relative(root, file)} 不是合法的 JSON：${error.message}`);
    return null;
  }
}

const config = readJson(configPath);
const payload = readJson(riddlesPath);

if (config && payload) {
  const difficultyIds = (config.difficulty || []).map((item) => item.id);
  const list = Array.isArray(payload.riddles) ? payload.riddles : null;

  if (!list) {
    errors.push('data/riddles.json 缺少 riddles 数组');
  } else {
    const seenIds = new Map();
    const seenQuestions = new Map();
    const stats = new Map();
    const topicStats = new Map();

    list.forEach((riddle, index) => {
      const where = `第 ${index + 1} 条（id: ${riddle && riddle.id ? riddle.id : '缺失'}）`;

      if (!riddle || typeof riddle !== 'object') {
        errors.push(`${where}：不是对象`);
        return;
      }

      if (typeof riddle.id !== 'string' || !riddle.id.trim()) {
        errors.push(`${where}：缺少 id`);
      } else if (seenIds.has(riddle.id)) {
        errors.push(`${where}：id 与第 ${seenIds.get(riddle.id) + 1} 条重复`);
      } else {
        seenIds.set(riddle.id, index);
      }

      if (!difficultyIds.includes(riddle.difficulty)) {
        errors.push(`${where}：difficulty 为 ${JSON.stringify(riddle.difficulty)}，不在配置的 ${difficultyIds.join(' / ')} 中`);
      }

      if (riddle.type !== 'choice' && riddle.type !== 'fill') {
        errors.push(`${where}：type 只能是 choice 或 fill，当前为 ${JSON.stringify(riddle.type)}`);
      }

      for (const key of ['question', 'topic', 'answer', 'explanation']) {
        if (typeof riddle[key] !== 'string' || !riddle[key].trim()) {
          errors.push(`${where}：${key} 为空`);
        }
      }

      if (typeof riddle.question === 'string') {
        const key = normalizeAnswer(riddle.question);
        if (seenQuestions.has(key)) {
          warnings.push(`${where}：谜面与第 ${seenQuestions.get(key) + 1} 条重复`);
        } else {
          seenQuestions.set(key, index);
        }
      }

      if (riddle.type === 'choice') {
        if (!Array.isArray(riddle.options)) {
          errors.push(`${where}：选择题缺少 options 数组`);
        } else {
          if (riddle.options.length !== 4) {
            errors.push(`${where}：选择题应有 4 个选项，当前 ${riddle.options.length} 个`);
          }
          const normalized = riddle.options.map((option) => normalizeAnswer(option));
          if (new Set(normalized).size !== normalized.length) {
            errors.push(`${where}：options 中存在重复选项`);
          }
          const answer = normalizeAnswer(riddle.answer);
          if (!normalized.includes(answer)) {
            errors.push(`${where}：options 中没有正确答案“${riddle.answer}”`);
          }
        }
        if (riddle.acceptedAnswers !== undefined) {
          warnings.push(`${where}：选择题通常不需要 acceptedAnswers，已忽略`);
        }
      }

      if (riddle.type === 'fill') {
        if (!Array.isArray(riddle.acceptedAnswers) || riddle.acceptedAnswers.length === 0) {
          errors.push(`${where}：填空题需要非空的 acceptedAnswers 数组`);
        } else {
          const normalized = riddle.acceptedAnswers.map((option) => normalizeAnswer(option));
          if (new Set(normalized).size !== normalized.length) {
            const groups = new Map();
            riddle.acceptedAnswers.forEach((option, index) => {
              const key = normalized[index];
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key).push(String(option));
            });
            const collisions = [...groups.values()].filter((group) => group.length > 1);
            const stripWords =
              config.matching && Array.isArray(config.matching.stripWords)
                ? config.matching.stripWords
                : [];
            const why = stripWords.length
              ? `（判定会忽略 ${stripWords.join('、')} 这些虚词，以及空格与中英文标点）`
              : '（判定会忽略空格与中英文标点）';
            warnings.push(
              `${where}：${collisions
                .map((group) => group.map((value) => `「${value}」`).join(' 与 '))
                .join('；')} 归一化后完全相同${why}，判定时彼此等价，保留一条即可`
            );
          }
          if (!normalized.includes(normalizeAnswer(riddle.answer))) {
            warnings.push(`${where}：acceptedAnswers 未包含标准答案，判定时将自动补上`);
          }
        }
        if (Array.isArray(riddle.options) && riddle.options.length > 0) {
          errors.push(`${where}：填空题不应带 options`);
        }
      }

      if (difficultyIds.includes(riddle.difficulty) && (riddle.type === 'choice' || riddle.type === 'fill')) {
        const bucket = stats.get(riddle.difficulty) || { total: 0, choice: 0, fill: 0 };
        bucket.total += 1;
        bucket[riddle.type] += 1;
        stats.set(riddle.difficulty, bucket);
      }

      if (typeof riddle.topic === 'string') {
        const count = topicStats.get(riddle.topic) || 0;
        topicStats.set(riddle.topic, count + 1);
      }
    });

    info.push(`共 ${list.length} 题`);
    const roundSize = Number((config.round && config.round.roundSize) || 0);
    for (const id of difficultyIds) {
      const bucket = stats.get(id) || { total: 0, choice: 0, fill: 0 };
      info.push(
        `  ${id}：${bucket.total} 题（选择 ${bucket.choice} / 填空 ${bucket.fill}），下一道可用编号 ${nextRiddleId(list, id)}`
      );
      if (roundSize > 0 && bucket.total < roundSize) {
        warnings.push(
          `${id} 档只有 ${bucket.total} 题，少于每局 ${roundSize} 题，抽题时会出现重复`
        );
      }
      const odd = oddIdsFor(list, id);
      if (odd.length) {
        warnings.push(
          `${id} 档有 ${odd.length} 条编号不符合 ${id}-<数字> 格式（${odd.slice(0, 4).join('、')}${
            odd.length > 4 ? '…' : ''
          }），自动编号会跳过它们`
        );
      }
    }

    const topTopics = [...topicStats.entries()].sort((a, b) => b[1] - a[1]);
    info.push(`谜目共 ${topTopics.length} 类：${topTopics.map(([name, count]) => `${name}×${count}`).join('，')}`);
  }
}

const useColor = process.stdout.isTTY;
const paint = (code, text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);

console.log(paint('36', '灯谜题库校验'));
console.log('-'.repeat(40));
for (const line of info) console.log(`  ${line}`);

if (warnings.length) {
  console.log('');
  console.log(paint('33', `提醒 ${warnings.length} 条：`));
  for (const line of warnings) console.log(`  · ${line}`);
}

if (errors.length) {
  console.log('');
  console.log(paint('31', `错误 ${errors.length} 条：`));
  for (const line of errors) console.log(`  ✗ ${line}`);
  console.log('');
  console.log(paint('31', '校验未通过'));
  process.exit(1);
}

console.log('');
console.log(paint('32', '校验通过，题库可以放心使用。'));
console.log(paint('36', '新增题目可用：node tools/new-riddle.mjs <easy|medium|hard> [choice|fill]'));
