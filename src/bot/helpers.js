/**
 * Bot Formatting and Progress Bar Helpers
 */

function renderProgressBar(percentage, length = 12) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const filledCount = Math.round((clamped / 100) * length);
  const emptyCount = Math.max(0, length - filledCount);
  const filledBar = '█'.repeat(filledCount);
  const emptyBar = '░'.repeat(emptyCount);
  return `[${filledBar}${emptyBar}] ${clamped}%`;
}

function calculateProgress(needed, received) {
  if (!needed || needed <= 0) return { progress: 100, remaining: 0 };
  const progress = Math.min(100, Math.round((received / needed) * 100));
  const remaining = Math.max(0, needed - received);
  return { progress, remaining };
}

module.exports = {
  renderProgressBar,
  calculateProgress,
};
