import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DELETION_EMAIL, DELETION_URLS, getDeletionPageKind, deletionRequestUrl, renderDeletionContent, renderDeletionDocument } from './deletionPages.js';
import deletionPagesPlugin from '../../scripts/deletion-pages.mjs';

test('public account and selected-data paths have explicit independent destinations', () => {
  for (const path of ['/delete-account', '/delete-account/', '/delete-account.html', '/account-deletion']) {
    assert.equal(getDeletionPageKind(path), 'account');
  }
  for (const path of ['/delete-data', '/delete-data/', '/delete-data.html', '/data-deletion']) {
    assert.equal(getDeletionPageKind(path), 'data');
  }
  for (const path of ['/login', '/profile', '/feed', '/delete-account/anything', 'https://untrusted.invalid/delete-account', null]) {
    assert.equal(getDeletionPageKind(path), null);
  }
  assert.equal(DELETION_URLS.account, 'https://smarty.wiki/delete-account.html');
  assert.equal(DELETION_URLS.data, 'https://smarty.wiki/delete-data.html');
});

test('email requests use existing support address and distinguish account from partial deletion', () => {
  const account = new URL(deletionRequestUrl('account'));
  const data = new URL(deletionRequestUrl('data'));
  assert.equal(account.protocol, 'mailto:');
  assert.equal(account.pathname, DELETION_EMAIL);
  assert.match(account.searchParams.get('subject'), /account and associated data deletion request/);
  assert.match(account.searchParams.get('body'), /verify my ownership/);
  assert.match(account.searchParams.get('body'), /Apple private relay/);
  assert.match(data.searchParams.get('body'), /keeping my Smarty account/);
  assert.match(data.searchParams.get('body'), /Data to delete/);
});

test('both resources are complete branded JavaScript-free documents with a usable email path', () => {
  for (const kind of ['account', 'data']) {
    const document = renderDeletionDocument(kind, '.deletion-page { color: white; }');
    assert.match(document, /^<!doctype html>/);
    assert.match(document, /<html lang="en">/);
    assert.match(document, /<h1>.*Smarty/);
    assert.ok(document.includes(`rel="canonical" href="${DELETION_URLS[kind]}"`));
    assert.match(document, /href="mailto:ntthanesh@gmail\.com\?subject=/);
    assert.match(document, /Send the email to submit your request/);
    assert.match(document, /within 14 days/);
    assert.match(document, /verifying account ownership/);
    assert.match(document, /applicable retention period or deletion date/);
    assert.match(document, /Never send your password/);
    assert.doesNotMatch(document, /<script\b|<iframe\b|<form\b|\bonclick=|javascript:/i);
  }
  assert.throws(() => renderDeletionContent('untrusted'), /Unknown deletion page/);
});

test('account and selected-data scopes remain clear without claiming email clicks submit requests', () => {
  const account = renderDeletionContent('account');
  const data = renderDeletionContent('data');
  assert.match(account, /permanent deletion of your Smarty account/);
  assert.match(account, /opening this link alone does not submit it/);
  assert.match(account, /uninstalling the app alone does not delete/);
  assert.match(account, /Profile → Delete account/);
  assert.match(data, /without deleting your entire account/);
  assert.match(data, /while keeping your account active/);
  assert.match(data, /href="\/delete-account.html"/);
});

test('production build emits real standalone HTML files, not app-shell redirects', () => {
  const assets = [];
  deletionPagesPlugin().generateBundle.call({ emitFile: asset => assets.push(asset) });
  assert.deepEqual(assets.map(asset => asset.fileName), ['delete-account.html', 'delete-data.html']);
  for (const asset of assets) {
    assert.equal(asset.type, 'asset');
    assert.match(asset.source, /<style>.*deletion-document/s);
    assert.doesNotMatch(asset.source, /id="root"|src="\/src\/|<script\b/);
  }
});

test('development and preview serve direct public resources without authentication', () => {
  for (const hook of ['configureServer', 'configurePreviewServer']) {
    let middleware;
    deletionPagesPlugin()[hook]({ middlewares: { use(handler) { middleware = handler; } } });
    const response = () => ({ headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body) { this.body = body; } });
    const page = response();
    middleware({ method: 'GET', url: '/delete-account.html?review=google' }, page, () => assert.fail('public page must be served'));
    assert.equal(page.statusCode, 200);
    assert.equal(page.headers['Content-Type'], 'text/html; charset=utf-8');
    assert.match(page.body, /Delete your Smarty account/);
    const head = response();
    middleware({ method: 'HEAD', url: '/delete-data.html' }, head, () => assert.fail('HEAD must be served'));
    assert.equal(head.statusCode, 200);
    assert.equal(head.body, undefined);
    let forwarded = 0;
    middleware({ method: 'GET', url: '/feed' }, response(), () => forwarded++);
    middleware({ method: 'POST', url: '/delete-account.html' }, response(), () => forwarded++);
    assert.equal(forwarded, 2);
  }
});

test('SPA fallback bypasses sign-in and splash and policies link the public resources', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const appComponent = app.slice(app.indexOf('export default function App()'));
  assert.ok(appComponent.indexOf('if (deletionKind)') < appComponent.indexOf('<AuthProvider>'));
  for (const name of ['PrivacyPage', 'SupportPage']) {
    const source = readFileSync(new URL(`../pages/${name}.jsx`, import.meta.url), 'utf8');
    assert.match(source, /href="\/delete-account.html"/);
    assert.match(source, /href="\/delete-data.html"/);
  }
});
