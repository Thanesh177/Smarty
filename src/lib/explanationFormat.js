export const DETAILED_EXPLANATION_VERSION = 4;
export const EXPLANATION_SECTION_NAMES = [
  'Core idea', 'Simple explanation', 'Essential terms', 'Key terms',
  'How it works', 'Worked example', 'Real-life example', 'Common misconception',
  'Limits and edge cases', 'Why it matters', 'What to learn next',
  'Remember this', 'Final takeaway',
];

const headings = new Map(EXPLANATION_SECTION_NAMES.map((name) => [name.toLowerCase(), name]));

// Plain-text parsing only. Model output is never inserted as HTML.
export function explanationSections(value) {
  const sections = [];
  let active;
  for (const raw of String(value || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim().replace(/^#{1,6}\s+/, '').replace(/^\*\*(.*?)\*\*(?=\s*:|\s*$)/, '$1');
    const colon = line.indexOf(':');
    const candidate = (colon < 0 ? line : line.slice(0, colon)).trim();
    const heading = headings.get(candidate.toLowerCase());
    if (heading) {
      active = { heading, lines: colon < 0 ? [] : [line.slice(colon + 1).trim()] };
      sections.push(active);
    } else {
      if (!active) { active = { heading: '', lines: [] }; sections.push(active); }
      active.lines.push(raw);
    }
  }
  return sections.map(({ heading, lines }, index) => ({
    heading, text: lines.join('\n').trim(), id: `explanation-section-${index}`,
    kind: /example/i.test(heading) ? 'example' : /remember|takeaway/i.test(heading) ? 'takeaway' : 'reading',
  })).filter((section) => section.text);
}

// Lists stay lists even when an introductory sentence or blank line separates
// their items. Continued lines belong to the preceding item.
export function explanationBlocks(value) {
  const blocks = [];
  let active;
  for (const raw of String(value || '').trim().split('\n')) {
    const line = raw.trim();
    if (!line) { active = undefined; continue; }
    const match = line.match(/^(?:(\d+)[.)]|[-•*])\s+(.+)$/);
    if (match) {
      const type = match[1] ? 'ol' : 'ul';
      const previous = blocks.at(-1);
      if (!active && previous?.type === type) active = previous;
      if (active?.type !== type) {
        active = { type, items: [], start: match[1] ? Number(match[1]) : undefined };
        blocks.push(active);
      }
      active.items.push(match[2]);
    } else if (active && active.type !== 'p') {
      active.items[active.items.length - 1] += ` ${line}`;
    } else {
      if (!active) { active = { type: 'p', text: '' }; blocks.push(active); }
      active.text += `${active.text ? ' ' : ''}${line}`;
    }
  }
  return blocks;
}
