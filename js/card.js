/**
 * 成绩图：用 Canvas 本地绘制竖版 PNG，不依赖任何外部资源。
 * 高度随内容变化：错题越多，图片越长，不会把错题截掉。
 */

import { formatPercent } from './scoring.js';
import { formatDate, formatDuration } from './render.js';

const SERIF = '"Songti SC", "STSong", "SimSun", "Noto Serif SC", serif';
const KAI = '"Kaiti SC", "STKaiti", "KaiTi", "Songti SC", serif';
const DESIGN_WIDTH = 1080;

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** 按字符宽度换行，中文谜面与西文词都能排开 */
function wrapText(ctx, text, maxWidth) {
  const chars = Array.from(String(text === null || text === undefined ? '' : text));
  const lines = [];
  let line = '';
  for (const char of chars) {
    if (char === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    const candidate = line + char;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line = candidate;
    }
  }
  lines.push(line);
  return lines.length ? lines : [''];
}

function drawNightSky(ctx, width, height) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#0a1026');
  sky.addColorStop(0.45, '#16203f');
  sky.addColorStop(1, '#080d1f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const halo = ctx.createRadialGradient(
    width * 0.76,
    height * 0.1,
    0,
    width * 0.76,
    height * 0.1,
    Math.max(620, height * 0.4)
  );
  halo.addColorStop(0, 'rgba(255, 214, 140, 0.26)');
  halo.addColorStop(1, 'rgba(255, 214, 140, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);

  const starCount = Math.round(220 * (height / 1920) + 60);
  for (let i = 0; i < starCount; i += 1) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 248, 232, ${(0.22 + Math.random() * 0.6).toFixed(2)})`;
    ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 2.4 + 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const glowCount = Math.round(26 * (height / 1920) + 8);
  for (let i = 0; i < glowCount; i += 1) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 214, 140, ${(0.1 + Math.random() * 0.2).toFixed(2)})`;
    ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 7 + 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMoon(ctx, x, y, radius) {
  const glow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 2.6);
  glow.addColorStop(0, 'rgba(255, 226, 165, 0.42)');
  glow.addColorStop(1, 'rgba(255, 226, 165, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.6, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.35, radius * 0.15, x, y, radius);
  body.addColorStop(0, '#fff9e6');
  body.addColorStop(0.55, '#ffe9b0');
  body.addColorStop(1, '#efc983');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(214, 176, 108, 0.35)';
  [
    [-0.32, -0.18, 0.16],
    [0.24, 0.1, 0.12],
    [0.02, 0.42, 0.09],
    [-0.12, 0.55, 0.06],
  ].forEach(([dx, dy, r]) => {
    ctx.beginPath();
    ctx.arc(x + dx * radius, y + dy * radius, r * radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawLantern(ctx, x, y, width) {
  const height = width * 1.24;
  const capHeight = Math.max(10, width * 0.11);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 217, 138, 0.75)';
  ctx.lineWidth = Math.max(3, width * 0.028);
  ctx.beginPath();
  ctx.moveTo(x, y - height * 1.5);
  ctx.lineTo(x, y - height * 0.62);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 217, 138, 0.9)';
  ctx.fillRect(x - width * 0.42, y - height * 0.64, width * 0.84, capHeight);

  const body = ctx.createRadialGradient(x - width * 0.2, y - height * 0.16, 6, x, y, width * 0.72);
  body.addColorStop(0, 'rgba(255, 232, 178, 0.98)');
  body.addColorStop(0.6, 'rgba(255, 158, 61, 0.94)');
  body.addColorStop(1, 'rgba(226, 92, 44, 0.92)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x, y, width * 0.5, height * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 217, 138, 0.8)';
  ctx.lineWidth = Math.max(2, width * 0.022);
  for (const offset of [-0.28, 0, 0.28]) {
    ctx.beginPath();
    ctx.ellipse(x + offset * width, y, width * 0.16, height * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 217, 138, 0.9)';
  ctx.fillRect(x - width * 0.42, y + height * 0.5 - capHeight, width * 0.84, capHeight);
  ctx.strokeStyle = 'rgba(255, 217, 138, 0.75)';
  ctx.beginPath();
  ctx.moveTo(x, y + height * 0.54);
  ctx.lineTo(x, y + height * 0.86);
  ctx.stroke();
  ctx.restore();
}

function drawCenteredText(ctx, text, y, font, color, maxWidth) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, ctx.canvas.width / 2, y, maxWidth);
}

/**
 * 画成绩图。错题会全部列出，图片高度随错题数量增长。
 * @param {HTMLCanvasElement} canvas
 * @param {{config: object, t: Function, stats: object, difficultyText: string, entries?: object[]}} options
 */
export function drawScoreCard(canvas, { config, t, stats, difficultyText, entries = [] }) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持 Canvas 2D');

  const width = canvas.width;
  const scale = width / DESIGN_WIDTH;
  const u = (value) => value * scale;
  const pad = u(110);
  const contentWidth = width - pad * 2;

  /* ---------- 一、先量一遍错题，算出整张图的高度 ---------- */
  const questionFont = `400 ${u(40)}px ${SERIF}`;
  const headLineHeight = u(46);
  const lineHeight = u(58);
  const answerLineHeight = u(62);
  const itemPadding = u(42);
  const itemGap = u(30);
  const questionMaxWidth = contentWidth - u(76);

  const wrongs = (Array.isArray(entries) ? entries : [])
    .map((entry, index) => ({ entry, index: index + 1 }))
    .filter((item) => !item.entry.correct)
    .map((item) => {
      ctx.font = questionFont;
      return {
        index: item.index,
        topic: item.entry.riddle.topic,
        answer: item.entry.riddle.answer,
        lines: wrapText(ctx, item.entry.riddle.question, questionMaxWidth),
      };
    });

  const itemHeights = wrongs.map(
    (item) => itemPadding * 2 + headLineHeight + item.lines.length * lineHeight + answerLineHeight
  );
  const listHeight = itemHeights.reduce((sum, value) => sum + value, 0);
  const listGaps = wrongs.length > 1 ? itemGap * (wrongs.length - 1) : 0;

  /* ---------- 二、纵向排版（坐标按 1080 宽设计稿等比缩放） ---------- */
  const yTitle = u(806);
  const yTip = u(880);
  const yDivider = u(950);
  const yScoreLabel = u(1040);
  const yScore = u(1175);
  const yScoreSub = u(1306);
  const statsStart = u(1408);
  const statsStep = u(78);
  const statsRows = 4;
  const ySectionTitle = statsStart + statsStep * (statsRows - 1) + u(126);
  const listTop = ySectionTitle + u(96);
  const listBottom = wrongs.length ? listTop + listHeight + listGaps : listTop + u(96);
  const yFooter = listBottom + u(112);

  const height = Math.round(Math.max(u(1920), yFooter + u(90)));
  canvas.height = height;

  /* ---------- 三、背景与装饰 ---------- */
  drawNightSky(ctx, width, height);
  drawMoon(ctx, width * 0.78, u(170), u(170));
  drawLantern(ctx, u(130), u(300), u(150));
  drawLantern(ctx, width - u(140), u(640), u(118));

  /* ---------- 四、标题与成绩 ---------- */
  drawCenteredText(ctx, config.site.title, yTitle, `700 ${u(84)}px ${SERIF}`, '#ffeec2', contentWidth);
  drawCenteredText(
    ctx,
    t('cardTip'),
    yTip,
    `400 ${u(40)}px ${KAI}`,
    'rgba(247, 241, 230, 0.72)',
    contentWidth
  );

  ctx.strokeStyle = 'rgba(255, 217, 138, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.2, yDivider);
  ctx.lineTo(width * 0.8, yDivider);
  ctx.stroke();

  drawCenteredText(
    ctx,
    t('resultScoreLabel'),
    yScoreLabel,
    `400 ${u(40)}px ${SERIF}`,
    'rgba(247, 241, 230, 0.6)',
    contentWidth
  );
  drawCenteredText(ctx, `${stats.score}`, yScore, `700 ${u(190)}px ${SERIF}`, '#fff3d3', contentWidth);
  drawCenteredText(
    ctx,
    t('cardScore', { score: stats.score, max: stats.maxScore }),
    yScoreSub,
    `400 ${u(36)}px ${SERIF}`,
    'rgba(255, 217, 138, 0.9)',
    contentWidth
  );

  const statLines = [
    t('cardAccuracy', { accuracy: formatPercent(stats.accuracy) }),
    t('cardTime', { time: formatDuration(stats.totalSeconds, t) }),
    `${(config.text && config.text.difficultyLabel) || '难度'}：${difficultyText}`,
    t('cardDate', { date: formatDate() }),
  ];
  statLines.forEach((row, index) => {
    drawCenteredText(
      ctx,
      row,
      statsStart + statsStep * index,
      `400 ${u(42)}px ${SERIF}`,
      index === statLines.length - 1 ? 'rgba(247, 241, 230, 0.6)' : 'rgba(247, 241, 230, 0.9)',
      contentWidth
    );
  });

  /* ---------- 五、错题回顾 ---------- */
  drawCenteredText(
    ctx,
    t('cardWrongTitle'),
    ySectionTitle,
    `700 ${u(46)}px ${SERIF}`,
    wrongs.length ? '#ffd08a' : '#7fd1b9',
    contentWidth
  );

  if (!wrongs.length) {
    drawCenteredText(
      ctx,
      t('cardAllRight'),
      listTop + u(30),
      `400 ${u(40)}px ${KAI}`,
      'rgba(247, 241, 230, 0.78)',
      contentWidth
    );
  } else {
    let cursor = listTop;
    wrongs.forEach((item, itemIndex) => {
      const itemHeight = itemHeights[itemIndex];

      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      roundedRect(ctx, pad, cursor, contentWidth, itemHeight, u(18));
      ctx.fill();
      ctx.strokeStyle = 'rgba(247, 241, 230, 0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 154, 154, 0.85)';
      roundedRect(ctx, pad, cursor, u(9), itemHeight, u(4));
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `400 ${u(30)}px ${SERIF}`;
      ctx.fillStyle = 'rgba(247, 241, 230, 0.58)';
      ctx.fillText(
        t('cardWrongItem', { index: item.index, topic: item.topic }),
        pad + u(38),
        cursor + itemPadding + headLineHeight / 2
      );

      ctx.font = questionFont;
      ctx.fillStyle = '#f7f1e6';
      item.lines.forEach((line, lineIndex) => {
        ctx.fillText(
          line,
          pad + u(38),
          cursor + itemPadding + headLineHeight + lineHeight * (lineIndex + 0.5)
        );
      });

      ctx.font = `400 ${u(38)}px ${SERIF}`;
      ctx.fillStyle = 'rgba(255, 217, 138, 0.95)';
      ctx.fillText(
        t('answerIs', { answer: item.answer }),
        pad + u(38),
        cursor + itemPadding + headLineHeight + item.lines.length * lineHeight + answerLineHeight / 2
      );

      cursor += itemHeight + itemGap;
    });
  }

  /* ---------- 六、落款 ---------- */
  drawCenteredText(
    ctx,
    config.site.subtitle,
    yFooter,
    `400 ${u(34)}px ${KAI}`,
    'rgba(247, 241, 230, 0.55)',
    contentWidth
  );

  const url = (config.site && config.site.url) || '';
  if (url) {
    drawCenteredText(
      ctx,
      url,
      yFooter + u(48),
      `400 ${u(28)}px ${SERIF}`,
      'rgba(255, 217, 138, 0.6)',
      contentWidth
    );
  }

  return canvas;
}

export function downloadCanvas(canvas, filename) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('导出图片失败'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
        resolve(true);
      }, 'image/png');
    } catch (error) {
      reject(error);
    }
  });
}
