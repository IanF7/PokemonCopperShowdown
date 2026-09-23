/**
 * Usage stats
 *
 * Reads the battle logs the server already writes (logs/<month>/<format>/<date>/*.log.json,
 * each holding both full teams and the winner) and tallies how often each Pokemon
 * is used and how often it wins. Meant for deciding tiers once the server has
 * been played on for a while.
 *
 * Nothing writes here: it's a read-only pass over files that already exist.
 * Rated battles are always logged; set `Config.logchallenges = true` to include
 * challenge battles too.
 *
 * @license MIT
 */

import { FS } from '../lib';

export interface SpeciesUsage {
	species: string;
	/** teams that included it */
	teams: number;
	/** share of teams that included it, 0-1 */
	usage: number;
	wins: number;
	losses: number;
	/** wins / (wins + losses), or null if it has no decided battles yet */
	winRate: number | null;
	items: { [item: string]: number };
	abilities: { [ability: string]: number };
	moves: { [move: string]: number };
}
export interface FormatUsage {
	format: string;
	battles: number;
	teams: number;
	pokemon: SpeciesUsage[];
}

const LOGS_DIR = 'logs';

// defined here rather than using the global `toID`, so tools/usage-report can
// require this module on its own, outside the running server
const toUserid = (text: string) => ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '');

function topEntries(counts: { [k: string]: number }, limit: number) {
	return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}
export function summarize(counts: { [k: string]: number }, total: number, limit = 3) {
	return topEntries(counts, limit)
		.map(([name, n]) => `${name} ${Math.round(n / total * 100)}%`)
		.join(', ');
}

/**
 * @param since only count battles on or after this date (YYYY-MM-DD)
 * @param formatFilter only count this format id
 */
export async function collect(options: { since?: string, format?: string } = {}) {
	const formats = new Map<string, FormatUsage>();
	const perSpecies = new Map<string, Map<string, SpeciesUsage>>();

	const months = await FS(LOGS_DIR).readdir().catch(() => [] as string[]);
	for (const month of months.sort()) {
		if (!/^\d{4}-\d{2}$/.test(month)) continue;
		if (options.since && month < options.since.slice(0, 7)) continue;
		const formatIds = await FS(`${LOGS_DIR}/${month}`).readdir().catch(() => [] as string[]);
		for (const formatId of formatIds) {
			if (options.format && formatId !== options.format) continue;
			const days = await FS(`${LOGS_DIR}/${month}/${formatId}`).readdir().catch(() => [] as string[]);
			for (const day of days.sort()) {
				if (options.since && day < options.since) continue;
				const files = await FS(`${LOGS_DIR}/${month}/${formatId}/${day}`).readdir().catch(() => [] as string[]);
				for (const file of files) {
					if (!file.endsWith('.log.json')) continue;
					let battle;
					try {
						battle = JSON.parse(await FS(`${LOGS_DIR}/${month}/${formatId}/${day}/${file}`).read());
					} catch {
						continue; // a half-written or corrupt log shouldn't stop the report
					}
					if (!battle?.p1team || !battle?.p2team) continue;

					if (!formats.has(formatId)) {
						formats.set(formatId, { format: formatId, battles: 0, teams: 0, pokemon: [] });
						perSpecies.set(formatId, new Map());
					}
					const formatUsage = formats.get(formatId)!;
					const speciesMap = perSpecies.get(formatId)!;
					formatUsage.battles++;

					const winner = typeof battle.winner === 'string' ? toUserid(battle.winner) : '';
					for (const [player, team] of [[battle.p1, battle.p1team], [battle.p2, battle.p2team]] as const) {
						if (!Array.isArray(team)) continue;
						formatUsage.teams++;
						const won = !!winner && toUserid(player) === winner;
						const decided = !!winner;
						// count each Pokemon once per team, even if somehow duplicated
						const seen = new Set<string>();
						for (const set of team) {
							const name = set?.species || set?.name;
							if (!name || seen.has(name)) continue;
							seen.add(name);
							if (!speciesMap.has(name)) {
								speciesMap.set(name, {
									species: name, teams: 0, usage: 0, wins: 0, losses: 0, winRate: null,
									items: {}, abilities: {}, moves: {},
								});
							}
							const entry = speciesMap.get(name)!;
							entry.teams++;
							if (decided) {
								if (won) entry.wins++; else entry.losses++;
							}
							if (set.item) entry.items[set.item] = (entry.items[set.item] || 0) + 1;
							if (set.ability) entry.abilities[set.ability] = (entry.abilities[set.ability] || 0) + 1;
							for (const move of set.moves || []) entry.moves[move] = (entry.moves[move] || 0) + 1;
						}
					}
				}
			}
		}
	}

	for (const [formatId, formatUsage] of formats) {
		const speciesMap = perSpecies.get(formatId)!;
		formatUsage.pokemon = [...speciesMap.values()].map(entry => {
			const decided = entry.wins + entry.losses;
			return {
				...entry,
				usage: formatUsage.teams ? entry.teams / formatUsage.teams : 0,
				winRate: decided ? entry.wins / decided : null,
			};
		}).sort((a, b) => b.teams - a.teams || a.species.localeCompare(b.species));
	}
	return [...formats.values()].sort((a, b) => b.battles - a.battles);
}
