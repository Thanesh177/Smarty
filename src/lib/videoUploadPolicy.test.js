import test from 'node:test';
import assert from 'node:assert/strict';
import { canPrepareVideo, isWorthKeeping } from './videoUploadPolicy.js';
import { prepareVideoUpload } from './prepareVideoUpload.js';

const mib = 1024 * 1024;
const supported = { Worker: () => {}, VideoEncoder: () => {}, VideoDecoder: () => {}, BigInt };

test('optimization stays off legacy browsers, low-size clips and very large uploads', async () => {
  const mov = { type: 'video/quicktime', size: 48 * mib };
  assert.equal(canPrepareVideo(mov, supported), true);
  assert.equal(canPrepareVideo(mov, { ...supported, VideoEncoder: undefined }), false);
  assert.equal(canPrepareVideo({ ...mov, type: 'video/webm' }, supported), false);
  assert.equal(canPrepareVideo({ ...mov, size: 7 * mib }, supported), false);
  assert.equal(canPrepareVideo({ ...mov, size: 129 * mib }, supported), false);
  assert.equal(await prepareVideoUpload(mov, { signal: AbortSignal.abort() }), mov);
});

test('a new encoding must save a material amount of bandwidth', () => {
  assert.equal(isWorthKeeping(20 * mib, 15 * mib), true);
  assert.equal(isWorthKeeping(20 * mib, 19 * mib), false);
  assert.equal(isWorthKeeping(20 * mib, 22 * mib), false);
  assert.equal(isWorthKeeping(20 * mib, 0), false);
});
