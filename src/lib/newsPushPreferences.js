export function newsPushPreferences(preferences, timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC') {
  return { enabled: preferences.enabled === true, news: preferences.categories?.news === true,
    previews: preferences.showPreviews !== false, smartDelivery: preferences.smartDelivery !== false,
    quietHours: preferences.quietHours, timezone };
}
