Cries for the new Pokemon go in this folder as MP3 files, named by the
Pokemon's ID (lowercase, no spaces or punctuation), e.g. latremor.mp3.

Megas and alternate formes reuse their base Pokemon's cry, so only one file
per new Pokemon is needed. Exceptions with their own cry: brawnsoonflood.mp3
and puradoxdeadstate.mp3 (to add more, list the forme ID in CUSTOM_FORME_CRIES
in src/battle-dex.ts and rebuild the client). Real Pokemon (including your new megas/Azorian forms
of them) already use the official cries. A missing file just means no sound.

Files this folder is looking for (113):

lagavo lagavien latremor sparcyx aurorun aurocyx platyke platyspar platypunch
wrini wrengal wrengade wrenquiem burrot burthrow larfluff cocoonix luminoth
bikkunise snuffluff kamakid kamasei stellopod cephastar celumina whimsijack
tanukiroot branuki treenuki rolil rolidozer volten panthere phantohm parapossum
charcupine scorcupine rattleghast spectrattle jabberoo clobberoo rootality
marling martana parkel parktic cluddle adolem adobalith stalcria stalpaca embush
horeburn eimole treimor cheimgar alacruico diablare diablaze cypup cyprowl
apozip apozoom salaphyt phyloch torreloch dustcoon toxcoon stegodite stegeodon
obsidodile obsidoruth brawnsoon polterick deceptjinn bullectric capacitaur
magnetaur fridglet frigidae chupacarno spritanium titanimaam chember flaenix
infernoix toxila gilagon oracub roaracle outlage sileam naiadance naiphoria
puradox jarmbat dvarmbat dvarmith lediboss linturna volstrika fueghorn cuburn
taiburn saburn qinlong yinlong jinlong azordin rokentro coradios faeolith
pyrotic

(Each name + .mp3. After adding files: commit, push, and run deploy/update.sh
on the VM -- no rebuild needed.)
