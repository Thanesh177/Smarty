// Existing resources only. Preserve every writable setting; never fetch secrets.
// Run without --apply first. Live changes require explicit human approval.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { loadEnv } = require('vite');
const aws = process.env.SMARTY_AWS_CLI || '/Users/thaneshn/.local/bin/aws';
const root = path.resolve(__dirname, '..');
const env = loadEnv('production', root, 'VITE_COGNITO_');
const poolId = env.VITE_COGNITO_USER_POOL_ID;
const clientId = env.VITE_COGNITO_CLIENT_ID;
if (!poolId || !clientId) throw new Error('Public authentication identifiers are missing.');

function call(args) {
  const output = execFileSync(aws, ['cognito-idp', ...args, '--region', 'us-east-1', '--output', 'json', '--no-cli-pager'], { encoding: 'utf8', timeout: 30000 });
  // UpdateUserPool succeeds with an empty response body.
  return output.trim() ? JSON.parse(output) : null;
}
function skeleton(operation) { return call([operation, '--generate-cli-skeleton', 'input']); }
const poolKeys = Object.keys(skeleton('update-user-pool')).filter(key => key !== 'UserPoolId');
const clientKeys = Object.keys(skeleton('update-user-pool-client')).filter(key => !['UserPoolId', 'ClientId'].includes(key));
const projection = keys => '{' + keys.map(key => `${key}:${key === 'PoolName' ? 'Name' : key}`).join(',') + '}';
const nonNull = object => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== null));
const readPool = () => ({ UserPoolId: poolId, ...nonNull(call(['describe-user-pool', '--user-pool-id', poolId, '--query', 'UserPool.' + projection(poolKeys)])) });
// ClientSecret is never requested from CLI output or stored in a snapshot.
const readClient = () => ({ UserPoolId: poolId, ClientId: clientId, ...nonNull(call(['describe-user-pool-client', '--user-pool-id', poolId, '--client-id', clientId, '--query', 'UserPoolClient.' + projection(clientKeys)])) });
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
const hash = value => createHash('sha256').update(JSON.stringify(sorted(value))).digest('hex');

try {
  const pool = readPool(), client = readClient();
  if (!client.SupportedIdentityProviders?.includes('Google') || !client.SupportedIdentityProviders?.includes('SignInWithApple')
    || !client.CallbackURLs?.includes('smarty://callback') || !client.AllowedOAuthFlows?.includes('code')) {
    throw new Error('Expected Smarty authentication settings were not found.');
  }
  const desiredPool = structuredClone(pool), desiredClient = structuredClone(client);
  desiredPool.Policies.PasswordPolicy = { ...pool.Policies.PasswordPolicy,
    MinimumLength: 10, RequireUppercase: true, RequireLowercase: true, RequireNumbers: true,
  };
  // Short-lived API tokens and revocation remain unchanged; only refresh lifetime grows.
  desiredClient.RefreshTokenValidity = 365;
  desiredClient.TokenValidityUnits = { ...client.TokenValidityUnits, RefreshToken: 'days' };
  const changes = { PasswordMinimum: [pool.Policies.PasswordPolicy.MinimumLength, 10],
    RefreshDays: [client.RefreshTokenValidity, 365], PoolSnapshotHash: hash(pool), ClientSnapshotHash: hash(client) };
  if (!process.argv.includes('--apply')) { console.log(JSON.stringify({ mode: 'plan', changes })); }
  else {
    const backup = fs.mkdtempSync(path.join(os.tmpdir(), 'smarty-auth-settings-20261013-'));
    fs.chmodSync(backup, 0o700);
    fs.writeFileSync(path.join(backup, 'before-pool.json'), JSON.stringify(pool, null, 2), { mode: 0o600 });
    fs.writeFileSync(path.join(backup, 'before-client.json'), JSON.stringify(client, null, 2), { mode: 0o600 });
    if (hash(readPool()) !== hash(pool) || hash(readClient()) !== hash(client)) throw new Error('Settings changed concurrently. No update applied.');
    if (hash(pool) !== hash(desiredPool)) call(['update-user-pool', '--cli-input-json', JSON.stringify(desiredPool)]);
    if (hash(readPool()) !== hash(desiredPool)) throw new Error('Pool preservation check failed. Stop and inspect rollback snapshot.');
    if (hash(readClient()) !== hash(client)) throw new Error('Client changed concurrently. Its update was not applied.');
    if (hash(client) !== hash(desiredClient)) call(['update-user-pool-client', '--cli-input-json', JSON.stringify(desiredClient), '--query', 'UserPoolClient.ClientId']);
    if (hash(readClient()) !== hash(desiredClient)) throw new Error('Client preservation check failed. Stop and inspect rollback snapshot.');
    console.log(JSON.stringify({ mode: 'applied', backup, passwordMinimum: 10, refreshDays: 365,
      preservedOtherPoolSettings: true, preservedOtherClientSettings: true, revokedSessions: false }));
  }
} catch (error) {
  // Don't emit CLI arguments or entire service responses.
  const code = String(error.stderr || '').match(/\(([A-Za-z]+Exception)\)/)?.[1];
  console.error(code || (error.stderr ? 'Authentication settings command failed.' : error.message));
  process.exitCode = 1;
}
