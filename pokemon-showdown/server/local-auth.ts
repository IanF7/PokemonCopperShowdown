/**
 * Local auth protocol
 *
 * The self-hosted client sends `|/localauth {json}`; users.ts hands these
 * messages here before any logging or chat parsing, because they contain
 * passwords and session tokens. Replies are `|localauth|{json}`.
 *
 * Requests (`act`):
 *   login          {name, password, remember}
 *   token          {name, token}          - "stay logged in" session
 *   register       {password, cpassword, remember}   - registers your current name
 *   changepassword {oldpassword, password, cpassword, remember}
 *   logout         {name, token}          - revokes that session
 *
 * Never log a request, and never put one in an error message.
 *
 * @license MIT
 */

import * as LocalAccounts from './local-accounts';

export const PREFIX = '/localauth ';

const MINUTES = 60 * 1000;

// Failed password/token checks per IP: 5 in 15 minutes locks that IP out for 15 minutes.
const IP_MAX_FAILURES = 5;
const IP_WINDOW = 15 * MINUTES;
// Failed password checks per account, from any IP: 50 in an hour pauses password
// logins to it for an hour (NIST SP 800-63B: at most 100 consecutive failures).
// Existing "stay logged in" sessions keep working, so the owner isn't locked out.
const ACCOUNT_MAX_FAILURES = 50;
const ACCOUNT_WINDOW = 60 * MINUTES;
// Registrations per IP
const REGISTRATIONS_PER_IP = 3;
const REGISTRATION_WINDOW = 60 * MINUTES;
// Argon2 hashes in progress at once (each uses ~19 MiB, and the VM has 1 GB)
const MAX_CONCURRENT_HASHES = 4;
// longest password we'll even hash on login (new passwords are capped lower)
const MAX_INPUT_LENGTH = 1024;

interface Counter { count: number; windowStart: number; lockedUntil: number }
const ipFailures = new Map<string, Counter>();
const accountFailures = new Map<string, Counter>();
const registrations = new Map<string, Counter>();
let hashesInProgress = 0;

function isLocked(table: Map<string, Counter>, key: string) {
	const entry = table.get(key);
	return !!entry && entry.lockedUntil > Date.now();
}
/** returns true if this pushed the key over the limit */
function count(table: Map<string, Counter>, key: string, max: number, window: number, lockout: number) {
	const now = Date.now();
	let entry = table.get(key);
	if (!entry || now - entry.windowStart > window) {
		entry = { count: 0, windowStart: now, lockedUntil: 0 };
		table.set(key, entry);
	}
	entry.count++;
	if (entry.count >= max) {
		entry.lockedUntil = now + lockout;
		entry.count = 0;
		entry.windowStart = now;
		return true;
	}
	return false;
}
// forget expired entries so the tables can't grow forever
setInterval(() => {
	const now = Date.now();
	for (const [table, window] of [
		[ipFailures, IP_WINDOW], [accountFailures, ACCOUNT_WINDOW], [registrations, REGISTRATION_WINDOW],
	] as const) {
		for (const [key, entry] of table) {
			if (entry.lockedUntil < now && now - entry.windowStart > window) table.delete(key);
		}
	}
}, 10 * MINUTES).unref();

function reply(connection: Connection, data: AnyObject) {
	connection.send(`|localauth|${JSON.stringify(data)}`);
}
function fail(connection: Connection, act: string, error: string, extra: AnyObject = {}) {
	reply(connection, { type: 'error', act, error, ...extra });
}

const str = (value: unknown) => (typeof value === 'string' ? value : '');

/** runs a password hash/verify, refusing if the server is already busy hashing */
async function withHashSlot<T>(fn: () => Promise<T>): Promise<T | null> {
	if (hashesInProgress >= MAX_CONCURRENT_HASHES) return null;
	hashesInProgress++;
	try {
		return await fn();
	} finally {
		hashesInProgress--;
	}
}
const BUSY = `The server is busy. Please try again in a few seconds.`;

function lockedMessage(what: string) {
	return `Too many failed attempts${what}. Please wait 15 minutes and try again.`;
}

export async function handle(connection: Connection, json: string) {
	if (!Config.noguestsecurity) return; // only used on self-hosted servers without a login server
	if (connection.localAuthBusy) return fail(connection, '', `Please wait for your last request to finish.`);
	let request: AnyObject;
	try {
		request = JSON.parse(json);
	} catch {
		return;
	}
	if (!request || typeof request !== 'object') return;
	const act = str(request.act);
	connection.localAuthBusy = true;
	try {
		switch (act) {
		case 'login': await login(connection, request); break;
		case 'token': await tokenLogin(connection, request); break;
		case 'register': await register(connection, request); break;
		case 'changepassword': await changePassword(connection, request); break;
		case 'logout': await logout(connection, request); break;
		}
	} catch (err: any) {
		// log only the error itself: `request` holds the password
		Monitor.crashlog(err, 'Local accounts', { act });
		fail(connection, act, `Something went wrong on the server. Please try again later.`);
	} finally {
		// eslint-disable-next-line require-atomic-updates -- always released, whatever happened above
		connection.localAuthBusy = false;
	}
}

/** switches this connection's user to the (authenticated) account */
async function renameTo(connection: Connection, name: string, userid: ID) {
	connection.localAuthUserid = userid;
	try {
		await connection.user.rename(name, '', true, connection);
	} finally {
		// eslint-disable-next-line require-atomic-updates -- must always be cleared after the rename
		connection.localAuthUserid = null;
	}
	const user = connection.user;
	return !!user && user.id === userid && user.registered;
}

function displayName(requested: string, account: LocalAccounts.Account) {
	// allow changing capitalization/spacing of your own name, like regular PS
	return LocalAccounts.toID(requested) === LocalAccounts.toID(account.name) ? requested : account.name;
}

async function login(connection: Connection, request: AnyObject) {
	const name = str(request.name).replace(/[|,;]+/g, '').trim();
	const password = str(request.password);
	const userid = toID(name);
	const account = userid ? LocalAccounts.get(userid) : null;
	if (!account) return fail(connection, 'login', `The name "${name}" isn't registered.`, { name });
	if (!password || password.length > MAX_INPUT_LENGTH) return fail(connection, 'login', `Wrong password.`, { name });
	if (isLocked(ipFailures, connection.ip)) return fail(connection, 'login', lockedMessage(''), { name });
	if (isLocked(accountFailures, userid)) {
		return fail(connection, 'login', lockedMessage(` for this account`), { name });
	}

	const result = await withHashSlot(() => LocalAccounts.verifyPassword(password, account.password));
	if (!result) return fail(connection, 'login', BUSY, { name });
	if (!result.ok) {
		count(ipFailures, connection.ip, IP_MAX_FAILURES, IP_WINDOW, IP_WINDOW);
		count(accountFailures, userid, ACCOUNT_MAX_FAILURES, ACCOUNT_WINDOW, ACCOUNT_WINDOW);
		return fail(connection, 'login', `Wrong password.`, { name });
	}
	ipFailures.delete(connection.ip);
	if (result.outdated) void withHashSlot(() => LocalAccounts.rehashIfOutdated(userid, password)).catch(() => {});

	if (!await renameTo(connection, displayName(name, account), userid)) return;
	const token = request.remember ? await LocalAccounts.createSession(userid) : null;
	reply(connection, { type: 'loggedin', name: connection.user.name, userid, token });
}

async function tokenLogin(connection: Connection, request: AnyObject) {
	const name = str(request.name).replace(/[|,;]+/g, '').trim();
	const token = str(request.token);
	const userid = toID(name);
	// (an error, not 'tokeninvalid': the client would delete a token that may be fine)
	if (isLocked(ipFailures, connection.ip)) return fail(connection, 'token', lockedMessage(''), { name });
	const account = userid ? LocalAccounts.get(userid) : null;
	if (!account || !LocalAccounts.checkSession(userid, token)) {
		if (account) count(ipFailures, connection.ip, IP_MAX_FAILURES, IP_WINDOW, IP_WINDOW);
		return reply(connection, { type: 'tokeninvalid', name });
	}
	if (!await renameTo(connection, displayName(name, account), userid)) return;
	reply(connection, { type: 'loggedin', name: connection.user.name, userid, token: null, kept: true });
}

async function register(connection: Connection, request: AnyObject) {
	const user = connection.user;
	const password = str(request.password);
	if (!user.named) return fail(connection, 'register', `Choose a name first, then register it.`);
	if (user.registered || LocalAccounts.exists(user.id)) {
		return fail(connection, 'register', `The name "${user.name}" is already registered.`);
	}
	if (user.locked || user.namelocked) return fail(connection, 'register', `You can't register while locked.`);
	if (password !== str(request.cpassword)) return fail(connection, 'register', `Your passwords don't match.`);
	if (isLocked(registrations, connection.ip)) {
		return fail(connection, 'register', `Too many registrations from your network. Please try again in an hour.`);
	}
	if (password.length > MAX_INPUT_LENGTH) return fail(connection, 'register', `That password is too long.`);
	const problem = await LocalAccounts.checkNewPassword(password, user.id);
	if (problem) return fail(connection, 'register', problem);

	const name = user.name;
	const userid = user.id;
	const created = await withHashSlot(() => LocalAccounts.register(name, password));
	if (created === null) return fail(connection, 'register', BUSY);
	if (!created) return fail(connection, 'register', `The name "${name}" is already registered.`);
	count(registrations, connection.ip, REGISTRATIONS_PER_IP, REGISTRATION_WINDOW, REGISTRATION_WINDOW);
	Monitor.log(`[local accounts] ${name} registered from ${connection.ip}`);

	if (!await renameTo(connection, name, userid)) return;
	const token = request.remember ? await LocalAccounts.createSession(userid) : null;
	reply(connection, { type: 'loggedin', name: connection.user.name, userid, token, registered: true });
}

async function changePassword(connection: Connection, request: AnyObject) {
	const user = connection.user;
	const account = user.registered ? LocalAccounts.get(user.id) : null;
	if (!account) return fail(connection, 'changepassword', `You need to be logged in to a registered name.`);
	const oldPassword = str(request.oldpassword);
	const password = str(request.password);
	if (password !== str(request.cpassword)) return fail(connection, 'changepassword', `Your new passwords don't match.`);
	if (isLocked(ipFailures, connection.ip)) return fail(connection, 'changepassword', lockedMessage(''));
	if (!oldPassword || oldPassword.length > MAX_INPUT_LENGTH || password.length > MAX_INPUT_LENGTH) {
		return fail(connection, 'changepassword', `Your old password is wrong.`);
	}

	const result = await withHashSlot(() => LocalAccounts.verifyPassword(oldPassword, account.password));
	if (!result) return fail(connection, 'changepassword', BUSY);
	if (!result.ok) {
		count(ipFailures, connection.ip, IP_MAX_FAILURES, IP_WINDOW, IP_WINDOW);
		count(accountFailures, user.id, ACCOUNT_MAX_FAILURES, ACCOUNT_WINDOW, ACCOUNT_WINDOW);
		return fail(connection, 'changepassword', `Your old password is wrong.`);
	}
	const problem = await LocalAccounts.checkNewPassword(password, user.id);
	if (problem) return fail(connection, 'changepassword', problem);

	const userid = user.id;
	// also logs out every "stay logged in" session, in case the old password leaked
	const done = await withHashSlot(() => LocalAccounts.setPassword(account.name, password).then(() => true));
	if (!done) return fail(connection, 'changepassword', BUSY);
	Monitor.log(`[local accounts] ${account.name} changed their password from ${connection.ip}`);
	const token = request.remember ? await LocalAccounts.createSession(userid) : null;
	reply(connection, { type: 'passwordchanged', userid, token });
}

async function logout(connection: Connection, request: AnyObject) {
	const token = str(request.token);
	const userid = toID(str(request.name));
	if (token && userid) await LocalAccounts.revokeSession(userid, token);
}
