export const APP_LINK = 'https://smarty.wiki';
// Verified against the Android app's applicationId. Use HTTPS for a web fallback.
export const PLAY_REVIEW_LINK = 'https://play.google.com/store/apps/details?id=com.thanesh.smarty&showAllReviews=true';
export const SHARE_INVITATIONS = [
  { id: 'curiosity', label: 'For curious minds', text: 'I’m exploring Smarty—short reads, deeper explanations, and quizzes to keep learning. Find something that sparks your curiosity.' },
  { id: 'study', label: 'For a study partner', text: 'Want to learn something together? Try Smarty for learning posts, explanations, and practice quizzes.' },
  { id: 'news', label: 'For staying informed', text: 'I’ve been exploring Smarty for news briefings and the context behind a story. Take a look.' },
];
export function sharePayload(id = 'curiosity') {
  const invitation = SHARE_INVITATIONS.find(item => item.id === id) || SHARE_INVITATIONS[0];
  return { title: 'Smarty', text: invitation.text, url: APP_LINK };
}
export const shareText = id => { const data = sharePayload(id); return `${data.text}\n${data.url}`; };
export const shareEmail = id => `mailto:?subject=${encodeURIComponent('Something to explore on Smarty')}&body=${encodeURIComponent(shareText(id))}`;
export async function shareApp(id, browser = navigator) {
  if (typeof browser.share !== 'function') return 'unsupported';
  try { await browser.share(sharePayload(id)); return 'shared'; }
  catch (error) { if (error?.name === 'AbortError') return 'cancelled'; throw error; }
}
