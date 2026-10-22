export const DELETION_EMAIL = 'ntthanesh@gmail.com';
export const DELETION_URLS = Object.freeze({
  account: 'https://smarty.wiki/delete-account.html',
  data: 'https://smarty.wiki/delete-data.html',
});

const paths = new Map([
  ['/delete-account', 'account'], ['/delete-account.html', 'account'],
  ['/account-deletion', 'account'], ['/account-deletion.html', 'account'],
  ['/delete-data', 'data'], ['/delete-data.html', 'data'],
  ['/data-deletion', 'data'], ['/data-deletion.html', 'data'],
]);

export function getDeletionPageKind(pathname) {
  return paths.get(String(pathname || '').replace(/\/+$/, '')) || null;
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

export function deletionRequestUrl(kind) {
  const account = kind === 'account';
  const subject = account ? 'Smarty account and associated data deletion request' : 'Smarty selected data deletion request';
  const body = [
    account ? 'Please delete my Smarty account and its associated personal data.' : 'Please delete the selected data below while keeping my Smarty account.',
    '', 'Smarty account email (including an Apple private relay email, if used):',
    'Smarty username, if known:',
    ...(!account ? ['', 'Data to delete and relevant post/message identifiers, if known:'] : []),
    '', 'Please verify my ownership and confirm when this request is complete.',
    'I have not included a password, verification code or payment information.',
  ].join('\r\n');
  return `mailto:${DELETION_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function deletionPageTitle(kind) {
  return kind === 'data' ? 'Delete selected Smarty data' : 'Delete your Smarty account';
}

// This markup is authored here, not accepted from a user or a remote service.
// The same content powers standalone, JavaScript-free pages and SPA fallbacks.
export function renderDeletionContent(kind) {
  if (!['account', 'data'].includes(kind)) throw new Error('Unknown deletion page');
  const account = kind === 'account';
  return `<a class="deletion-skip" href="#deletion-main">Skip to deletion instructions</a>
  <div class="deletion-container">
    <header class="deletion-header"><a href="/feed?topic=All" class="deletion-brand" aria-label="Smarty home"><span aria-hidden="true">S</span>Smarty</a><span>Privacy &amp; account controls</span></header>
    <main id="deletion-main" tabindex="-1">
      <p class="deletion-eyebrow">Your data. Your choice.</p>
      <h1>${deletionPageTitle(kind)}</h1>
      <p class="deletion-lead">${account ? 'Request permanent deletion of your Smarty account and associated personal data.' : 'Request deletion of specific Smarty data without deleting your entire account.'} You do not need to install the app or sign in to send a request.</p>
      <section class="deletion-request" aria-labelledby="request-heading">
        <h2 id="request-heading">Send a deletion request</h2>
        <p>Email us from the address linked to your Smarty account. Include your account email and, if known, your username.${account ? '' : ' Tell us which data you want deleted and provide relevant post or message details where possible.'}</p>
        <a class="deletion-action" href="${escapeHtml(deletionRequestUrl(kind))}">${account ? 'Request account deletion' : 'Request selected data deletion'} <span aria-hidden="true">↗</span></a>
        <p class="deletion-hint">This opens your email app. <strong>Send the email to submit your request;</strong> opening this link alone does not submit it. If no email app opens, write directly to <a href="mailto:${DELETION_EMAIL}">${DELETION_EMAIL}</a> with the subject “${account ? 'Smarty account deletion' : 'Smarty data deletion'}”.</p>
        <p class="deletion-safety">Never send your password, sign-in code, payment information or identity documents in your initial email. We may ask you to verify ownership before deleting anything. If you used Apple Hide My Email or cannot access your original email, mention that so support can help verify your account.</p>
      </section>
      <section aria-labelledby="scope-heading">
        <h2 id="scope-heading">${account ? 'What the request covers' : 'Data you can ask us to delete'}</h2>
        ${account ? `<p>A full deletion request covers your Smarty account, profile and personal data associated with it, including:</p>` : '<p>Specify one or more of the following in your email. We will confirm the scope with you while keeping your account active:</p>'}
        <ul><li>${account ? 'Account details, profile information and notification registrations.' : 'Profile details or notification registrations you no longer want stored.'}</li><li>Posts, comments and uploaded media you created.</li><li>Saved items, learning progress and personal preferences, including saved news choices.</li><li>Private AI conversations and chat content associated with your account, subject to the shared-record limits below.</li></ul>
        ${account ? '<p>Deletion is permanent. Deleting Smarty does not delete your separate Google or Apple account, and uninstalling the app alone does not delete your Smarty account.</p>' : '<p>For a public post or comment, you can also use its delete control in Smarty. For full account removal instead, use <a href="/delete-account.html">account deletion</a>.</p>'}
      </section>
      <section aria-labelledby="timing-heading">
        <h2 id="timing-heading">Timing &amp; retained records</h2>
        <p>After verifying account ownership, we complete deletion requests <strong>within 14 days</strong> and confirm the outcome by email.</p>
        <p>Limited records may need to be retained for security, fraud prevention, dispute resolution or legal obligations. If this applies, we will explain which records are retained, why, and their applicable retention period or deletion date when responding to your request. Such records are kept only for as long as the specific reason requires.</p>
        <p>Shared conversations may contain other people’s data; a request does not authorize deleting their accounts or their contributions. Copies already downloaded, exported or independently saved by another person are outside Smarty’s control. Remove any local downloads or device backups you no longer want to keep.</p>
      </section>
      ${account ? '<section aria-labelledby="app-heading"><h2 id="app-heading">Prefer to do it in Smarty?</h2><p>Sign in on the app or website, open <strong>Profile → Delete account</strong>, then follow the confirmation steps. If you cannot sign in, use the email request above; reinstalling the app is not required.</p><a href="/profile">Open Profile</a></section>' : ''}
    </main>
    <footer class="deletion-footer"><a href="${account ? '/delete-data.html' : '/delete-account.html'}">${account ? 'Delete selected data instead' : 'Delete your entire account'}</a><a href="/privacy">Privacy policy</a><a href="/support">Support</a><span>Updated October 22, 2026</span></footer>
  </div>`;
}

export function renderDeletionDocument(kind, css = '') {
  const title = deletionPageTitle(kind);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><meta name="theme-color" content="#08090b"><title>${title} | Smarty</title><meta name="description" content="Request deletion of your Smarty ${kind === 'account' ? 'account and associated personal data' : 'selected personal data'}. No app installation or sign-in required."><link rel="canonical" href="${DELETION_URLS[kind]}"><style>${css}</style></head><body class="deletion-document"><div class="deletion-page">${renderDeletionContent(kind)}</div></body></html>\n`;
}
