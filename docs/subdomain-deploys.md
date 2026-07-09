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

## CI / auto-deploy on push

`ship` does not itself set up CI, but you usually get it for free anyway:
when `ship` first links a project, **Vercel auto-connects the GitHub repo if
the directory has an `origin` remote**. Once connected:

- push to the repo's **default branch** → production deploy on the subdomain
- open a **PR** → a preview URL is posted on the PR

No workflow file or secrets — it's Vercel's native Git integration, building
in their cloud. Check/(re)connect a project with `vercel git connect` from
its directory; a project with **no** git remote at link time has no CI and
only deploys via manual `ship`.

Two deploy paths then coexist, and they build different things:

| Path        | Builds…                          | Use for                        |
|-------------|----------------------------------|--------------------------------|
| `ship`      | your **working tree** (uncommitted/untracked files included) | instant deploy of WIP, before committing |
| `git push`  | your **committed** code on GitHub | the durable, reviewable deploy |

Gotcha: because `ship` uploads the working tree, uncommitted WIP can break
the remote build (this is why openaim has a `.vercelignore`). A `git push`
build only sees committed files, so it's insulated from untracked scratch
work but will faithfully deploy whatever you *did* commit — including a
broken commit. If you don't want every commit to go live, don't connect the
repo (or point production at a branch you control) and just use `ship`.

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
