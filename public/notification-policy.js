// One dependency-free delivery policy for the page and the classic worker.
(function (root) {
  const defaults = {
    enabled: true, smartDelivery: true, showPreviews: true,
    quietHours: { enabled: true, start: '22:00', end: '07:30' },
    dailyReminder: { enabled: false, time: '18:30' },
    categories: { messages: true, social: true, learning: true, news: true, product: false },
  };
  Object.values(defaults).forEach(value => { if (value && typeof value === 'object') Object.freeze(value); });
  Object.freeze(defaults);
  const time = (value, fallback) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')) ? value : fallback;
  function normalize(value) {
    value = value && typeof value === 'object' ? value : {};
    return {
      enabled: value.enabled !== false, smartDelivery: value.smartDelivery !== false, showPreviews: value.showPreviews !== false,
      quietHours: { enabled: value.quietHours?.enabled !== false,
        start: time(value.quietHours?.start, defaults.quietHours.start), end: time(value.quietHours?.end, defaults.quietHours.end) },
      dailyReminder: { enabled: value.dailyReminder?.enabled === true, time: time(value.dailyReminder?.time, defaults.dailyReminder.time) },
      categories: Object.fromEntries(Object.entries(defaults.categories).map(([key, fallback]) =>
        [key, typeof value.categories?.[key] === 'boolean' ? value.categories[key] : fallback])),
    };
  }
  function classify(detail = {}) {
    const explicit = String(detail.category || detail.type || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(defaults.categories, explicit) || explicit === 'safety') return explicit;
    const text = [detail.type, detail.category, detail.event, detail.title].filter(Boolean).join(' ').toLowerCase();
    if (/security|safety|account|moderation|password|login/.test(text)) return 'safety';
    if (/chat|message|direct_message|room_message|\bdm\b/.test(text)) return 'messages';
    if (/follow|like|comment|mention|reply|invite|social/.test(text)) return 'social';
    if (/quiz|lesson|learning|progress|streak|topic|review|reminder/.test(text)) return 'learning';
    if (/news|briefing|digest|headline/.test(text)) return 'news';
    return 'product';
  }
  const minutes = value => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
  function quiet(preferences, now = new Date()) {
    const hours = normalize(preferences).quietHours;
    if (!hours.enabled) return false;
    const current = now.getHours() * 60 + now.getMinutes(), start = minutes(hours.start), end = minutes(hours.end);
    return start === end || (start < end ? current >= start && current < end : current >= start || current < end);
  }
  function decision(detail = {}, preferences, now = new Date()) {
    const value = normalize(preferences), category = classify(detail);
    if (!value.enabled) return { deliver: false, reason: 'disabled', category };
    if (category !== 'safety' && !value.categories[category]) return { deliver: false, reason: 'category-disabled', category };
    const immediate = category === 'safety' || category === 'messages';
    if (value.smartDelivery && !immediate && quiet(value, now)) return { deliver: false, reason: 'quiet-hours', category };
    return { deliver: true, reason: immediate ? 'immediate' : 'allowed', category };
  }
  function body(detail, preferences) {
    return !normalize(preferences).showPreviews && classify(detail) === 'messages'
      ? 'You have a new message.' : detail?.body || 'You have a new update.';
  }
  function safePath(value, origin = 'https://smarty.wiki') {
    try {
      const base = new URL(origin), target = new URL(String(value || '/feed?topic=All'), base);
      if (!['http:', 'https:'].includes(target.protocol) || target.origin !== base.origin) return '/feed?topic=All';
      return target.pathname + target.search + target.hash;
    } catch { return '/feed?topic=All'; }
  }
  root.SmartyNotificationPolicy = Object.freeze({ defaults, normalize, classify, quiet, decision, body, safePath });
})(globalThis);
