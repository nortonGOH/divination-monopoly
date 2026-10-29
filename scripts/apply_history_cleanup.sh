#!/usr/bin/env bash
# Authorized one-shot rewrite. Only atomic force-with-lease updates of HEAD branches.
set -euo pipefail
REPO_URL="https://github.com/nortonGOH/divination-monopoly.git"
EXPECTED_MAIN="f4f686f7709e31877dc072e38ded471bfb114902"
WORK="$GITHUB_WORKSPACE/.history-preflight-output"
bash scripts/preflight_history_cleanup.sh
MIRROR="$WORK/mirror.git"
test -s "$WORK/backup/full-history.bundle.cms"
test -s "$WORK/report/preserved-branches.txt"
test ! -s "$WORK/report/still-leaking-paths.txt"
actual_main="$(git ls-remote "$REPO_URL" refs/heads/main | awk '{print $1}')"
if test "$actual_main" != "$EXPECTED_MAIN"; then
  echo 'STOP: main has changed or this rewrite was already applied' >&2
  exit 1
fi
mapfile -t remote_refs < <(git ls-remote --heads "$REPO_URL" | awk '{print $2}' | sort)
mapfile -t known_refs < <(sort "$WORK/report/branches.txt")
if test "${#remote_refs[@]}" -ne "${#known_refs[@]}"; then
  echo 'STOP: remote branch count changed' >&2; exit 1
fi
for i in "${!remote_refs[@]}"; do
  if test "${remote_refs[$i]}" != "${known_refs[$i]}"; then
    echo 'STOP: remote branch set changed' >&2; exit 1
  fi
done
push_opts=()
push_refs=()
while IFS= read -r ref; do
  expected="$(awk -v r="$ref" '$2==r{print $1}' "$WORK/report/original-refs.txt")"
  current="$(git ls-remote "$REPO_URL" "$ref" | awk '{print $1}')"
  if test -z "$expected" || test "$expected" != "$current"; then
    echo "STOP: branch lease mismatch: $ref" >&2
    exit 1
  fi
  push_opts+=("--force-with-lease=$ref:$expected")
  push_refs+=("$ref:$ref")
done < "$WORK/report/branches.txt"
test "${#push_refs[@]}" -ge 5
if test -z "${GH_HISTORY_TOKEN:-}"; then echo 'STOP: no GitHub write token' >&2; exit 1; fi
auth="$(printf 'x-access-token:%s' "$GH_HISTORY_TOKEN" | base64 -w0)"
echo "Dry-run atomic Git rewrite of ${#push_refs[@]} heads"
git -C "$MIRROR" -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $auth" \
  push --atomic --dry-run "${push_opts[@]}" "$REPO_URL" "${push_refs[@]}"
echo "Applying authorized single-transaction Git history cleanup"
git -C "$MIRROR" -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $auth" \
  push --atomic "${push_opts[@]}" "$REPO_URL" "${push_refs[@]}"
while IFS= read -r ref; do
  target="$(git -C "$MIRROR" rev-parse "$ref")"
  remote="$(git ls-remote "$REPO_URL" "$ref" | awk '{print $1}')"
  if test "$target" != "$remote"; then
    echo "STOP: post-push branch mismatch: $ref" >&2; exit 1
  fi
done < "$WORK/report/branches.txt"
echo "SUCCESS: all rewritten branch refs verified. GitHub PR refs/cache require separate support cleanup."
