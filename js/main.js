/**
 * 入口：串联数据、规则与界面。
 * 无构建步骤、无外部依赖，直接用静态服务器打开 index.html 即可。
 */

import { loadSiteData, prepareRiddles, groupByDifficulty, createStore } from './data.js';
import { shuffle, planRound, coefficientFor, findDifficulty } from './game.js';
import { createTranslator, createUI } from './render.js';
import {
  scoreAnswer,
  matchAnswer,
  answerLengthHint,
  maxScorePerQuestion,
} from './scoring.js';
import { drawScoreCard, downloadCanvas } from './card.js';

const FALLBACK_CONFIG = {
  site: {
    lang: 'zh-CN',
    title: '月满中秋 · 灯谜趣答',
    subtitle: '东风夜放花千树，更吹落、星如雨。',
    footer: '愿今夜灯火可亲，谜题有趣。',
  },
  round: { roundSize: 15, mixedMode: { enabled: false, id: 'mixed' } },
  difficulty: [],
  timer: { choice: 30, fill: 45, warnAtSeconds: [10, 5] },
  scoring: { base: 100, timeBonusWeight: 0.5, fillSecondAttemptFactor: 0.6 },
  matching: {},
  reveal: { autoDelayMs: 5000 },
  storage: { avoidRepeat: true, keyPrefix: 'lantern-riddle.' },
  answerCard: { filePrefix: 'lantern-score-' },
  text: {
    errorTitle: '灯笼没挂稳',
    errorData: '题库或配置读取失败，请检查 data/config.json 与 data/riddles.json。',
    errorPool: '题库中没有可用题目，请检查 data/riddles.json。',
    retry: '重试',
    backHome: '回到首页',
  },
};

const state = {
  config: FALLBACK_CONFIG,
  t: (key) => key,
  ui: null,
  riddles: [],
  pools: new Map(),
  skipped: [],
  difficultyIds: [],
  store: null,
  round: null,
  timer: null,
};

const scoring = () => state.config.scoring || {};
const matching = () => state.config.matching || {};
const timerConfig = () => state.config.timer || {};

function baseScore() {
  const value = Number(scoring().base);
  return Number.isFinite(value) && value > 0 ? value : 100;
}

function timeBonusWeight() {
  const value = Number(scoring().timeBonusWeight);
  return Number.isFinite(value) && value >= 0 ? value : 0.5;
}

function fillSecondFactor() {
  const value = Number(scoring().fillSecondAttemptFactor);
  return Number.isFinite(value) && value > 0 && value <= 1 ? value : 0.6;
}

function difficultyTextFor(difficultyId) {
  const mixed = state.config.round && state.config.round.mixedMode;
  if (mixed && difficultyId === mixed.id) {
    return mixed.name || '混合模式';
  }
  const item = findDifficulty(state.config, difficultyId);
  return item ? `${item.label} · ${item.name}` : difficultyId;
}

/** 结算页与成绩图用短名，避免在窄栏里折行 */
function difficultyShortTextFor(difficultyId) {
  const mixed = state.config.round && state.config.round.mixedMode;
  if (mixed && difficultyId === mixed.id) return mixed.name || '混合模式';
  const item = findDifficulty(state.config, difficultyId);
  return item ? item.name || item.label : difficultyId;
}

/* ------------------------------ 计时 ------------------------------ */

function stopTimer() {
  const timer = state.timer;
  if (!timer) return;
  timer.stopped = true;
  window.cancelAnimationFrame(timer.rafId);
  window.clearTimeout(timer.timeoutId);
  state.timer = null;
}

function startTimer(durationMs) {
  stopTimer();
  const timer = {
    total: durationMs,
    startTs: performance.now(),
    rafId: 0,
    timeoutId: 0,
    stopped: false,
    warned: new Set(),
  };
  state.timer = timer;

  // setTimeout 负责“到点必到”，requestAnimationFrame 只负责画面平滑
  timer.timeoutId = window.setTimeout(() => handleTimeout(), durationMs + 20);

  const warns = Array.isArray(timerConfig().warnAtSeconds) ? timerConfig().warnAtSeconds : [10, 5];
  const tick = () => {
    if (state.timer !== timer || timer.stopped) return;
    const elapsed = performance.now() - timer.startTs;
    const remaining = Math.max(0, timer.total - elapsed);
    state.ui.updateTimer(remaining, timer.total);
    for (const warn of warns) {
      const threshold = Number(warn) * 1000;
      if (remaining <= threshold && remaining > 0 && !timer.warned.has(warn)) {
        timer.warned.add(warn);
        state.ui.announce(state.t('timerWarn', { n: warn }));
      }
    }
    if (remaining > 0) timer.rafId = window.requestAnimationFrame(tick);
  };

  state.ui.updateTimer(durationMs, durationMs);
  timer.rafId = window.requestAnimationFrame(tick);
}

function remainingMs() {
  const timer = state.timer;
  if (!timer) return 0;
  return Math.max(0, timer.total - (performance.now() - timer.startTs));
}

function elapsedSeconds(current) {
  const passed = (performance.now() - current.questionStartTs) / 1000;
  return Math.max(0, Math.min(current.timerSeconds, passed));
}

/* ------------------------------ 一局流程 ------------------------------ */

function presentHome() {
  state.ui.renderHome({
    mixed: state.config.round && state.config.round.mixedMode,
    onStart: startRound,
    skipped: state.skipped,
  });
  state.ui.setQuitEnabled(false);
  state.ui.showScreen('home');
}

function startRound(difficultyId) {
  const roundSize = Number(state.config.round && state.config.round.roundSize) || 15;
  const mixed = state.config.round && state.config.round.mixedMode;
  const excludeIds = new Set(state.store ? state.store.readRecentIds() : []);

  const plan = planRound({
    riddles: state.riddles,
    difficultyId,
    roundSize,
    difficultyIds: state.difficultyIds,
    mixed,
    coefficient: coefficientFor(state.config, difficultyId),
    excludeIds,
    rng: Math.random,
  });

  if (!plan.items.length) {
    state.ui.showError(state.t('errorPool'));
    return;
  }

  state.round = {
    difficultyId,
    coefficient: plan.coefficient,
    items: plan.items,
    index: 0,
    entries: [],
    score: 0,
    totalSeconds: 0,
    current: null,
  };

  if (state.store) state.store.writeRecentIds(plan.items.map((item) => item.id));

  state.ui.setQuitEnabled(true);
  state.ui.showScreen('play');
  presentQuestion();
}

function presentQuestion() {
  const round = state.round;
  const riddle = round.items[round.index];
  const isChoice = riddle.type === 'choice';
  const options = isChoice ? shuffle(riddle.options) : [];
  const seconds = Number(isChoice ? timerConfig().choice : timerConfig().fill) || (isChoice ? 30 : 45);

  round.current = {
    riddle,
    options,
    attempts: 0,
    locked: false,
    timedOut: false,
    timerSeconds: seconds,
    questionStartTs: performance.now(),
    revealTimerId: 0,
  };

  state.ui.renderQuestion({
    riddle,
    index: round.index,
    total: round.items.length,
    difficultyText: difficultyTextFor(round.difficultyId),
    score: round.score,
    timerSeconds: seconds,
    options,
    onChoice: handleChoice,
    onSubmitFill: handleFill,
  });

  startTimer(seconds * 1000);
}

function handleChoice(value, button) {
  const current = state.round && state.round.current;
  if (!current || current.locked) return;
  current.locked = true;

  const remaining = remainingMs();
  stopTimer();

  const correct = value === current.riddle.answer;
  let points = 0;
  if (correct) {
    points = scoreAnswer({
      base: baseScore(),
      coefficient: state.round.coefficient,
      remainingMs: remaining,
      totalMs: current.timerSeconds * 1000,
      timeBonusWeight: timeBonusWeight(),
    });
    state.ui.markOption(button, 'correct');
  } else {
    state.ui.markOption(button, 'wrong');
    state.ui.highlightCorrectOption(current.riddle.answer);
  }

  finishQuestion({
    correct,
    answerText: value,
    points,
    kind: correct ? 'correct' : 'wrong',
  });
}

function handleFill(value) {
  const current = state.round && state.round.current;
  if (!current || current.locked) return;

  const text = String(value === null || value === undefined ? '' : value).trim();
  if (!text) return;

  current.attempts += 1;
  const correct = matchAnswer(text, current.riddle, matching());

  if (correct) {
    const remaining = remainingMs();
    stopTimer();
    const secondAttempt = current.attempts > 1;
    const points = scoreAnswer({
      base: baseScore(),
      coefficient: state.round.coefficient,
      remainingMs: remaining,
      totalMs: current.timerSeconds * 1000,
      timeBonusWeight: timeBonusWeight(),
      secondAttempt,
      fillSecondAttemptFactor: fillSecondFactor(),
    });
    current.locked = true;
    state.ui.markFillInput('correct');
    finishQuestion({ correct: true, answerText: text, points, kind: 'correct' });
    return;
  }

  if (current.attempts === 1) {
    // 第一次答错：给字数提示、本题降分，倒计时继续
    const length = answerLengthHint(current.riddle.answer);
    const percent = Math.round(fillSecondFactor() * 100);
    state.ui.showHint(state.t('retryHint', { n: length, percent }));
    state.ui.announce(state.t('retryHint', { n: length, percent }));
    state.ui.markFillInput('wrong');
    state.ui.clearFillInput();
    return;
  }

  current.locked = true;
  stopTimer();
  state.ui.markFillInput('wrong');
  finishQuestion({ correct: false, answerText: text, points: 0, kind: 'wrong' });
}

function handleTimeout() {
  const current = state.round && state.round.current;
  if (!current || current.locked) return;
  current.locked = true;
  current.timedOut = true;
  stopTimer();

  const answerText = current.riddle.type === 'fill' ? state.ui.readFillValue() : '';
  state.ui.markFillInput('wrong');
  finishQuestion({ correct: false, answerText, points: 0, kind: 'timeout' });
}

function finishQuestion({ correct, answerText, points, kind }) {
  const round = state.round;
  const current = round.current;
  const seconds = elapsedSeconds(current);

  round.score += points;
  round.totalSeconds += seconds;
  round.entries.push({
    riddle: current.riddle,
    answerText,
    correct,
    points,
    timedOut: kind === 'timeout',
    seconds,
  });

  state.ui.lockAnswer();
  if (kind !== 'correct' && current.riddle.type === 'choice') {
    state.ui.highlightCorrectOption(current.riddle.answer);
  }
  if (state.ui.refs.scoreLabel) {
    state.ui.refs.scoreLabel.textContent = `${state.t('scoreLabel')} ${round.score}`;
  }

  const isLast = round.index >= round.items.length - 1;
  state.ui.showReveal({
    kind,
    answerText: current.riddle.answer,
    points,
    explanation: current.riddle.explanation,
    isLast,
    onNext: nextQuestion,
  });

  if (correct) state.ui.announce(state.t('correct'));
  const delay = Number((state.config.reveal && state.config.reveal.autoDelayMs) || 5000);
  current.revealTimerId = window.setTimeout(() => nextQuestion(), Math.max(600, delay));
}

function nextQuestion() {
  const round = state.round;
  if (!round || !round.current) return;
  if (round.current.advanced) return;
  round.current.advanced = true;
  window.clearTimeout(round.current.revealTimerId);
  round.index += 1;
  if (round.index >= round.items.length) {
    showResult();
  } else {
    presentQuestion();
  }
}

function showResult() {
  stopTimer();
  const round = state.round;
  const entries = round.entries;
  const correctCount = entries.filter((entry) => entry.correct).length;

  const stats = {
    score: round.score,
    total: entries.length,
    correct: correctCount,
    accuracy: entries.length ? correctCount / entries.length : 0,
    totalSeconds: Math.round(round.totalSeconds),
    maxScore: entries.reduce(
      (sum) =>
        sum +
        maxScorePerQuestion({
          base: baseScore(),
          coefficient: round.coefficient,
          timeBonusWeight: timeBonusWeight(),
        }),
      0
    ),
  };

  state.ui.setQuitEnabled(false);
  state.ui.renderResult({
    stats,
    entries,
    difficultyText: difficultyShortTextFor(round.difficultyId),
    onPlayAgain: () => startRound(round.difficultyId),
    onChangeDifficulty: presentHome,
    onDownloadCard: () => exportScoreCard(stats, round.difficultyId, entries),
  });
  state.ui.showScreen('result');
}

async function exportScoreCard(stats, difficultyId, entries) {
  const canvas = state.ui.refs.cardCanvas;
  if (!canvas) return;
  try {
    const cardConfig = state.config.answerCard || {};
    const width = Number(cardConfig.width);
    if (width > 0 && canvas.width !== width) canvas.width = width;
    drawScoreCard(canvas, {
      config: state.config,
      t: state.t,
      stats,
      difficultyText: difficultyShortTextFor(difficultyId),
      entries: Array.isArray(entries) ? entries : [],
    });
    const prefix = (state.config.answerCard && state.config.answerCard.filePrefix) || 'lantern-score-';
    const stamp = new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');
    await downloadCanvas(canvas, `${prefix}${stamp}.png`);
    state.ui.showCardNotice(state.t('cardSaved'));
  } catch (error) {
    state.ui.showCardNotice(state.t('cardFailed'), 'error');
    if (window.console && window.console.warn) window.console.warn(error);
  }
}

function exitToHome() {
  stopTimer();
  state.round = null;
  presentHome();
}

/* ------------------------------ 事件绑定 ------------------------------ */

function wireGlobalButtons() {
  const ui = state.ui;

  if (ui.refs.quitBtn) {
    ui.refs.quitBtn.addEventListener('click', () => {
      if (!state.round) return;
      ui.openConfirm();
    });
  }
  if (ui.refs.confirmNo) ui.refs.confirmNo.addEventListener('click', () => ui.closeConfirm());
  if (ui.refs.confirmYes) {
    ui.refs.confirmYes.addEventListener('click', () => {
      ui.closeConfirm();
      exitToHome();
    });
  }
  if (ui.refs.confirmOverlay) {
    ui.refs.confirmOverlay.addEventListener('click', (event) => {
      if (event.target === ui.refs.confirmOverlay) ui.closeConfirm();
    });
  }
  if (ui.refs.retryBtn) ui.refs.retryBtn.addEventListener('click', () => window.location.reload());
  if (ui.refs.errorHomeBtn) {
    ui.refs.errorHomeBtn.addEventListener('click', () => {
      if (state.riddles.length) presentHome();
      else window.location.reload();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && ui.refs.confirmOverlay && !ui.refs.confirmOverlay.hidden) {
      ui.closeConfirm();
      return;
    }
    const round = state.round;
    if (!round || !round.current || round.current.locked) return;
    if (round.current.riddle.type !== 'choice') return;
    const index = Number(event.key) - 1;
    if (!Number.isInteger(index) || index < 0) return;
    const buttons = ui.optionButtons;
    if (buttons[index] && !buttons[index].disabled) {
      event.preventDefault();
      buttons[index].click();
    }
  });
}

/* ------------------------------ 启动 ------------------------------ */

async function boot() {
  let loaded = null;
  let riddles = [];
  let skipped = [];
  let configError = null;

  try {
    loaded = await loadSiteData();
    const ids = ((loaded.config && loaded.config.difficulty) || []).map((item) => item.id);
    const prepared = prepareRiddles(loaded.riddlePayload, ids);
    riddles = prepared.riddles;
    skipped = prepared.skipped;
    if (skipped.length) {
      window.console.warn('[灯谜] 已跳过字段不完整的题目：', skipped);
    }
  } catch (error) {
    configError = error;
  }

  const config = loaded && loaded.config ? loaded.config : FALLBACK_CONFIG;
  state.config = config;
  state.t = createTranslator(config.text || {});
  state.ui = createUI({ config, t: state.t });
  state.ui.applyStaticText();
  state.ui.createPetals();
  wireGlobalButtons();

  if (configError) {
    state.ui.showError(`${state.t('errorData')}（${configError.message || configError}）`);
    return;
  }

  state.difficultyIds = ((config && config.difficulty) || []).map((item) => item.id);
  state.riddles = riddles;
  state.skipped = skipped;
  state.pools = groupByDifficulty(riddles, state.difficultyIds);
  state.store = createStore({
    keyPrefix: (config.storage && config.storage.keyPrefix) || 'lantern-riddle.',
    enabled: !(config.storage && config.storage.avoidRepeat === false),
  });

  if (!riddles.length) {
    state.ui.showError(state.t('errorPool'));
    return;
  }

  presentHome();
}

boot();
