export function createInitialConversationState() {
  return {
    currentIntent: 'general',
    currentStage: 'opening',
    lastStrategy: 'Be friendly, natural, and helpful.',
    lastTranscript: '',
    activeProductHint: ''
  };
}

function extractObviousProductHint(transcript = '') {
  const text = String(transcript || '').trim();
  if (!text) return '';

  const patterns = [
    /(?:setup|set up|connect|pair|reset)\s+(?:the|my)\s+([a-z0-9][a-z0-9\s-]{1,40})$/i,
    /(?:the|my)\s+([a-z0-9][a-z0-9\s-]{1,40}?)\s+(?:won't connect|wont connect|not connecting|not working|setup|set up|connect|pair|reset)\b/i,
    /,\s*the\s+([a-z0-9][a-z0-9\s-]{1,40})$/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].replace(/\s+/g, ' ').trim();
    }
  }

  return '';
}

export function updateConversationState(previousState, transcript, decision) {
  const safePreviousState = previousState || createInitialConversationState();
  const text = String(transcript || '');
  const normalized = text.toLowerCase();

  const nextState = {
    ...safePreviousState,
    currentIntent:
      decision.intent !== 'general'
        ? decision.intent
        : safePreviousState.currentIntent,
    lastStrategy: decision.strategy,
    lastTranscript: text
  };

  if (decision.intent === 'buying') {
    nextState.currentStage = 'discovery';
  } else if (decision.intent === 'support') {
    nextState.currentStage = 'troubleshooting';
  } else if (decision.intent === 'warranty') {
    nextState.currentStage = 'warranty';
  } else {
    nextState.currentStage = 'general';
  }

  const looksLikeProductOrSetupTurn =
    normalized.includes('setup') ||
    normalized.includes('set up') ||
    normalized.includes('connect') ||
    normalized.includes('pair') ||
    normalized.includes('reset') ||
    normalized.includes('product');

  if (looksLikeProductOrSetupTurn) {
    const newHint = extractObviousProductHint(text);
    nextState.activeProductHint = newHint || safePreviousState.activeProductHint || '';
  }

  return nextState;
}
