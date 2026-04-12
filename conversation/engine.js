import { detectIntent } from './intent.js';
import { decideStrategy } from './strategy.js';
import { createInitialConversationState, updateConversationState } from './state.js';

export function processConversation(transcript, previousState = createInitialConversationState()) {
  const intent = detectIntent(transcript);
  const strategy = decideStrategy(intent);
  const state = updateConversationState(previousState, transcript, {
    intent,
    strategy
  });

  return {
    intent,
    strategy,
    state
  };
}
