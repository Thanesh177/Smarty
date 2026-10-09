const UNREADABLE_CONFIRMATION = 'The server returned an unreadable publishing confirmation. Your post may already be saved. Check your posts before trying again.';
const PUBLISH_FAILED = 'The post could not be published. Please try again.';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isPost = value => ['id', 'postId', 'reelId', 'title', 'topic', 'videoUrl', 'imageUrl'].some(key => Object.hasOwn(value, key));

// A saved post's `body` is content, not an HTTP response envelope.
export function normalizePostResponse(response) {
  let result = response;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof result === 'string') {
      try { result = JSON.parse(result); } catch { throw new Error(UNREADABLE_CONFIRMATION); }
      continue;
    }
    if (!isRecord(result) || !Object.keys(result).length) throw new Error(UNREADABLE_CONFIRMATION);
    if (result.success === false || result.error) throw new Error(PUBLISH_FAILED);
    if (isPost(result)) return result;

    const proxy = Object.hasOwn(result, 'statusCode');
    if (proxy) {
      const status = Number(result.statusCode);
      if (!Number.isInteger(status) || status < 200 || status >= 300) throw new Error(PUBLISH_FAILED);
    }
    const bodyOnly = Object.keys(result).length === 1 && Object.hasOwn(result, 'body');
    if (proxy || bodyOnly) {
      result = result.body;
      continue;
    }
    return result;
  }
  throw new Error(UNREADABLE_CONFIRMATION);
}
