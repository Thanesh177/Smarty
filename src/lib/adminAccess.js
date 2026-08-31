const ADMIN_GROUP = 'SmartyAdmins';

function decodeTokenPayload(token) {
  try {
    const part = String(token || '').split('.')[1] || '';
    const normalized = part
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(part.length / 4) * 4, '=');

    return JSON.parse(atob(normalized));
  } catch {
    return {};
  }
}

export function normalizeGroups(value) {
  if (Array.isArray(value)) {
    return value.map((group) => String(group || '').trim()).filter(Boolean);
  }

  return String(value || '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((group) => group.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

export function getUserGroups(user) {
  const tokenPayload = decodeTokenPayload(user?.token || user?.accessToken);

  return Array.from(new Set([
    ...normalizeGroups(user?.groups),
    ...normalizeGroups(user?.['cognito:groups']),
    ...normalizeGroups(tokenPayload?.['cognito:groups']),
  ]));
}

export function isAdminUser(user) {
  return getUserGroups(user).includes(ADMIN_GROUP);
}

export { ADMIN_GROUP };
