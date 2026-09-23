/**
 * DOM 渲染层：把状态画成界面，不参与任何规则判断。
 */

import { formatPercent } from './scoring.js';

const TIMER_CIRCUMFERENCE = 2 * Math.PI * 31;

export function createTranslator(table) {
  const source = table && typeof table === 'object' ? table : {};
  return function t(key, params) {
    const raw = Object.prototype.hasOwnProperty.call(source, key) ? source[key] : key;
    if (!params) return String(raw);
    return String(raw).replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
    );
  };
}

export function formatDuration(seconds, t) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (total < 60) return t('seconds', { n: total });
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return t('minutesSeconds', { m: minutes, s: rest });
}

export function formatDate(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function createUI({ config, t }) {
  const byId = (id) => document.getElementById(id);

  const refs = {
    masthead: document.querySelector('.masthead'),
    siteTitle: byId('siteTitle'),
    siteSubtitle: byId('siteSubtitle'),
    siteFooter: byId('siteFooter'),
    loadingText: byId('loadingText'),
    homeTitle: byId('homeTitle'),
    homeHint: byId('homeHint'),
    difficultyGrid: byId('difficultyGrid'),
    skippedNotice: byId('skippedNotice'),
    progressLabel: byId('progressLabel'),
    scoreLabel: byId('scoreLabel'),
    quitBtn: byId('quitBtn'),
    timerWrap: byId('timerWrap'),
    timerRing: byId('timerRing'),
    timerText: byId('timerText'),
    topicLabel: byId('topicLabel'),
    questionText: byId('questionText'),
    answerArea: byId('answerArea'),
    hintText: byId('hintText'),
    revealBox: byId('revealBox'),
    revealVerdict: byId('revealVerdict'),
    revealAnswer: byId('revealAnswer'),
    revealPoints: byId('revealPoints'),
    revealExplanation: byId('revealExplanation'),
    nextBtn: byId('nextBtn'),
    liveRegion: byId('liveRegion'),
    resultTitle: byId('resultTitle'),
    resultScoreLabel: byId('resultScoreLabel'),
    resultScore: byId('resultScore'),
    resultSub: byId('resultSub'),
    accuracyLabel: byId('accuracyLabel'),
    resultAccuracy: byId('resultAccuracy'),
    timeLabel: byId('timeLabel'),
    resultTime: byId('resultTime'),
    difficultyStatLabel: byId('difficultyStatLabel'),
    resultDifficulty: byId('resultDifficulty'),
    playAgainBtn: byId('playAgainBtn'),
    changeDifficultyBtn: byId('changeDifficultyBtn'),
    downloadCardBtn: byId('downloadCardBtn'),
    cardNotice: byId('cardNotice'),
    reviewTitle: byId('reviewTitle'),
    reviewList: byId('reviewList'),
    errorTitle: byId('errorTitle'),
    errorMessage: byId('errorMessage'),
    retryBtn: byId('retryBtn'),
    errorHomeBtn: byId('errorHomeBtn'),
    confirmOverlay: byId('confirmOverlay'),
    confirmTitle: byId('confirmTitle'),
    confirmBody: byId('confirmBody'),
    confirmNo: byId('confirmNo'),
    confirmYes: byId('confirmYes'),
    cardCanvas: byId('cardCanvas'),
    petals: byId('petals'),
  };

  const screens = {
    loading: byId('screenLoading'),
    home: byId('screenHome'),
    play: byId('screenPlay'),
    result: byId('screenResult'),
    error: byId('screenError'),
  };

  let optionButtons = [];

  function showScreen(name) {
    Object.entries(screens).forEach(([key, node]) => {
      if (node) node.hidden = key !== name;
    });
    // 答题界面不再保留大标题，把纵向空间让给谜面、选项与解析
    if (refs.masthead) refs.masthead.hidden = name === 'play';
    if (name !== 'play') resetScroll();
  }

  function resetScroll() {
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function applyStaticText() {
    const site = (config && config.site) || {};
    const text = (config && config.text) || {};
    const round = (config && config.round) || {};
    const timer = (config && config.timer) || {};

    if (site.lang) document.documentElement.lang = site.lang;
    if (site.title) document.title = site.title;
    if (refs.siteTitle && site.title) refs.siteTitle.textContent = site.title;
    if (refs.siteSubtitle && site.subtitle) refs.siteSubtitle.textContent = site.subtitle;
    if (refs.siteFooter && site.footer) refs.siteFooter.textContent = site.footer;
    if (refs.loadingText) refs.loadingText.textContent = t('loading');

    if (refs.homeTitle) refs.homeTitle.textContent = t('homeTitle');
    if (refs.homeHint) {
      refs.homeHint.textContent = t('homeHint', {
        roundSize: round.roundSize,
        choiceSeconds: timer.choice,
        fillSeconds: timer.fill,
      });
    }

    if (refs.quitBtn) refs.quitBtn.textContent = t('quit');
    if (refs.confirmTitle) refs.confirmTitle.textContent = t('quitTitle');
    if (refs.confirmBody) refs.confirmBody.textContent = t('quitBody');
    if (refs.confirmNo) refs.confirmNo.textContent = t('quitNo');
    if (refs.confirmYes) refs.confirmYes.textContent = t('quitYes');

    if (refs.resultTitle) refs.resultTitle.textContent = t('resultTitle');
    if (refs.resultScoreLabel) refs.resultScoreLabel.textContent = t('resultScoreLabel');
    if (refs.accuracyLabel) refs.accuracyLabel.textContent = t('accuracy');
    if (refs.timeLabel) refs.timeLabel.textContent = t('timeUsed');
    if (refs.difficultyStatLabel) refs.difficultyStatLabel.textContent = text.difficultyLabel || '难度';
    if (refs.playAgainBtn) refs.playAgainBtn.textContent = t('playAgain');
    if (refs.changeDifficultyBtn) refs.changeDifficultyBtn.textContent = t('changeDifficulty');
    if (refs.downloadCardBtn) refs.downloadCardBtn.textContent = t('downloadCard');
    if (refs.reviewTitle) refs.reviewTitle.textContent = t('review');

    if (refs.errorTitle) refs.errorTitle.textContent = t('errorTitle');
    if (refs.retryBtn) refs.retryBtn.textContent = t('retry');
    if (refs.errorHomeBtn) refs.errorHomeBtn.textContent = t('backHome');
  }

  function createPetals() {
    const container = refs.petals;
    if (!container) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const count = reduce ? 6 : 18;
    container.textContent = '';
    for (let i = 0; i < count; i += 1) {
      const petal = document.createElement('span');
      petal.className = 'petal';
      petal.style.left = `${Math.round(Math.random() * 100)}%`;
      petal.style.animationDuration = `${9 + Math.random() * 9}s`;
      petal.style.animationDelay = `${(-Math.random() * 14).toFixed(2)}s`;
      petal.style.transform = `scale(${(0.6 + Math.random() * 0.8).toFixed(2)})`;
      container.appendChild(petal);
    }
  }

  function renderHome({ mixed, onStart, skipped }) {
    const grid = refs.difficultyGrid;
    if (!grid) return;
    grid.textContent = '';

    for (const item of (config.difficulty || [])) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `difficulty-card difficulty-card--${item.id}`;
      button.dataset.difficulty = item.id;

      const badge = document.createElement('span');
      badge.className = 'difficulty-card__badge';
      badge.textContent = item.label || item.id;

      const name = document.createElement('span');
      name.className = 'difficulty-card__name';
      name.textContent = item.name || item.id;

      const desc = document.createElement('span');
      desc.className = 'difficulty-card__desc';
      desc.textContent = item.description || '';

      const text = document.createElement('span');
      text.className = 'difficulty-card__text';
      text.append(name, desc);

      button.append(badge, text);
      button.addEventListener('click', () => onStart(item.id));
      grid.appendChild(button);
    }

    if (mixed && mixed.enabled) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'difficulty-card difficulty-card--mixed';
      button.dataset.difficulty = mixed.id;

      const badge = document.createElement('span');
      badge.className = 'difficulty-card__badge';
      badge.textContent = mixed.label || '混';

      const name = document.createElement('span');
      name.className = 'difficulty-card__name';
      name.textContent = mixed.name || '混合模式';

      const desc = document.createElement('span');
      desc.className = 'difficulty-card__desc';
      desc.textContent = mixed.description || '';

      const text = document.createElement('span');
      text.className = 'difficulty-card__text';
      text.append(name, desc);

      button.append(badge, text);
      button.addEventListener('click', () => onStart(mixed.id));
      grid.appendChild(button);
    }

    if (refs.skippedNotice) {
      if (skipped && skipped.length) {
        refs.skippedNotice.hidden = false;
        refs.skippedNotice.textContent = t('errorSkipped', { n: skipped.length });
      } else {
        refs.skippedNotice.hidden = true;
        refs.skippedNotice.textContent = '';
      }
    }
  }

  function renderQuestion({
    riddle,
    index,
    total,
    difficultyText,
    score,
    timerSeconds,
    options,
    onChoice,
    onSubmitFill,
  }) {
    resetScroll();
    if (refs.progressLabel) {
      const step = t('progress', { current: index + 1, total });
      refs.progressLabel.textContent = difficultyText
        ? t('progressWithDifficulty', { difficulty: difficultyText, progress: step })
        : step;
    }
    if (refs.scoreLabel) refs.scoreLabel.textContent = `${t('scoreLabel')} ${score}`;
    if (refs.topicLabel) refs.topicLabel.textContent = riddle.topic;
    if (refs.questionText) refs.questionText.textContent = riddle.question;

    if (refs.hintText) {
      refs.hintText.hidden = true;
      refs.hintText.textContent = '';
    }
    if (refs.revealBox) {
      refs.revealBox.hidden = true;
      refs.revealBox.className = 'reveal';
    }
    if (refs.nextBtn) refs.nextBtn.onclick = null;

    updateTimer(timerSeconds * 1000, timerSeconds * 1000);

    const area = refs.answerArea;
    if (!area) return;
    area.textContent = '';
    optionButtons = [];

    if (riddle.type === 'choice') {
      (options || []).forEach((option, optionIndex) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'option';
        button.dataset.value = option;

        const badge = document.createElement('span');
        badge.className = 'option__index';
        badge.textContent = String(optionIndex + 1);

        const label = document.createElement('span');
        label.textContent = option;

        button.append(badge, label);
        button.addEventListener('click', () => onChoice(option, button));
        area.appendChild(button);
        optionButtons.push(button);
      });
      const first = optionButtons[0];
      if (first) first.focus({ preventScroll: true });
    } else {
      const form = document.createElement('form');
      form.className = 'fill';
      form.autocomplete = 'off';

      const row = document.createElement('div');
      row.className = 'fill__row';

      const input = document.createElement('input');
      input.className = 'fill__input';
      input.type = 'text';
      input.name = 'answer';
      input.enterKeyHint = 'done';
      input.autocomplete = 'off';
      input.autocapitalize = 'off';
      input.spellcheck = false;
      input.placeholder = t('answerPlaceholder');
      input.setAttribute('aria-label', t('answerPlaceholder'));

      const submit = document.createElement('button');
      submit.className = 'btn btn--primary';
      submit.type = 'submit';
      submit.textContent = t('submit');

      row.append(input, submit);
      form.appendChild(row);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        onSubmitFill(input.value);
      });
      area.appendChild(form);
    }
  }

  function lockAnswer() {
    optionButtons.forEach((button) => {
      button.disabled = true;
    });
    const input = refs.answerArea ? refs.answerArea.querySelector('.fill__input') : null;
    const submit = refs.answerArea ? refs.answerArea.querySelector('button[type="submit"]') : null;
    if (input) input.disabled = true;
    if (submit) submit.disabled = true;
  }

  function markOption(button, kind) {
    if (!button) return;
    if (kind === 'correct') button.classList.add('option--correct');
    if (kind === 'wrong') button.classList.add('option--wrong');
  }

  function highlightCorrectOption(answer) {
    optionButtons.forEach((button) => {
      if (button.dataset.value === answer) button.classList.add('option--correct');
    });
  }

  function markFillInput(kind) {
    const input = refs.answerArea ? refs.answerArea.querySelector('.fill__input') : null;
    if (!input) return;
    if (kind === 'wrong') input.classList.add('fill__input--wrong');
    if (kind === 'correct') input.classList.add('fill__input--correct');
  }

  function clearFillInput() {
    const input = refs.answerArea ? refs.answerArea.querySelector('.fill__input') : null;
    if (!input) return;
    input.value = '';
    input.focus({ preventScroll: true });
  }

  function readFillValue() {
    const input = refs.answerArea ? refs.answerArea.querySelector('.fill__input') : null;
    return input ? String(input.value || '') : '';
  }

  function updateTimer(remainingMs, totalMs) {
    if (!refs.timerRing || !refs.timerText) return;
    const ratio = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
    refs.timerRing.style.strokeDasharray = String(TIMER_CIRCUMFERENCE);
    refs.timerRing.style.strokeDashoffset = String(TIMER_CIRCUMFERENCE * (1 - ratio));
    const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
    refs.timerText.textContent = String(seconds);
    if (refs.timerWrap) {
      refs.timerWrap.classList.toggle('timer--warn', remainingMs <= 10000 && remainingMs > 5000);
      refs.timerWrap.classList.toggle('timer--danger', remainingMs <= 5000);
    }
  }

  function showHint(text) {
    if (!refs.hintText) return;
    refs.hintText.textContent = text;
    refs.hintText.hidden = false;
  }

  function showReveal({ kind, answerText, points, explanation, isLast, onNext }) {
    const box = refs.revealBox;
    if (!box) return;
    box.hidden = false;
    box.className = `reveal reveal--${kind}`;
    if (refs.revealVerdict) {
      refs.revealVerdict.textContent =
        kind === 'correct' ? t('correct') : kind === 'timeout' ? t('timeout') : t('wrong');
    }
    if (refs.revealAnswer) refs.revealAnswer.textContent = t('answerIs', { answer: answerText });
    if (refs.revealPoints) {
      refs.revealPoints.textContent = points > 0 ? t('gain', { points }) : '';
    }
    if (refs.revealExplanation) {
      refs.revealExplanation.textContent = `${t('explanationLabel')}：${explanation}`;
    }
    if (refs.nextBtn) {
      refs.nextBtn.textContent = isLast ? t('seeResult') : t('next');
      refs.nextBtn.onclick = onNext;
      refs.nextBtn.focus({ preventScroll: true });
    }
    revealIntoView(box);
  }

  /** 解析不在视野里时自动滚过来，省掉手动下滑 */
  function revealIntoView(node) {
    if (!node || typeof node.getBoundingClientRect !== 'function') return;
    window.requestAnimationFrame(() => {
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight || document.documentElement.clientHeight;
      if (rect.bottom <= viewport + 4 && rect.top >= -4) return;
      const reduce =
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      node.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    });
  }

  function renderResult({ stats, entries, onPlayAgain, onChangeDifficulty, onDownloadCard, difficultyText }) {
    if (refs.resultScore) refs.resultScore.textContent = String(stats.score);
    if (refs.resultSub) {
      refs.resultSub.textContent = t('resultSub', {
        correct: stats.correct,
        total: stats.total,
        max: stats.maxScore,
      });
    }
    if (refs.resultAccuracy) refs.resultAccuracy.textContent = formatPercent(stats.accuracy);
    if (refs.resultTime) refs.resultTime.textContent = formatDuration(stats.totalSeconds, t);
    if (refs.resultDifficulty) refs.resultDifficulty.textContent = difficultyText;
    if (refs.cardNotice) {
      refs.cardNotice.hidden = true;
      refs.cardNotice.textContent = '';
    }

    const list = refs.reviewList;
    if (list) {
      list.textContent = '';
      entries.forEach((entry, index) => {
        const li = document.createElement('li');
        li.className = `review__item${entry.correct ? '' : ' review__item--wrong'}`;

        const head = document.createElement('div');
        head.className = 'review__head';
        const title = document.createElement('span');
        title.textContent = `第 ${index + 1} 题 · ${entry.riddle.topic}`;
        const points = document.createElement('span');
        points.className = 'review__points';
        points.textContent = t('gain', { points: entry.points });
        head.append(title, points);

        const question = document.createElement('p');
        question.className = 'review__question';
        question.textContent = entry.riddle.question;

        const answerLine = document.createElement('p');
        answerLine.className = 'review__line review__line--answer';
        answerLine.textContent = t('answerIs', { answer: entry.riddle.answer });

        const explanation = document.createElement('p');
        explanation.className = 'review__explanation';
        explanation.textContent = entry.riddle.explanation;

        li.append(head, question);
        if (!entry.correct) {
          const yourLine = document.createElement('p');
          yourLine.className = 'review__line';
          const yourLabel = document.createElement('b');
          yourLabel.textContent = `${t('yourAnswer')}：`;
          yourLine.append(
            yourLabel,
            document.createTextNode(entry.answerText ? entry.answerText : t('unanswered'))
          );
          li.append(yourLine);
        }
        li.append(answerLine, explanation);
        list.appendChild(li);
      });
    }

    if (refs.playAgainBtn) refs.playAgainBtn.onclick = onPlayAgain;
    if (refs.changeDifficultyBtn) refs.changeDifficultyBtn.onclick = onChangeDifficulty;
    if (refs.downloadCardBtn) refs.downloadCardBtn.onclick = onDownloadCard;
  }

  function showCardNotice(text, kind = 'info') {
    if (!refs.cardNotice) return;
    refs.cardNotice.hidden = false;
    refs.cardNotice.textContent = text;
    refs.cardNotice.style.color = kind === 'error' ? 'var(--danger)' : '#ffe6c2';
  }

  function showError(message) {
    if (refs.errorMessage) refs.errorMessage.textContent = message;
    showScreen('error');
  }

  function announce(message) {
    if (!refs.liveRegion) return;
    refs.liveRegion.textContent = '';
    window.setTimeout(() => {
      refs.liveRegion.textContent = message;
    }, 30);
  }

  function openConfirm() {
    if (!refs.confirmOverlay) return;
    refs.confirmOverlay.hidden = false;
    if (refs.confirmNo) refs.confirmNo.focus({ preventScroll: true });
  }

  function closeConfirm() {
    if (!refs.confirmOverlay) return;
    refs.confirmOverlay.hidden = true;
  }

  function setQuitEnabled(enabled) {
    if (refs.quitBtn) refs.quitBtn.disabled = !enabled;
  }

  return {
    refs,
    showScreen,
    applyStaticText,
    createPetals,
    renderHome,
    renderQuestion,
    lockAnswer,
    markOption,
    highlightCorrectOption,
    markFillInput,
    clearFillInput,
    readFillValue,
    updateTimer,
    showHint,
    showReveal,
    renderResult,
    showCardNotice,
    showError,
    announce,
    openConfirm,
    closeConfirm,
    setQuitEnabled,
    get optionButtons() {
      return optionButtons;
    },
  };
}
