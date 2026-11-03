import test from 'node:test';
import assert from 'node:assert/strict';
import { responsiveImage } from './imageDelivery.js';

test('feed photos negotiate modern formats and responsive widths without losing attribution', () => {
  const result = responsiveImage('https://images.unsplash.com/photo-one?ixid=keep-me&fm=jpg&q=80&fit=crop');
  const url = new URL(result.src);
  assert.equal(url.searchParams.get('auto'), 'format');
  assert.equal(url.searchParams.has('fm'), false);
  assert.equal(url.searchParams.get('ixid'), 'keep-me');
  assert.equal(url.searchParams.get('fit'), 'crop');
  assert.match(result.srcSet, /480w, .*960w, .*1440w/);
});
test('signed media, unrelated hosts and local assets are never rewritten', () => {
  for (const src of ['/icon-192.png', undefined, 'https://images.unsplash.com.evil.test/p.png', 'https://bucket.example/a?Signature=abc', 'https://publisher.example/p.gif']) assert.deepEqual(responsiveImage(src), { src });
});
