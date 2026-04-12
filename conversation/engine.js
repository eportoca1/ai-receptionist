import { detectIntent } from './intent.js';
import { decideStrategy } from './strategy.js';

export function processConversation(transcript) {
  const intent = detectIntent(transcript);
  const strategy = decideStrategy(intent);

  return {
    intent,
    strategy
  };
}
