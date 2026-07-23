export function getUserScope(userOrId) {
  const raw =
    typeof userOrId === 'object'
      ? userOrId?.userId || userOrId?.sub || userOrId?.id || ''
      : userOrId;

  const normalized = String(raw || '').trim();
  return normalized ? encodeURIComponent(normalized) : 'anonymous';
}

export function getUserScopedStorageKey(baseKey, userOrId) {
  return `${baseKey}:${getUserScope(userOrId)}`;
}

export function removeLegacyAccountCacheKeys() {
  const localKeys = [
    'activeChatId',
    'smartyChatUnreadCount',
    'smarty_cached_feed_v2',
    'smarty_cached_feed_cursor_v2',
  ];

  localKeys.forEach((key) => localStorage.removeItem(key));
}
