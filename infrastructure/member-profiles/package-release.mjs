// Produces a local zip only. Does not modify AWS or the original artifact.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [source, destination] = process.argv.slice(2);
if (!source || !destination || existsSync(destination)) {
  throw new Error('Usage: node package-release.mjs existing-profile.zip new-profile.zip (new path required)');
}
const baseline = 'b1dd8956527d1dea79495533f9ed35b6e655222a61ac1164cd7ac6a56dc452c0';
const input = resolve(source);
if (createHash('sha256').update(readFileSync(input)).digest('hex') !== baseline) {
  throw new Error('The existing profile package changed. Review its source before packaging this update.');
}
const stage = mkdtempSync(join(tmpdir(), 'smarty-member-profiles-'));
const legacy = execFileSync('unzip', ['-p', input, 'lambda_function.py'], { encoding: 'utf8', maxBuffer: 128 * 1024 });
const shim = `
from member_profile_reader import with_member_profiles

lambda_handler = with_member_profiles(
    lambda_handler, get_method=get_method, get_claims=get_claims, response=response,
    users=users_table, blocks=dynamodb.Table(os.environ.get("BLOCKS_TABLE", "UserBlocks")),
    follows=dynamodb.Table(os.environ.get("FOLLOWS_TABLE", "UserFollows")),
    sign_photo=signed_url, bucket=BUCKET_NAME,
)
`;
writeFileSync(join(stage, 'lambda_function.py'), legacy + '\n' + shim, { flag: 'wx' });
copyFileSync(fileURLToPath(new URL('./member_profile_reader.py', import.meta.url)), join(stage, 'member_profile_reader.py'));
execFileSync('zip', ['-q', resolve(destination), 'lambda_function.py', 'member_profile_reader.py'], { cwd: stage });
console.log('Built the member-profile release archive locally.');
