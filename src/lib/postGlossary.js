export const POST_GLOSSARY_VERSION = 1;
const MAX_TERMS = 16;
const MAX_HIGHLIGHTS = 80;
const wordCharacter = value => /[\p{L}\p{N}_]/u.test(value || '');
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const characterBefore = (text, index) => {
  const previous = text.codePointAt(Math.max(0, index - 2));
  return index > 1 && previous > 0xffff ? String.fromCodePoint(previous) : text[index - 1];
};
const characterAt = (text, index) => index < text.length ? String.fromCodePoint(text.codePointAt(index)) : '';

export function normalizePostGlossary(value) {
  if (!value || value.version !== POST_GLOSSARY_VERSION || !/^[a-f0-9]{64}$/.test(value.sourceHash || '') || !Array.isArray(value.terms)) return null;
  const seen = new Set();
  const terms = [];
  for (const entry of value.terms.slice(0, 64)) {
    if (typeof entry?.term !== 'string' || typeof entry?.meaning !== 'string') continue;
    const term = entry.term.trim(), meaning = entry.meaning.replace(/\s+/g, ' ').trim(), key = term.toLowerCase();
    if (term.length < 2 || term.length > 80 || term.split(/\s+/).length > 6 || meaning.length < 15 || meaning.length > 650
        || /[<>\r\n]/.test(term) || /[<>]/.test(meaning) || seen.has(key)) continue;
    terms.push({ term, meaning }); seen.add(key);
    if (terms.length === MAX_TERMS) break;
  }
  if (value.terms.length && !terms.length) return null;
  return { version: POST_GLOSSARY_VERSION, sourceHash: value.sourceHash, terms };
}

export async function verifyPostGlossary(post, crypto = globalThis.crypto) {
  const glossary = normalizePostGlossary(post?.postGlossary);
  if (!glossary || !crypto?.subtle || typeof TextEncoder === 'undefined') return null;
  const text = String(post?.title || '') + '\n' + String(post?.body || '');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const fingerprint = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  return fingerprint === glossary.sourceHash ? glossary : null;
}

export function splitGlossaryText(text, terms) {
  if (typeof text !== 'string' || !text || !Array.isArray(terms) || !terms.length) return [text || ''];
  const bounded = terms.slice(0, MAX_TERMS).filter(item => typeof item?.term === 'string' && item.term.length >= 2 && item.term.length <= 80
    && typeof item.meaning === 'string' && item.meaning.trim()).sort((a, b) => b.term.length - a.term.length);
  if (!bounded.length) return [text];
  // Captures preserve the matched definition even when Unicode's case folding
  // differs from toLowerCase (for example, the historical long s).
  const pattern = new RegExp(bounded.map(entry => `(${escapePattern(entry.term)})`).join('|'), 'giu');
  const links = [];
  for (const token of text.matchAll(/\S+/gu)) {
    if (/https?:\/\/|www\.|mailto:|@/i.test(token[0])) links.push([token.index, token.index + token[0].length]);
  }
  const result = [];
  let cursor = 0, linkIndex = 0, highlights = 0, match;
  while ((match = pattern.exec(text))) {
    const start = match.index, end = start + match[0].length;
    // Do not underline substrings inside longer words or URL/email fragments.
    while (links[linkIndex]?.[1] <= start) linkIndex++;
    const inLink = links[linkIndex] && links[linkIndex][0] < end && links[linkIndex][1] > start;
    if (wordCharacter(characterBefore(text, start)) || wordCharacter(characterAt(text, end)) || inLink
        || /[@\/]/.test(text[start - 1] || '') || /[@\/]/.test(text[end] || '')) continue;
    if (start > cursor) result.push(text.slice(cursor, start));
    const definition = bounded[match.findIndex((value, index) => index > 0 && value !== undefined) - 1];
    result.push({ ...definition, text: match[0] });
    cursor = end;
    if (++highlights === MAX_HIGHLIGHTS) break;
  }
  if (cursor < text.length) result.push(text.slice(cursor));
  return result.length ? result : [text];
}
