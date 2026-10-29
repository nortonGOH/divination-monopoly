#!/usr/bin/env bash
# READ-ONLY REMOTE: never pushes, updates refs on GitHub, or modifies Supabase.
set -euo pipefail
WORK="$GITHUB_WORKSPACE/.history-preflight-output"
MIRROR="$WORK/mirror.git"
mkdir -p "$WORK/backup" "$WORK/saved" "$WORK/report"
git clone --quiet --mirror https://github.com/nortonGOH/divination-monopoly.git "$MIRROR"
git -C "$MIRROR" fetch --quiet origin '+refs/pull/*/head:refs/pull/*/head'
git -C "$MIRROR" show-ref > "$WORK/report/original-refs.txt"
git -C "$MIRROR" for-each-ref --format='%(refname)' refs/heads > "$WORK/report/branches.txt"
test -s "$WORK/report/branches.txt"
echo "Creating complete Git bundle before any local rewriting"
git -C "$MIRROR" bundle create "$WORK/backup/full-history.bundle" --all
git -C "$MIRROR" bundle verify "$WORK/backup/full-history.bundle" > "$WORK/report/bundle-verify.txt"
openssl cms -encrypt -aes256 -binary -outform DER \
  -in "$WORK/backup/full-history.bundle" \
  -out "$WORK/backup/full-history.bundle.cms" \
  "$GITHUB_WORKSPACE/.github/history-backup-public-cert.pem"
sha256sum "$WORK/backup/full-history.bundle.cms" > "$WORK/backup/full-history.bundle.cms.sha256"
rm "$WORK/backup/full-history.bundle"
while IFS= read -r ref; do
  key="$(printf '%s' "$ref" | sha256sum | cut -c1-16)"
  tree="$(git -C "$MIRROR" rev-parse "$ref^{tree}")"
  printf '%s\t%s\t%s\n' "$ref" "$key" "$tree" >> "$WORK/saved/branches.tsv"
  git -C "$MIRROR" show "$ref:index.html" > "$WORK/saved/$key.index.html"
  git -C "$MIRROR" show "$ref:setup.sql" > "$WORK/saved/$key.setup.sql"
done < "$WORK/report/branches.txt"
echo "Rewriting only local mirror; known answer files and all historical index/setup copies"
git -C "$MIRROR" filter-repo --force --sensitive-data-removal --no-fetch \
  --invert-paths \
  --path questions.json --path new-choice-70.json --path calendar-questions-80.json \
  --path mountain-180.json --path mountain-初階-60.json \
  --path mountain-中階-60.json --path mountain-高階-60.json \
  --path qa-source-60.json --path seed.sql \
  --path-glob 'quiz-imports/**' --path-glob 'mountain-*.json' \
  --path-glob 'calendar-questions-*.json' \
  --path index.html --path setup.sql \
  > "$WORK/report/filter-repo-log.txt" 2>&1
export GIT_AUTHOR_NAME='Security History Maintenance'
export GIT_AUTHOR_EMAIL='history-maintenance@users.noreply.github.com'
export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
export GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
while IFS="$(printf '\t')" read -r ref key original_tree; do
  oldhead="$(git -C "$MIRROR" rev-parse "$ref")"
  idx="$WORK/saved/index-$key"
  GIT_INDEX_FILE="$idx" git -C "$MIRROR" read-tree "$oldhead"
  for path in index.html setup.sql; do
    blob="$(git -C "$MIRROR" hash-object -w "$WORK/saved/$key.$path")"
    GIT_INDEX_FILE="$idx" git -C "$MIRROR" update-index --add --cacheinfo "100644,$blob,$path"
  done
  new_tree="$(GIT_INDEX_FILE="$idx" git -C "$MIRROR" write-tree)"
  if test "$new_tree" != "$original_tree"; then
    echo "STOP: functional tree mismatch for $ref" >&2
    exit 1
  fi
  new_commit="$(printf 'Restore current safe browser and retired SQL after historical sanitization\n' |
    git -C "$MIRROR" commit-tree "$new_tree" -p "$oldhead")"
  git -C "$MIRROR" update-ref "$ref" "$new_commit"
  printf '%s original_tree=%s rewritten_commit=%s\n' "$ref" "$original_tree" "$new_commit" \
    >> "$WORK/report/preserved-branches.txt"
done < "$WORK/saved/branches.tsv"
git -C "$MIRROR" rev-list --objects --all > "$WORK/report/reachable-objects.txt"
if grep -E ' (qa-source-60\.json|seed\.sql|questions\.json|new-choice-70\.json|calendar-questions-[^ /]*\.json|mountain-[^ /]*\.json|quiz-imports/[^ ]*)$' \
    "$WORK/report/reachable-objects.txt" > "$WORK/report/still-leaking-paths.txt"; then
  echo "STOP: known answer-bearing historical paths still reachable" >&2
  exit 1
fi
while IFS="$(printf '\t')" read -r ref key original_tree; do
  test "$(git -C "$MIRROR" rev-parse "$ref^{tree}")" = "$original_tree"
  grep -Fq 'FALLBACK_QUESTIONS=[]' "$WORK/saved/$key.index.html" || {
    echo "STOP: unexpected fallback bank in $ref" >&2; exit 1;
  }
  grep -Fq 'RETIRED SECURITY-SENSITIVE BOOTSTRAP SCRIPT' "$WORK/saved/$key.setup.sql" || {
    echo "STOP: unexpected legacy setup SQL in $ref" >&2; exit 1;
  }
done < "$WORK/saved/branches.tsv"
echo "PASS: original branch file trees preserved exactly; known historical answer paths removed."
echo "Remote history was NOT changed. Only encrypted full-history bundle was uploaded."
