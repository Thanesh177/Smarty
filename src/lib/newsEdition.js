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

const text = value => typeof value === 'string' ? value : '';
const paragraphs = value => (Array.isArray(value) ? value : []).filter(value => typeof value === 'string' && value.trim());
function cleanSummary(summary) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return undefined;
  const count=value=>Number.isFinite(value)&&value>=0?Math.floor(value):0;
  const themes=value=>(Array.isArray(value)?value:[]).filter(item=>typeof item?.label==='string').map(item=>({...item,storyCount:count(item.storyCount)}));
  return { ...summary, title:text(summary.title), eyebrow:text(summary.eyebrow), overview:text(summary.overview), analysisStatement:text(summary.analysisStatement), storyCount:count(summary.storyCount),sourceCount:count(summary.sourceCount),sectionCount:count(summary.sectionCount),
    editionDate:text(summary.editionDate), generatedAt:text(summary.generatedAt), overviewParagraphs:paragraphs(summary.overviewParagraphs),
    highlights:cleanReports(summary.highlights),
    keyTakeaways:(Array.isArray(summary.keyTakeaways)?summary.keyTakeaways:[]).filter(item=>typeof item?.title==='string'&&typeof item?.summary==='string').map(item=>({...item,stories:cleanReports(item.stories)})),
    keyThemes:themes(summary.keyThemes),
    sectionDigests:(Array.isArray(summary.sectionDigests)?summary.sectionDigests:[]).filter(item=>typeof item?.section==='string'&&typeof item?.summary==='string').map(item=>({...item,storyCount:count(item.storyCount),sourceCount:count(item.sourceCount),summaryParagraphs:paragraphs(item.summaryParagraphs),topStories:cleanReports(item.topStories),context:text(item.context),next:text(item.next),themes:themes(item.themes)})),
  };
}

export function normalizeNewsEdition(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The news service returned an invalid response. Please try again.');
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
  const place = news => [String(news?.location?.countryCode || news?.location?.country || '').toUpperCase(), String(news?.location?.region || '')];
  const [country, region] = place(reports), [incomingCountry, incomingRegion] = place(briefing);
  if ((country && incomingCountry && country !== incomingCountry) || (country && incomingCountry && region !== incomingRegion)) {
    throw new Error('The daily summary belongs to another edition. Your reports are still available.');
  }
  if (!hasEditorialBriefing(briefing)) return reports;
  // A summary-only or older cached response must not erase the fast report view.
  return { ...briefing, ...reports, dailySummary: briefing.dailySummary,
    generatedAt: briefing.generatedAt || reports.generatedAt, cacheStatus: briefing.cacheStatus || reports.cacheStatus };
}
