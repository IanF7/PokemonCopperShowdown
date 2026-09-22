# Hosting guide

The game server (`pokemon-showdown`) also serves the custom client
(`pokemon-showdown-client/play.pokemonshowdown.com`) from the same port. There
is no login server: players click **Choose name** and pick any name that isn't
taken. Nothing else needs to run.

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

## Admin powers

There are currently no admins: `pokemon-showdown/config/usergroups.csv` is
empty, so every name (including Starcrafter347) is free for anyone to pick.

To make a name an admin later, add a line like `Starcrafter347,~` to that
file. The name is then locked behind a password:

1. Set the password (once on your PC, once on the VM, since it's stored in the
   git-ignored `config/trusted-passwords.json`, never on GitHub):

   ```
   cd pokemon-showdown
   node tools/set-password Starcrafter347
   ```

   On the VM that's `cd ~/showdown/pokemon-showdown` first. No restart is
   needed.
2. On your site, type this in any chat box (e.g. the Lobby):

   ```
   /trn Starcrafter347,0,yourpassword
   ```

   You're renamed to `~Starcrafter347` with admin powers. Do it again after
   reloading the page. Five wrong passwords lock that IP out for 10 minutes.

Don't use the **Choose name** button for a locked name: it has no password
field, so it fails and the client keeps retrying it on every reload. If that
happens, pick a normal name to clear it.

Your real Pokémon Showdown account still works as a fallback: sign in through
the official client at `http://<VM IP with dots replaced by dashes>--80.insecure.psim.us`
(for example `http://136-118-31-1--80.insecure.psim.us`). That page shows
standard Pokémon Showdown data, so use it for moderation only.

## What doesn't work (no login server)

- Registered accounts and passwords, so anyone can use any unranked name.
- The ladder page, uploading replays and custom avatars (these need PHP or the
  official servers).

Battles, chat, the teambuilder, challenges and tournaments all work.

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
