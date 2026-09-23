# Hosting guide

The game server (`pokemon-showdown`) also serves the custom client
(`pokemon-showdown-client/play.pokemonshowdown.com`) from the same port. There
is no separate login server: the game server also handles accounts (see
"Accounts and ranked battles"). Nothing else needs to run.

## Testing on your PC

Double-click `start-local.cmd`, or run it from a terminal. It builds the
client and server, starts the server, and opens http://localhost:8000.

## Putting it online (Google Cloud free tier)

### 1. Push your code

After building locally, commit everything, including the built files in
`play.pokemonshowdown.com/js`, `data` and `sprites`, and push to GitHub. The VM
serves the client straight from git, so it never has to build the client.

### 2. Create the VM (one time)

In the Google Cloud console, go to **Compute Engine → VM instances → Create
instance**:

- **Region:** `us-west1`, `us-central1` or `us-east1`. Only these regions are
  in the free tier.
- **Machine type:** `e2-micro`
- **Boot disk:** Debian 12, *Standard persistent disk*, 30 GB or less
- **Firewall:** tick **Allow HTTP traffic**. This opens port 80.

Then go to **VPC network → IP addresses**, find the VM's external IP, and click
**Promote to static**. Otherwise the IP (and your link) can change when the VM
restarts.

If you still have the VM from before (`136.118.31.1`), you can reuse it. Make
sure it's `e2-micro` in one of those regions and has **Allow HTTP traffic**
ticked.

### 3. Install (one time)

Click **SSH** next to the VM, then run:

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/IanF7/PokemonCopperShowdown.git showdown
sudo bash showdown/deploy/setup-vm.sh
```

If the GitHub repo is private, `git clone` asks for your GitHub username and a
[personal access token](https://github.com/settings/tokens) (not your
password).

When it finishes, it prints your link, `http://<VM IP>/`. Share that link.

### 4. Updating

Make changes on your PC, build, commit and push. Then SSH into the VM and run:

```bash
bash showdown/deploy/update.sh
```

To watch the server log: `sudo journalctl -u showdown -f`

Players see updates as soon as they reload: the client build stamps every
script and stylesheet in `index-selfhosted.html` with a hash of its contents,
so a changed file gets a new address and browsers can't serve a stale copy.
The one exception is a file you *replace* under the same name, such as a
redrawn sprite or a re-recorded cry. Those are cached for an hour, so reload
with Ctrl+F5 (Cmd+Shift+R on a Mac) to see the new version straight away.

## Cost

The e2-micro VM, 30 GB disk and 1 GB/month of outgoing traffic are in Google's
always-free tier. Two caveats:

- **External IP address:** Google now bills for in-use IPv4 addresses (about
  $3–4/month). Check whether your account is charged under **Billing →
  Reports**.
- **Traffic:** normal Pokémon sprites and sounds load from
  play.pokemonshowdown.com, not your VM. Your VM only sends the custom client
  (a few MB the first time each visitor loads it), so 1 GB goes a long way.

Set a budget alert (**Billing → Budgets & alerts**, e.g. $5) so nothing
surprises you.

## Custom cries

Put MP3s in `pokemon-showdown-client/play.pokemonshowdown.com/audio/cries/`,
named by Pokémon ID (e.g. `latremor.mp3`). The README in that folder lists all
113 expected names. Commit, push and run `update.sh`. No rebuild is needed.

## Accounts and ranked battles

Players can register a name with a password, like on regular Pokémon Showdown:

- **Register:** pick a name, click it at the top right, choose **Register**.
  After that only the owner can use it. Passwords must be at least 8
  characters (a few random words work well).
- **Log in:** choosing a registered name asks for its password. "Stay logged
  in" keeps you logged in on that device for 30 days.
- **Rated battles** (the **Battle!** button) need a registered name.
  Unregistered players still get matched, but their battles aren't rated.
  Challenges are always unrated. To see ratings, type `/rank` or
  `/rank [name]` in chat.

### How it's protected

- Passwords are hashed with Argon2id (OWASP's recommended algorithm: 19 MiB,
  2 passes), with a random salt per password and a server-wide secret key
  (`config/accounts-secret.key`) kept apart from the hashes
  (`config/accounts.json`). Both files stay on the server: they're
  git-ignored, so they never reach GitHub.
- Password rules follow NIST SP 800-63B, at its 8-character floor rather than
  the stricter 15 it prefers for password-only logins: no forced symbols, and
  a check against passwords leaked in data breaches (Have I Been Pwned: only
  the first 5 characters of the password's SHA-1 hash are sent, never the
  password). Change `PASSWORD_MIN_LENGTH` in `server/local-accounts.ts` to
  raise it.
- 5 wrong passwords lock that IP out for 15 minutes. 50 wrong passwords on one
  account in an hour pause password logins to it for an hour.
- Passwords only travel over HTTPS: the site refuses to send them over
  `http://`, HSTS tells browsers to always use HTTPS, and the game server only
  accepts connections through Caddy. They're never written to any log or the
  browser console.
- "Stay logged in" tokens are random 256-bit values, stored on the server only
  as hashes, and expire after 30 days. Logging out or changing your password
  revokes them.

### Managing accounts (server owner)

There's no email, so you reset forgotten passwords yourself, on the VM:

```bash
cd ~/showdown/pokemon-showdown
node tools/set-password SomeName            # reset (or create) a password; logs them out everywhere
node tools/set-password --delete SomeName   # delete an account
node tools/set-password --list              # list registered names
```

**Keep `config/accounts.json` and `config/accounts-secret.key` together.**
Without the key, no existing password works. `update.sh` copies both into
`~/showdown-config-backup-*` each time it runs.

## Admin powers

There are currently no admins (`pokemon-showdown/config/usergroups.csv` is
empty). To make a name an admin, add a line like `Starcrafter347,~` to that
file, commit, push and run `update.sh`. If the name isn't registered yet, give
it an account on the VM with `node tools/set-password Starcrafter347`. Then
log in with that name on the site like any other account.

## What doesn't work (no login server)

- Password reset by email (the server owner resets passwords instead).
- The ladder page, uploading replays and custom avatars (these need PHP or the
  official servers).

Battles, chat, the teambuilder, challenges, tournaments, accounts and ratings
(via `/rank`) all work.

## Optional: a free domain name and HTTPS

1. Make the VM's IP static (**VPC network → IP addresses → Promote to static**).
2. Get a free name at [duckdns.org](https://www.duckdns.org) (sign in, add a
   subdomain, set its IP to the VM's IP), or point a domain you own at the IP.
3. Edit the VM and tick **Allow HTTPS traffic** (keep **Allow HTTP traffic**
   ticked too, since the certificate check and the http→https redirect use it).
4. On the VM:

   ```bash
   cd ~/showdown && git pull
   sudo bash deploy/setup-https.sh yourname.duckdns.org
   ```

This installs [Caddy](https://caddyserver.com/), which gets and renews a free
Let's Encrypt certificate, serves `https://yourname.duckdns.org/`, and forwards
to Pokémon Showdown, which moves to port 8000. The client picks up the new
address automatically. The bare IP link stops working, so share the domain
instead. `update.sh` works as before. If the certificate fails, check
`sudo journalctl -u caddy -n 50`.
