# Public Git history answer-key exposure: controlled remediation

This public repository previously committed quiz answer-bearing artifacts.
**Removing files from the current branch does not delete old Git objects.**
This document contains paths and procedure only; it must not include any answer values.

## Verified status (2026-10-29)
- The current main tree no longer contains the answer-bearing JSON files or seed.sql.
- Earlier history contains at least these exposed paths:
  - questions.json, new-choice-70.json, calendar-questions-80.json
  - mountain-180.json, mountain-初階-60.json, mountain-中階-60.json, mountain-高階-60.json
  - qa-source-60.json, seed.sql
  - quiz-imports/ (four question/answer JSON files identified in an earlier tree)
- An earlier index.html embedded answer keys; the historical setup.sql provided unsafe broad read permissions.
- Two open draft PRs (#1 and #2) build on the existing main history.
- Existing questions and answer values may already have been copied elsewhere; rewriting Git does not restore secrecy of compromised answers.

## Current safeguards
- scripts/check_public_answer_artifacts.py blocks the known files and any other tracked JSON
  whose structures look like question/answer banks.
- The GitHub Actions guard rejects a non-empty client fallback or reactivation of setup.sql.
- This scanner is intentionally a preventive baseline, not a comprehensive secret detector
  and not a replacement for Auth, RLS, or RPC access controls.

## Controlled cleanup runbook — NOT AUTHORIZED OR EXECUTED
1. Preserve a **private, access-controlled off-GitHub backup** of all Git refs and the
   current main commit. Never publish the backup, even in a private public-linked release.
2. Freeze contributors' pushes; identify all branches, tags, fork refs, PR refs and copied
   answer files. Review all old JavaScript, SQL, and JSON versions, including renames.
3. Coordinate PR #1 and #2 before rewriting any ancestor. The old PR diffs and commit
   links may become invalid.
4. On a fresh local clone, run a current git-filter-repo using
   --sensitive-data-removal, --invert-paths and --path for every forbidden historical path;
   additionally purge embedded data in historical index.html without deleting its
   functional structure. Do not remove safe current application logic.
5. Verify **every** rewritten branch and tag against answer-bearing JSON/SQL/JS content,
   check clean rebuild and workflow tests, compare current functional file tree, and record
   changed refs and first changed commits. Do not proceed if a check fails.
6. Only after explicit approval for the irreversible operation, coordinate the force
   update of GitHub refs, rebase/recreate open PRs, and stop all old clones from pushing
   tainted history. Keep the site deployment and data services functioning.
7. Contact GitHub Support with the repository, impacted PR count and first changed
   commits to request PR-reference/cached-view cleanup and garbage collection if they
   consider this content eligible; other forks or clones cannot be purged by force push.
8. Recheck direct old-commit references, Pages assets, application behavior and Supabase
   data counts/permissions. Do not claim historical material irretrievable without proof.

GitHub's official guidance:
https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository

**No history was rewritten and no Supabase production data was changed to prepare this runbook.**
