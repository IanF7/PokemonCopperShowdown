/**
 * Local accounts
 *
 * Registered names for a self-hosted server with no login server
 * (Config.noguestsecurity). Players register a name with a password; after
 * that, only someone with the password (or a "stay logged in" session token)
 * can use it. See HOSTING.md.
 *
 * Security notes (sources: OWASP Password Storage Cheat Sheet, NIST SP 800-63B):
 * - Passwords are hashed with Argon2id, m=19 MiB, t=2, p=1 (OWASP's first
 *   choice), with a random 16-byte salt per password, stored in PHC string
 *   format so the parameters can be raised later (hashes upgrade on login).
 * - A server-wide secret key ("pepper", Argon2's `secret` input) is kept in a
 *   separate file, so a leaked accounts file alone can't be brute-forced.
 * - Session tokens are 256-bit random values; only their SHA-256 is stored.
 *   They expire after 30 days and are revoked on logout / password change.
 * - Both files are written atomically and readable only by the server's user.
 *
 * This module has no Pokemon Showdown globals, so tools/set-password can use
 * it outside the server (from dist/).
 *
 * @license MIT
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, __dirname.includes(`${path.sep}dist${path.sep}`) ? '../..' : '..');
export const ACCOUNTS_FILE = path.join(ROOT, 'config/accounts.json');
export const SECRET_FILE = path.join(ROOT, 'config/accounts-secret.key');

// NIST SP 800-63B-4 asks for 15 for password-only logins; 8 is its floor, and
// enough for a game server given the breach check and lockouts below.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const SESSION_LIFETIME = 30 * 24 * 60 * 60 * 1000; // NIST AAL1: reauthenticate within 30 days
const MAX_SESSIONS_PER_ACCOUNT = 10;

// OWASP Argon2id minimum: 19 MiB memory, 2 iterations, 1 degree of parallelism
const ARGON2 = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };
const SALT_LENGTH = 16;

export interface Session {
	/** SHA-256 of the token, hex */
	hash: string;
	expires: number;
}
export interface Account {
	/** display name, as registered */
	name: string;
	/** PHC string: $argon2id$v=19$m=...,t=...,p=...$salt$hash */
	password: string;
	created: number;
	sessions: Session[];
}
type AccountTable = Record<string, Account>;

export function toID(text: string): string {
	return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/*********************************************************
 * Storage
 *********************************************************/

function readAccounts(): AccountTable {
	let raw: string;
	try {
		raw = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
	} catch (e: any) {
		if (e.code === 'ENOENT') return {};
		throw e;
	}
	return raw.trim() ? JSON.parse(raw) : {};
}

/** atomic write (temp file + rename) so a crash can't leave a half-written file */
function writeFileAtomic(file: string, data: string | Buffer) {
	const tmp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
	fs.writeFileSync(tmp, data, { mode: 0o600 });
	fs.renameSync(tmp, file);
	fs.chmodSync(file, 0o600);
}

// All changes go through this queue so two requests can't overwrite each
// other's changes. The file is re-read each time so edits made by
// tools/set-password while the server is running aren't lost.
let queue: Promise<unknown> = Promise.resolve();
export function update<T>(change: (accounts: AccountTable) => T | Promise<T>): Promise<T> {
	const run = queue.then(async () => {
		const accounts = readAccounts();
		const result = await change(accounts);
		writeFileAtomic(ACCOUNTS_FILE, JSON.stringify(accounts, null, '\t') + '\n');
		return result;
	});
	queue = run.catch(() => {});
	return run;
}

export function get(userid: string): Account | null {
	return readAccounts()[toID(userid)] || null;
}

export function exists(userid: string) {
	return !!get(userid);
}

/*********************************************************
 * Password hashing
 *********************************************************/

let secret: Buffer | null = null;
function getSecret(): Buffer {
	if (secret) return secret;
	if (fs.existsSync(SECRET_FILE)) {
		secret = fs.readFileSync(SECRET_FILE);
		if (secret.length < 32) throw new Error(`${SECRET_FILE} is corrupt (too short).`);
		return secret;
	}
	// Never silently make a new key if accounts already exist: every existing
	// password would stop working. Restore the key from a backup instead.
	if (Object.keys(readAccounts()).length) {
		throw new Error(
			`${SECRET_FILE} is missing but accounts exist. Restore it from a backup ` +
			`(update.sh keeps copies in ~/showdown-config-backup-*), or delete config/accounts.json to start over.`
		);
	}
	secret = crypto.randomBytes(32);
	writeFileAtomic(SECRET_FILE, secret);
	return secret;
}

function argon2(password: string, salt: Buffer, params: typeof ARGON2): Promise<Buffer> {
	if (typeof (crypto as any).argon2 !== 'function') {
		throw new Error(`Accounts need Node.js 24.7 or later (for built-in Argon2); this is ${process.version}.`);
	}
	return new Promise((resolve, reject) => {
		(crypto as any).argon2('argon2id', {
			message: Buffer.from(password, 'utf8'),
			nonce: salt,
			secret: getSecret(),
			...params,
		}, (err: Error | null, key: Buffer) => (err ? reject(err) : resolve(key)));
	});
}

const b64 = (buf: Buffer) => buf.toString('base64').replace(/=+$/, '');

/**
 * Passwords are compared after Unicode NFC normalization (NIST SP 800-63B-4),
 * so e.g. an accented letter typed on different keyboards still matches.
 */
export function normalizePassword(password: string) {
	return password.normalize('NFC');
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.randomBytes(SALT_LENGTH);
	const key = await argon2(normalizePassword(password), salt, ARGON2);
	const { memory: m, passes: t, parallelism: p } = ARGON2;
	return `$argon2id$v=19$m=${m},t=${t},p=${p}$${b64(salt)}$${b64(key)}`;
}

/** returns whether the password matches, and whether the stored hash uses outdated parameters */
export async function verifyPassword(password: string, stored: string) {
	const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(stored);
	if (!match) throw new Error(`Unrecognized password hash format`);
	const params = {
		memory: parseInt(match[1]), passes: parseInt(match[2]), parallelism: parseInt(match[3]), tagLength: 0,
	};
	const salt = Buffer.from(match[4], 'base64');
	const expected = Buffer.from(match[5], 'base64');
	params.tagLength = expected.length;
	const actual = await argon2(normalizePassword(password), salt, params);
	const ok = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
	const outdated = params.memory < ARGON2.memory || params.passes < ARGON2.passes ||
		params.parallelism !== ARGON2.parallelism || expected.length < ARGON2.tagLength;
	return { ok, outdated };
}

/*********************************************************
 * Password rules (NIST SP 800-63B-4)
 *********************************************************/

/**
 * Returns an error message, or null if the password is acceptable. No
 * composition rules (NIST forbids them); instead, length plus a check against
 * guessable and breached passwords.
 */
export async function checkNewPassword(password: string, userid: string): Promise<string | null> {
	const normalized = normalizePassword(password);
	const length = [...normalized].length;
	if (length < PASSWORD_MIN_LENGTH) {
		return `Your password must be at least ${PASSWORD_MIN_LENGTH} characters. ` +
			`Tip: a few random words are easy to remember and much harder to guess.`;
	}
	if (length > PASSWORD_MAX_LENGTH) {
		return `Your password can't be longer than ${PASSWORD_MAX_LENGTH} characters.`;
	}
	const simplified = toID(normalized);
	if (userid.length >= 3 && simplified.includes(userid)) {
		return `Your password can't contain your username.`;
	}
	// context-specific words, repeated patterns ("aaaa...", "abcabc..."), and sequences
	if (simplified === 'purplelanterncopperwaffle') {
		return `That's the example password everyone can see. Please make up your own.`;
	}
	const stripped = simplified.replace(/pokemon|showdown|copper|password|azori/g, '');
	if (stripped.length < 6) return `Your password is too easy to guess. Try adding a few unrelated words.`;
	if (/^(.{1,4})\1+.{0,3}$/.test(simplified)) return `Your password is too repetitive to be safe.`;
	if ('abcdefghijklmnopqrstuvwxyz0123456789'.includes(simplified) ||
		'qwertyuiopasdfghjklzxcvbnm'.includes(simplified) || '9876543210'.includes(simplified)) {
		return `Your password is too easy to guess.`;
	}
	const breachCount = await pwnedCount(normalized);
	if (breachCount > 0) {
		return `That password has appeared in ${breachCount.toLocaleString()} data breach${breachCount === 1 ? '' : 'es'} ` +
			`(checked privately with Have I Been Pwned), so attackers try it first. Please choose a different one.`;
	}
	return null;
}

/**
 * Have I Been Pwned "range" API with k-anonymity: only the first 5 characters
 * of the password's SHA-1 are sent, and responses are padded, so neither the
 * password nor its hash ever leaves this server. Returns 0 if the service
 * can't be reached (the other checks still apply).
 */
export async function pwnedCount(password: string): Promise<number> {
	const sha1 = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
	const prefix = sha1.slice(0, 5);
	const suffix = sha1.slice(5);
	try {
		const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
			headers: { 'Add-Padding': 'true', 'User-Agent': 'pokemon-showdown-local-accounts' },
			signal: AbortSignal.timeout(5000),
		});
		if (!response.ok) return 0;
		for (const line of (await response.text()).split('\n')) {
			const [lineSuffix, count] = line.trim().split(':');
			if (lineSuffix === suffix) return parseInt(count) || 0;
		}
	} catch {}
	return 0;
}

/*********************************************************
 * Sessions ("stay logged in")
 *********************************************************/

function hashToken(token: string) {
	return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function pruneSessions(account: Account) {
	const now = Date.now();
	account.sessions = account.sessions.filter(s => s.expires > now).slice(-MAX_SESSIONS_PER_ACCOUNT);
}

/** creates a session and returns its token (the only copy of it) */
export async function createSession(userid: string): Promise<string> {
	const token = crypto.randomBytes(32).toString('base64url');
	await update(accounts => {
		const account = accounts[toID(userid)];
		if (!account) throw new Error(`No account ${userid}`);
		account.sessions.push({ hash: hashToken(token), expires: Date.now() + SESSION_LIFETIME });
		pruneSessions(account);
	});
	return token;
}

export function checkSession(userid: string, token: string) {
	const account = get(userid);
	if (!account || typeof token !== 'string' || token.length > 100) return false;
	const hash = Buffer.from(hashToken(token), 'hex');
	const now = Date.now();
	let ok = false;
	for (const session of account.sessions) {
		// compare every session in constant time
		if (crypto.timingSafeEqual(hash, Buffer.from(session.hash, 'hex')) && session.expires > now) ok = true;
	}
	return ok;
}

export async function revokeSession(userid: string, token: string) {
	if (!get(userid)) return;
	const hash = hashToken(token);
	await update(accounts => {
		const account = accounts[toID(userid)];
		if (account) account.sessions = account.sessions.filter(s => s.hash !== hash);
	});
}

/*********************************************************
 * Account changes
 *********************************************************/

/** creates the account, or (if it exists) replaces its password and logs out all sessions */
export async function setPassword(name: string, password: string) {
	const userid = toID(name);
	const hash = await hashPassword(password);
	await update(accounts => {
		const account = accounts[userid];
		if (account) {
			account.password = hash;
			account.sessions = [];
		} else {
			accounts[userid] = { name, password: hash, created: Date.now(), sessions: [] };
		}
	});
}

/** only creates: fails if the name was registered in the meantime */
export async function register(name: string, password: string) {
	const userid = toID(name);
	const hash = await hashPassword(password);
	return update(accounts => {
		if (accounts[userid]) return false;
		accounts[userid] = { name, password: hash, created: Date.now(), sessions: [] };
		return true;
	});
}

export async function rehashIfOutdated(userid: string, password: string) {
	const hash = await hashPassword(password);
	await update(accounts => {
		if (accounts[toID(userid)]) accounts[toID(userid)].password = hash;
	});
}

export async function remove(userid: string) {
	return update(accounts => {
		const existed = !!accounts[toID(userid)];
		delete accounts[toID(userid)];
		return existed;
	});
}
