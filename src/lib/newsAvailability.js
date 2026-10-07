// Reports remain useful when editorial generation is temporarily unavailable.
export function hasEditorialBriefing(news) {
  const summary = news?.dailySummary;
  return summary?.summaryMode === 'editorial' && (
    typeof summary.overview === 'string' && summary.overview.trim().length > 0
    || Array.isArray(summary.overviewParagraphs)
      && summary.overviewParagraphs.some(text => typeof text === 'string' && text.trim())
  );
}

export function newsCacheIsFresh(news, timestamp, now = Date.now()) {
  const ttl = hasEditorialBriefing(news) ? 15 * 60 * 1000 : 60 * 1000;
  const edition = news?.dailySummary?.editionDate;
  return timestamp <= now && now - timestamp < ttl
    && (!edition || edition === new Date(now).toISOString().slice(0, 10));
}

export function editorialNewsSections(news) {
  if (!hasEditorialBriefing(news)) return [];
  const digests = news.dailySummary.sectionDigests;
  return Array.isArray(digests) ? digests.filter(digest => (
    digest && typeof digest.section === 'string' && typeof digest.summary === 'string'
    && digest.summary.trim() && digest.summaryMode !== 'extractive'
  )) : [];
}
