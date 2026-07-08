# Shipping side projects to `<name>.pramit.gg`

Any project in `~/Github` can go live on a subdomain with one command:

```bash
cd ~/Github/openaim
ship                 # → https://openaim.pramit.gg
```

`ship` lives at `scripts/ship.sh` in this repo and is symlinked to
`~/.local/bin/ship`. It deploys the current directory as its own Vercel
project (auto-created on first run, named after the directory) and attaches
`<name>.pramit.gg` to that project, so every production deploy serves the
subdomain. Re-running it redeploys.

Tip: add a `.vercelignore` to the project so WIP files (tests, logs, docs)
don't get uploaded — or break the remote build. See `~/Github/openaim` for
an example.

```bash
ship             # subdomain = directory name
ship aim         # override → aim.pramit.gg
ship --preview   # throwaway *.vercel.app preview, no subdomain touched
```

## One-time setup (already needed once per machine / once ever)

1. **Vercel login** (per machine) — must be the account that owns pramit.gg:

   ```bash
   vercel login
   ```

2. **Wildcard DNS** (once ever) — in Namecheap → pramit.gg → Advanced DNS,
   add:

   | Type  | Host | Value                  |
   |-------|------|------------------------|
   | CNAME | `*`  | `cname.vercel-dns.com` |

   This makes every `*.pramit.gg` subdomain resolve to Vercel, so new
   projects need zero DNS work. Subdomains with no Vercel project attached
   just show Vercel's not-found page.

   **Existing records are safe**: explicit DNS records always take
   precedence over a wildcard, so `@`/`www` (Vercel), `smeecher` (Hetzner),
   and `mail`/`webmail` (mxrouting) are unaffected. A future subdomain can
   still point elsewhere — an explicit record overrides the wildcard for
   that name.

   **Prefer no catch-all?** Skip the wildcard and instead add one explicit
   record per project: CNAME `<name>` → `cname.vercel-dns.com`. `ship`
   detects missing DNS and prints exactly what to add.

## Notes

- Vercel auto-detects the framework (Vite, Next.js, plain static, etc.).
  A project with no build step deploys as static files.
- Because the apex `pramit.gg` is already verified on the Vercel account,
  `vercel alias` attaches subdomains instantly and SSL certs are issued
  automatically.
- Env vars for a side project: `vercel env add KEY` from inside that
  project's directory (or the Vercel dashboard), then redeploy with `ship`.
- Each project gets a `.vercel/` directory (the project link) — it's
  gitignored by Vercel automatically.
- To take a project down: `vercel project rm <name>` (the DNS wildcard means
  nothing else to clean up).
