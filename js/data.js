/**
 * 数据加载、题目校验与本地存储外壳。
 * 配置与题库全部外置在 data/ 目录，前端只负责读取。
 */

export const DEFAULT_PATHS = {
  config: 'data/config.json',
  riddles: 'data/riddles.json',
};

export async function fetchJson(path) {
  let response;
  try {
    response = await fetch(path, { cache: 'no-cache' });
  } catch (error) {
    throw new Error(`无法读取 ${path}：${error && error.message ? error.message : error}`);
  }
  if (!response.ok) {
    throw new Error(`无法读取 ${path}（HTTP ${response.status}）`);
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${path} 不是合法的 JSON：${error && error.message ? error.message : error}`);
  }
}

/** 校验单条题目；不合格的题目会被跳过而不是让整局崩掉 */
export function validateRiddle(raw, difficultyIds) {
  if (!raw || typeof raw !== 'object') return { ok: false, id: '', reason: '条目不是对象' };

  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) return { ok: false, id: '', reason: '缺少 id' };

  const difficulty = typeof raw.difficulty === 'string' ? raw.difficulty.trim() : '';
  if (!difficultyIds.includes(difficulty)) {
    return { ok: false, id, reason: `difficulty 非法：${difficulty || '空'}` };
  }

  const type = raw.type === 'choice' || raw.type === 'fill' ? raw.type : '';
  if (!type) return { ok: false, id, reason: `type 非法：${String(raw.type)}` };

  for (const key of ['question', 'topic', 'answer', 'explanation']) {
    if (typeof raw[key] !== 'string' || !raw[key].trim()) {
      return { ok: false, id, reason: `${key} 为空` };
    }
  }

  const answer = String(raw.answer).trim();
  let options = [];
  const acceptedAnswers = [];

  if (type === 'choice') {
    if (!Array.isArray(raw.options) || raw.options.length < 2) {
      return { ok: false, id, reason: '选择题缺少 options' };
    }
    options = raw.options
      .filter((value) => value !== null && value !== undefined)
      .map((value) => String(value))
      .filter((value) => value.trim() !== '');
    if (!options.includes(answer)) {
      return { ok: false, id, reason: 'options 中不含正确答案' };
    }
  } else {
    if (raw.acceptedAnswers !== undefined && !Array.isArray(raw.acceptedAnswers)) {
      return { ok: false, id, reason: 'acceptedAnswers 必须是数组' };
    }
    if (Array.isArray(raw.acceptedAnswers)) {
      for (const value of raw.acceptedAnswers) {
        if (value === null || value === undefined) continue;
        const text = String(value).trim();
        if (text) acceptedAnswers.push(text);
      }
    }
    if (!acceptedAnswers.includes(answer)) acceptedAnswers.unshift(answer);
  }

  return {
    ok: true,
    riddle: {
      id,
      difficulty,
      type,
      topic: raw.topic.trim(),
      question: raw.question.trim(),
      answer,
      explanation: raw.explanation.trim(),
      options,
      acceptedAnswers,
    },
  };
}

export function prepareRiddles(payload, difficultyIds) {
  const list = payload && Array.isArray(payload.riddles) ? payload.riddles : [];
  const seen = new Set();
  const riddles = [];
  const skipped = [];

  list.forEach((raw, index) => {
    const result = validateRiddle(raw, difficultyIds);
    if (!result.ok) {
      skipped.push({ id: result.id || `#${index + 1}`, reason: result.reason });
      return;
    }
    if (seen.has(result.riddle.id)) {
      skipped.push({ id: result.riddle.id, reason: 'id 重复' });
      return;
    }
    seen.add(result.riddle.id);
    riddles.push(result.riddle);
  });

  return { riddles, skipped };
}

export function groupByDifficulty(riddles, difficultyIds) {
  const pools = new Map();
  for (const id of difficultyIds) pools.set(id, []);
  for (const riddle of riddles) {
    const pool = pools.get(riddle.difficulty);
    if (pool) pool.push(riddle);
  }
  return pools;
}

/** localStorage 外壳：隐私模式或被禁用时静默降级 */
export function createStore({ keyPrefix = 'lantern-riddle.', enabled = true } = {}) {
  const canUse = (() => {
    if (!enabled) return false;
    try {
      const probe = `${keyPrefix}probe`;
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch (error) {
      return false;
    }
  })();

  const recentKey = `${keyPrefix}recent`;

  return {
    available: canUse,
    readRecentIds() {
      if (!canUse) return [];
      try {
        const raw = window.localStorage.getItem(recentKey);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch (error) {
        return [];
      }
    },
    writeRecentIds(ids) {
      if (!canUse) return;
      try {
        window.localStorage.setItem(recentKey, JSON.stringify(ids.slice(0, 400)));
      } catch (error) {
        /* 写不进去就算了，不影响答题 */
      }
    },
  };
}

export async function loadSiteData(paths = DEFAULT_PATHS) {
  const [config, riddlePayload] = await Promise.all([
    fetchJson(paths.config),
    fetchJson(paths.riddles),
  ]);
  return { config, riddlePayload };
}
