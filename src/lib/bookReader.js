export function splitBookSections(value, size = 6000) {
  size = Math.max(500, Math.floor(Number(size) || 6000));
  const text = String(value || '').replace(/\r\n/g, '\n');
  if (!text.trim()) return [];
  const chapters = text.split(/(?=^\s*CHAPTER\s+(?:\d+|[IVXLCDM]+)\b)/gim).filter(part => part.trim());
  if (chapters.length > 2) return chapters;
  const parts = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const paragraph = text.lastIndexOf('\n\n', end);
      const word = text.lastIndexOf(' ', end);
      if (paragraph > start + size / 2) end = paragraph + 2;
      else if (word > start) end = word + 1;
    }
    parts.push(text.slice(start, end)); start = end;
  }
  return parts;
}
export function normalizeReaderSettings(value) {
  const number = (input, fallback, min, max) => Number.isFinite(Number(input)) ? Math.min(max,Math.max(min,Number(input))) : fallback;
  return { fontSize:number(value?.fontSize,18,14,28), lineHeight:number(value?.lineHeight,1.8,1.4,2.4),
    theme:['dark','sepia','light'].includes(value?.theme) ? value.theme : 'dark' };
}

export function bookParagraphs(text) {
  return String(text || '').replace(/\r\n/g,'\n').split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
}
export function findBookMatches(sections, query, limit = 60) {
  const needle = String(query || '').trim().toLowerCase();
  if (needle.length < 2) return [];
  const matches = [];
  for (let section = 0; section < sections.length && matches.length < limit; section++) {
    const paragraphs = bookParagraphs(sections[section]);
    for (let paragraph = 0; paragraph < paragraphs.length && matches.length < limit; paragraph++) {
      const offset = paragraphs[paragraph].toLowerCase().indexOf(needle);
      if (offset >= 0) matches.push({ section, paragraph, excerpt:paragraphs[paragraph].slice(Math.max(0,offset-45),offset+needle.length+85).replace(/\s+/g,' ') });
    }
  }
  return matches;
}
