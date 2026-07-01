// Note: This is the list of formats
// The rules that formats use are stored in data/rulesets.ts
/*
If you want to add custom formats, create a file in this folder named: "custom-formats.ts"

Paste the following code into the file and add your desired formats and their sections between the brackets:
--------------------------------------------------------------------------------
// Note: This is the list of formats
// The rules that formats use are stored in data/rulesets.ts

export const Formats: FormatList = [
];
--------------------------------------------------------------------------------

If you specify a section that already exists, your format will be added to the bottom of that section.
New sections will be added to the bottom of the specified column.
The column value will be ignored for repeat sections.
*/

export const Formats: import('../sim/dex-formats').FormatList = [

	// S/V Singles
	///////////////////////////////////////////////////////////////////
	{
		section: "Pokémon Copper (New Pokémon Only)",
	},
	{
		name: "[Gen 9] New Pokémon Singles (3v3)",
		desc: 'Single battle with Pok&eacute;mon new to Pok&eacute;mon Copper',
		mod: 'gen9',
		bestOfDefault: true,
		ruleset: ['Standard', 'Azori Exclusives', 'Flat Rules', 'VGC Timer', 'Terastal Clause'],
	},
	{
		name: "[Gen 9] New Pokémon Singles (6v6)",
		desc: 'Single battle with Pok&eacute;mon new to Pok&eacute;mon Copper',
		mod: 'gen9',
		bestOfDefault: true,
		ruleset: ['Standard', 'Azori Exclusives', 'VGC Timer', 'Terastal Clause'],
	},
	{
		name: "[Gen 9] New Pokémon Doubles (4v4)",
		desc: 'Double battle with Pok&eacute;mon new to Pok&eacute;mon Copper',
		mod: 'gen9',
		gameType: 'doubles',
		bestOfDefault: true,
		ruleset: ['Standard Doubles', 'Azori Exclusives', 'Flat Rules', 'VGC Timer', 'Terastal Clause'],
	},
	{
		name: "[Gen 9] New Pokémon Doubles (6v6)",
		desc: 'Double battle with Pok&eacute;mon new to Pok&eacute;mon Copper',
		mod: 'gen9',
		gameType: 'doubles',
		bestOfDefault: true,
		ruleset: ['Standard Doubles', 'Azori Exclusives', 'VGC Timer', 'Terastal Clause'],
	},
	{
		section: "Pokémon Copper (Azori Pokédex)",
	},
	{
		name: "[Gen 9] Azori Pokédex Singles (3v3)",
		desc: 'Single battle with Pok&eacute;mon from the Azori Pok&eacute;dex',
		mod: 'gen9',
		bestOfDefault: true,
		ruleset: ['Standard', 'Azori Pokedex', 'Flat Rules', 'VGC Timer', 'Terastal Clause'],
	},
	{
		name: "[Gen 9] Azori Pokédex Singles (6v6)",
		desc: 'Single battle with Pok&eacute;mon from the Azori Pok&eacute;dex',
		mod: 'gen9',
		bestOfDefault: true,
		ruleset: ['Standard', 'Azori Pokedex', 'VGC Timer', 'Terastal Clause'],
	},
	{
		name: "[Gen 9] Azori Pokédex Doubles (4v4)",
		desc: 'Double battle with Pok&eacute;mon from the Azori Pok&eacute;dex',
		mod: 'gen9',
		gameType: 'doubles',
		bestOfDefault: true,
		ruleset: ['Standard Doubles', 'Azori Pokedex', 'Flat Rules', 'VGC Timer', 'Terastal Clause'],
	},
	{
		name: "[Gen 9] Azori Pokédex Doubles (6v6)",
		desc: 'Double battle with Pok&eacute;mon from the Azori Pok&eacute;dex',
		mod: 'gen9',
		gameType: 'doubles',
		bestOfDefault: true,
		ruleset: ['Standard Doubles', 'Azori Pokedex', 'Flat Rules', 'VGC Timer', 'Terastal Clause'],
	},
	{
		section: "Pokémon Copper (National Pokédex)",
	},
	{
		name: "[Gen 9] National Pokédex Singles (3v3)",
		desc: 'Single battle with all Pok&eacute;mon in the National Pok&eacute;dex',
		mod: 'gen9',
		bestOfDefault: true,
		ruleset: ['Standard', 'Flat Rules', 'VGC Timer', 'Open Team Sheets', 'Terastal Clause'],
	},
		{
		name: "[Gen 9] National Pokédex Singles (6v6)",
		desc: 'Single battle with all Pok&eacute;mon in the National Pok&eacute;dex',
		mod: 'gen9',
		bestOfDefault: true,
		ruleset: ['Standard', 'VGC Timer', 'Open Team Sheets', 'Terastal Clause'],
	},
	{
		name: "[Gen 9] National Pokédex Doubles (4v4)",
		desc: 'Double battle with all Pok&eacute;mon in the National Pok&eacute;dex',
		mod: 'gen9',
		gameType: 'doubles',
		bestOfDefault: true,
		ruleset: ['Standard Doubles', 'Flat Rules', 'VGC Timer', 'Open Team Sheets', 'Terastal Clause'],
	},
	{
		name: "[Gen 9] National Pokédex Doubles (6v6)",
		desc: 'Double battle with all Pok&eacute;mon in the National Pok&eacute;dex',
		mod: 'gen9',
		gameType: 'doubles',
		bestOfDefault: true,
		ruleset: ['Standard Doubles', 'VGC Timer', 'Open Team Sheets', 'Terastal Clause'],
	},
];
