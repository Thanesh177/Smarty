// Server membership is supplied by a verified API authorizer, never the body.
export const PREMIUM_QUIZ_GROUP = 'SmartyPremium';

export function isPremiumQuizLevel(value) {
  return ['hard', 'challenge', 'advanced', 'expert'].includes(String(value || '').trim().toLowerCase());
}

export function hasPremiumQuizMembership(claims) {
  if (typeof claims?.sub !== 'string' || !claims.sub.trim()) return false;
  const raw = claims['cognito:groups'];
  const groups = Array.isArray(raw) ? raw : typeof raw === 'string'
    ? raw.replace(/^\[|\]$/g, '').split(',').map(value => value.trim().replace(/^['"]|['"]$/g, '')) : [];
  return groups.includes(PREMIUM_QUIZ_GROUP);
}

export function filterQuizQuestionsForAccess(questions, premiumAccess) {
  return (Array.isArray(questions) ? questions : []).filter(question => premiumAccess || !isPremiumQuizLevel(question?.difficulty));
}
