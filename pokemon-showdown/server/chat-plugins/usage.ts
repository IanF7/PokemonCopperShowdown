/**
 * /usage - shows which Pokemon are actually being used, from the battle logs.
 *
 * Built for retiering this game's Pokemon once people have played for a while.
 * See server/usage-stats.ts for where the numbers come from.
 *
 * @license MIT
 */

import { collect, summarize } from '../usage-stats';

export const commands: Chat.ChatCommands = {
	usage: {
		async ''(target, room, user) {
			const [formatTarget, sinceTarget] = target.split(',').map(part => part.trim());
			const format = formatTarget ? toID(formatTarget) : '';
			const since = /^\d{4}-\d{2}-\d{2}$/.test(sinceTarget || '') ? sinceTarget : undefined;

			if (format && !Dex.formats.get(format).exists) {
				throw new Chat.ErrorMessage(`Unknown format "${formatTarget}". Use /usage to see every format.`);
			}
			this.runBroadcast();
			const stats = await collect({ format: format || undefined, since });
			if (!stats.length) {
				return this.sendReplyBox(
					`No battles have been recorded yet${since ? ` since ${since}` : ''}.<br />` +
					`Rated battles (the "Battle!" button) are always recorded; challenges only if ` +
					`<code>Config.logchallenges</code> is on.`
				);
			}

			// no format given: one line per format, so you can see where people are playing
			if (!format) {
				let buf = `<strong>Usage so far${since ? ` (since ${since})` : ''}</strong><br />`;
				buf += `<small>Type <code>/usage [format]</code> for a full list.</small>`;
				buf += `<table><tr><th>Format</th><th>Battles</th><th>Most used</th></tr>`;
				for (const entry of stats) {
					const top = entry.pokemon.slice(0, 5)
						.map(p => `${p.species} ${Math.round(p.usage * 100)}%`).join(', ');
					buf += `<tr><td>${Dex.formats.get(entry.format).name || entry.format}</td>` +
						`<td>${entry.battles}</td><td>${top || '-'}</td></tr>`;
				}
				buf += `</table>`;
				return this.sendReplyBox(buf);
			}

			const entry = stats[0];
			const formatName = Dex.formats.get(entry.format).name || entry.format;
			let buf = `<strong>${formatName}</strong>: ${entry.battles} battle${entry.battles === 1 ? '' : 's'}, ` +
				`${entry.teams} teams${since ? `, since ${since}` : ''}<br />`;
			if (entry.battles < 50) {
				buf += `<small>Only ${entry.battles} battles so far, so treat these as a rough hint.</small><br />`;
			}
			buf += `<table><tr><th>#</th><th>Pokemon</th><th>Usage</th><th>Win rate</th><th>Common item / ability</th></tr>`;
			entry.pokemon.slice(0, 50).forEach((p, i) => {
				const winRate = p.winRate === null ? '-' : `${Math.round(p.winRate * 100)}%`;
				buf += `<tr><td>${i + 1}</td><td>${p.species}</td><td>${(p.usage * 100).toFixed(1)}%</td>` +
					`<td>${winRate} <small>(${p.wins}-${p.losses})</small></td>` +
					`<td><small>${summarize(p.items, p.teams, 1) || '-'} / ${summarize(p.abilities, p.teams, 1) || '-'}</small></td></tr>`;
			});
			buf += `</table>`;
			if (entry.pokemon.length > 50) {
				buf += `<small>...and ${entry.pokemon.length - 50} more. Run ` +
					`<code>node tools/usage-report --format ${entry.format} --csv usage.csv</code> on the server for the full list.</small>`;
			}
			this.sendReplyBox(buf);
		},

		help: [
			`/usage - Shows how many battles each format has had and its most-used Pokemon.`,
			`/usage [format] - Shows usage and win rates for every Pokemon in that format.`,
			`/usage [format], [YYYY-MM-DD] - Only counts battles from that date onwards.`,
		],
	},
	usagehelp: [
		`/usage - Shows how many battles each format has had and its most-used Pokemon.`,
		`/usage [format] - Shows usage and win rates for every Pokemon in that format.`,
		`/usage [format], [YYYY-MM-DD] - Only counts battles from that date onwards.`,
	],
};
