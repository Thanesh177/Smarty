import { hasEditorialBriefing } from './newsAvailability.js';

export function safeNewsUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

function cleanReports(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).flatMap(item => {
    if (!item || typeof item !== 'object' || typeof item.title !== 'string' || !item.title.trim()) return [];
    const link = safeNewsUrl(item.news_link);
    if (!link || seen.has(link)) return [];
    seen.add(link);
    return [{ ...item, news_link: link, source:typeof item.source==='string'?item.source:'', image_link:safeNewsUrl(item.image_link), summary: typeof item.summary === 'string' ? item.summary : '', section: typeof item.section === 'string' ? item.section : 'World' }];
  });
}

export function normalizeSavedNews(value) {
  return cleanReports(value).slice(0, 200);
}

const text = value => typeof value === 'string' ? value : '';
const regionKey = region => text(region).trim().toLowerCase();
const paragraphs = value => (Array.isArray(value) ? value : []).filter(value => typeof value === 'string' && value.trim());
export function briefingParagraphs(summary) {
  const overview = paragraphs(summary?.overviewParagraphs);
  return overview.length ? overview : text(summary?.overview).trim().split(/\n\s*\n/).filter(Boolean);
}

function cleanSummary(summary) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return undefined;
  const count=value=>Number.isFinite(value)&&value>=0?Math.floor(value):0;
  const themes=value=>(Array.isArray(value)?value:[]).filter(item=>typeof item?.label==='string').map(item=>({...item,storyCount:count(item.storyCount)}));
  return { ...summary, title:text(summary.title), eyebrow:text(summary.eyebrow), overview:text(summary.overview), analysisStatement:text(summary.analysisStatement), storyCount:count(summary.storyCount),sourceCount:count(summary.sourceCount),sectionCount:count(summary.sectionCount),
    editionDate:text(summary.editionDate), editionTimezone:text(summary.editionTimezone), coverageWindow:text(summary.coverageWindow), nextEditionAt:text(summary.nextEditionAt), generatedAt:text(summary.generatedAt), overviewParagraphs:paragraphs(summary.overviewParagraphs),
    unavailableSectors:paragraphs(summary.unavailableSectors),
    highlights:cleanReports(summary.highlights),
    keyTakeaways:(Array.isArray(summary.keyTakeaways)?summary.keyTakeaways:[]).filter(item=>typeof item?.title==='string'&&typeof item?.summary==='string').map(item=>({...item,stories:cleanReports(item.stories)})),
    keyThemes:themes(summary.keyThemes),
    sectionDigests:(Array.isArray(summary.sectionDigests)?summary.sectionDigests:[]).filter(item=>typeof item?.section==='string'&&typeof item?.summary==='string').map(item=>({...item,storyCount:count(item.storyCount),sourceCount:count(item.sourceCount),summaryParagraphs:paragraphs(item.summaryParagraphs),topStories:cleanReports(item.topStories),context:text(item.context),next:text(item.next),themes:themes(item.themes)})),
  };
}

export function normalizeNewsEdition(value, place) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The news service returned an invalid response. Please try again.');
  const countryCode = text(value.location?.countryCode).trim().toUpperCase();
  if (place && countryCode && (countryCode !== text(place.country).trim().toUpperCase()
      || regionKey(value.location.region) !== regionKey(place.region))) {
    throw new Error('The news service returned a different location. Please try again.');
  }
  if (value.sections != null && (typeof value.sections !== 'object' || Array.isArray(value.sections))) throw new Error('The news service returned invalid sections. Please try again.');
  const sections = Object.fromEntries(Object.entries(value.sections || {}).flatMap(([name, items]) => {
    const reports = cleanReports(items);
    return reports.length ? [[name, reports]] : [];
  }));
  const articles = cleanReports(value.articles);
  if (!articles.length && !Object.keys(sections).length && !hasEditorialBriefing(value)
      && !Array.isArray(value.articles) && !value.sections) throw new Error('The news service is unavailable. Please try again.');
  const sources = (Array.isArray(value.sources) ? value.sources : []).flatMap(source => {
    const url = safeNewsUrl(source?.url);
    return url ? [{ ...source, url, name: typeof source.name === 'string' ? source.name : 'Original reporting' }] : [];
  });
  const location = Object.fromEntries(['countryCode','country','region','label'].map(key=>[key,text(value.location?.[key])]));
  return { ...value, articles, sections, sources, location, notice:text(value.notice), dailySummary:cleanSummary(value.dailySummary) };
}

export function mergeNewsBriefing(reports, value) {
  const briefing = normalizeNewsEdition(value);
  const place = news => [text(news?.location?.countryCode).trim().toUpperCase(), regionKey(news?.location?.region)];
  const [country, region] = place(reports), [incomingCountry, incomingRegion] = place(briefing);
  if ((country && incomingCountry && country !== incomingCountry) || (country && incomingCountry && region !== incomingRegion)) {
    throw new Error('The daily summary belongs to another edition. Your reports are still available.');
  }
  if (!hasEditorialBriefing(briefing)) return reports;
  // A summary-only or older cached response must not erase the fast report view.
  return { ...briefing, ...reports, dailySummary: briefing.dailySummary,
    generatedAt: reports.generatedAt || briefing.generatedAt, cacheStatus: reports.cacheStatus || briefing.cacheStatus,
    notice: reports.notice || briefing.notice };
}

export const hasNewsReports = news => Boolean(news?.articles?.length || Object.keys(news?.sections || {}).length);

export const isFallbackNews = news => ['stale-cache', 'browser-fallback'].includes(news?.cacheStatus);

export async function loadNewsEdition({ load, signal, onReports, onBriefing, savedReports, place, preferBriefing = false }) {
  const checkAbort = () => {
    if (signal?.aborted) throw new DOMException('News request cancelled.', 'AbortError');
  };
  checkAbort();
  let reports = savedReports ? normalizeNewsEdition(savedReports, place) : null;
  const requestEdition = async (view) => {
    const edition = normalizeNewsEdition(await load(view), place);
    checkAbort();
    if (!hasNewsReports(edition) && !hasEditorialBriefing(edition)) {
      throw new Error('No reports or briefing are available for this edition.');
    }
    return edition;
  };
  if (!reports && preferBriefing) {
    // The combined endpoint already includes reports. In the briefing tab,
    // don't make readers wait for a separate report refresh before asking.
    onBriefing?.();
    try {
      return await requestEdition();
    } catch (briefingError) {
      checkAbort();
      try { return await requestEdition('reports'); }
      catch { checkAbort(); throw briefingError; }
    }
  }
  if (!reports) {
    try {
      const received = normalizeNewsEdition(await load('reports'), place);
      if (hasNewsReports(received)) reports = received;
    } catch {
      // A reports outage must not prevent us from requesting the saved daily edition.
    }
  }
  checkAbort();
  if (reports) onReports?.(reports, { cached: Boolean(savedReports) });
  onBriefing?.();
  try {
    // The combined route shares the reports refresh lock. Start after the fast
    // route has settled so two cold requests do not compete for that lock.
    const briefing = await requestEdition();
    if (!reports || (isFallbackNews(reports) && hasNewsReports(briefing) && !isFallbackNews(briefing))) return briefing;
    return mergeNewsBriefing(reports, briefing);
  } catch (error) {
    if (!reports || signal?.aborted) throw error;
    return reports;
  }
}
