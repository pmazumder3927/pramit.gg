#!/usr/bin/env bash
# ship — deploy the current directory to <name>.pramit.gg via Vercel.
#
# usage:
#   ship                deploy this project to <dirname>.pramit.gg
#   ship <name>         deploy this project to <name>.pramit.gg
#   ship --preview      deploy a throwaway preview (vercel URL, no subdomain)
#
# one-time setup (see docs/subdomain-deploys.md):
#   1. vercel login            — same account that owns pramit.gg
#   2. Namecheap wildcard DNS  — CNAME  *  ->  cname.vercel-dns.com
set -euo pipefail

PREVIEW=0
NAME=""
for arg in "$@"; do
  case "$arg" in
    --preview) PREVIEW=1 ;;
    -h|--help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) NAME="$arg" ;;
  esac
done

# project name: arg or directory name, sanitized to a valid subdomain
NAME="${NAME:-$(basename "$PWD")}"
NAME=$(printf '%s' "$NAME" | tr '[:upper:]' '[:lower:]' | sed -e 's/[^a-z0-9-]/-/g' -e 's/^-*//' -e 's/-*$//')
DOMAIN="$NAME.pramit.gg"

if ! command -v vercel >/dev/null 2>&1; then
  echo "error: vercel CLI not found — run: npm i -g vercel" >&2
  exit 1
fi

if ! vercel whoami >/dev/null 2>&1; then
  echo "error: not logged in to Vercel — run: vercel login" >&2
  echo "       (use the account that owns pramit.gg)" >&2
  exit 1
fi

# link this directory to a Vercel project (creates the project on first run)
if [ ! -f .vercel/project.json ]; then
  echo "▲ linking $(pwd) -> project '$NAME'"
  vercel link --yes --project "$NAME"
fi

if [ "$PREVIEW" = 1 ]; then
  echo "▲ deploying preview…"
  vercel deploy --yes
  exit 0
fi

# attach the subdomain to the project (sticky: every future prod deploy
# serves it). Tolerate "already attached"; surface anything else.
if ! ADD_OUT=$(vercel domains add "$DOMAIN" "$NAME" 2>&1); then
  case "$ADD_OUT" in
    *already*|*"in use"*) : ;;
    *) printf '%s\n' "$ADD_OUT" >&2; exit 1 ;;
  esac
fi

echo "▲ deploying…"
vercel deploy --prod --yes

# warn if DNS isn't in place yet (one-time wildcard record at Namecheap)
if ! dig +short "$DOMAIN" | grep -q .; then
  echo ""
  echo "⚠ $DOMAIN does not resolve yet."
  echo "  Add a one-time wildcard record at Namecheap (Advanced DNS for pramit.gg):"
  echo "    Type: CNAME    Host: *    Value: cname.vercel-dns.com"
  echo "  After that, every future 'ship' is fully automatic."
fi

echo ""
echo "✦ live: https://$DOMAIN"
