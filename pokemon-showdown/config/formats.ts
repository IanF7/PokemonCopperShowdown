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
		section: "Pokémon Copper",
	},
	{
		name: "[Gen 9] New Pokémon Singles",
		desc: 'Single battle with Pok&eacute;mon new to Pok&eacute;mon Copper',
		mod: 'gen9',
		bestOfDefault: true,
		ruleset: ['Standard', 'Azori Exclusives', 'Flat Rules', 'VGC Timer'],
	},
	{
		name: "[Gen 9] New Pokémon Doubles",
		desc: 'Double battle with Pok&eacute;mon new to Pok&eacute;mon Copper',
		mod: 'gen9',
		gameType: 'doubles',
		bestOfDefault: true,
		ruleset: ['Standard Doubles', 'Azori Exclusives', 'Flat Rules', 'VGC Timer'],
	},
	{
		name: "[Gen 9] Azori Pokédex Singles",
		desc: 'Single battle with Pok&eacute;mon from the Azori Pok&eacute;dex',
		mod: 'gen9',
		bestOfDefault: true,
		ruleset: ['Standard', 'Azori Pokedex', 'Flat Rules', 'VGC Timer'],
	},
	{
		name: "[Gen 9] Azori Pokédex Doubles",
		desc: 'Double battle with Pok&eacute;mon from the Azori Pok&eacute;dex',
		mod: 'gen9',
		gameType: 'doubles',
		bestOfDefault: true,
		ruleset: ['Standard Doubles', 'Azori Pokedex', 'Flat Rules', 'VGC Timer'],
	},
	{
		name: "[Gen 9] National Pokédex Singles",
		desc: 'Single battle with all Pok&eacute;mon in the National Pok&eacute;dex',
		mod: 'gen9',
		bestOfDefault: true,
		ruleset: ['Standard', 'Flat Rules', 'VGC Timer', 'Open Team Sheets'],
	},
	{
		name: "[Gen 9] National Pokédex Doubles",
		desc: 'Double battle with all Pok&eacute;mon in the National Pok&eacute;dex',
		mod: 'gen9',
		gameType: 'doubles',
		bestOfDefault: true,
		ruleset: ['Standard Doubles', 'Flat Rules', 'VGC Timer', 'Open Team Sheets'],
	},
];
