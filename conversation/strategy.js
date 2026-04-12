export function decideStrategy(intent) {
  switch (intent) {
    case 'support':
      return 'Be direct and helpful. Focus on solving the issue quickly. Avoid unnecessary small talk.';

    case 'buying':
      return 'Guide the customer. Ask helpful questions and highlight product benefits.';

    case 'warranty':
      return 'Provide clear information and guide toward completing the warranty process.';

    default:
      return 'Be friendly, natural, and helpful.';
  }
}
