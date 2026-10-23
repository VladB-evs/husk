#!/bin/bash
# One command to release a new version of HUSK:
#
#   pnpm release                       new patch version   (1.0.0 -> 1.0.1)
#   pnpm release minor                 new minor version   (1.0.1 -> 1.1.0)
#   pnpm release major                 new major version   (1.1.0 -> 2.0.0)
#   pnpm release 1.4.0                 exact version
#   pnpm release patch -m "Fix tables" commit your pending changes with this message first
#
# What it does: commits pending changes (only with -m), raises the version, makes the tag, and pushes.
# GitHub Actions (.github/workflows/release.yml) then builds the app and publishes the release.
# This script waits for that to finish, so you see the result here.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "Error: $*" >&2; exit 1; }

BUMP="patch"
MESSAGE=""
while [ $# -gt 0 ]; do
  case "$1" in
    -m|--message) [ $# -ge 2 ] || fail "-m needs a message"; MESSAGE="$2"; shift 2 ;;
    -h|--help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) BUMP="$1"; shift ;;
  esac
done

[ "$(git branch --show-current)" = "main" ] || fail "Switch to the main branch first."

if [ -n "$(git status --porcelain)" ]; then
  [ -n "$MESSAGE" ] || fail "You have changes that are not committed. Run again with -m \"what you changed\" to include them in this release."
  git add -A
  git commit -m "$MESSAGE"
fi

git fetch origin main --quiet
[ "$(git rev-list --count HEAD..origin/main)" = "0" ] || fail "GitHub has newer changes. Run: git pull"

# Raises the version in package.json, commits it ("HUSK 1.0.1") and makes the tag (v1.0.1)
TAG="$(npm version "$BUMP" -m "HUSK %s")"
echo "Releasing $TAG"

git push origin main
git push origin "$TAG"

REPO_URL="$(git remote get-url origin | sed -E 's#\.git$##; s#^git@github.com:#https://github.com/#')"

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "Waiting for GitHub to build the app (about 5 to 10 minutes)..."
  RUN_ID=""
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    RUN_ID="$(gh run list --workflow release.yml --branch "$TAG" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)"
    [ -n "$RUN_ID" ] && break
    sleep 3
  done
  [ -n "$RUN_ID" ] || fail "The build did not start. Look at $REPO_URL/actions"
  gh run watch "$RUN_ID" --exit-status || fail "The build failed. Details: $REPO_URL/actions/runs/$RUN_ID"
  echo
  echo "Done: $REPO_URL/releases/tag/$TAG"
else
  echo "The build runs on GitHub now: $REPO_URL/actions"
  echo "The release will appear at:   $REPO_URL/releases/tag/$TAG"
fi

echo "People update with the install line from the README (same line as the first install)."
