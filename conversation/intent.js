export function detectIntent(transcript) {
  const text = String(transcript || '').toLowerCase();

  if (
    text.includes('not working') ||
    text.includes('issue') ||
    text.includes('problem') ||
    text.includes('broken') ||
    text.includes('setup') ||
    text.includes('set up') ||
    text.includes('connect') ||
    text.includes('pair') ||
    text.includes("won't connect") ||
    text.includes('reset') ||
    text.includes('not connecting')
  ) {
    return 'support';
  }

  if (text.includes('price') || text.includes('how much') || text.includes('buy')) {
    return 'buying';
  }

  if (text.includes('warranty')) {
    return 'warranty';
  }

  return 'general';
}
