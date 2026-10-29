# Anonymous IP-limited trial (5 quiz answers)

## Product rules

- Anonymous visitors can view questions and submit up to 5 **distinct four-choice answers** per observed IP identity. Spinning or drawing a question without answering does not consume a credit.
- At 5 accepted answers, the trial is permanently locked for that IP identity; sign-in enables the existing independent member rules.
- Anonymous answers are graded **only** in `quiz-guest-trial`, through the database RPC. Correct answer and explanation are never returned on a wrong trial attempt.
- Members are not charged trial quota. Wenchang balance/reveal remains available only through authenticated RPCs.
- Shared Wi-Fi / NAT may share an IP allowance, while VPN/dynamic IP can make this a *best-effort rate limit*, not a durable unique-person identity or foolproof fraud protection.
- Raw IP addresses are not persisted. The Edge Function computes HMAC-SHA-256 using a secret server-side key. The same hashed identity remains until the service secret is rotated. Counters are not automatically deleted/reset, since the requested five-attempt limit has no expiry.
- Only managed `CF-Connecting-IP` is used, and the function **fails closed** if the header is absent or malformed. No `X-Forwarded-For` fallback or client-submitted IP is trusted. The hosted proxy's header-override contract is not independently guaranteed in the public Supabase docs; don't call this an unbreakable IP lock.

## Deployment order

1. Run isolated PostgreSQL and browser test jobs; do not write a production question or wallet to test.
2. Review `supabase/27_trial_ip_five_attempts.sql`, and apply to Supabase only after tests pass.
3. Deploy `supabase/functions/quiz-guest-trial/index.ts` with **verify_jwt=false** (intentional for anonymous visitors). This function must run behind Supabase managed edge to receive the client IP header.
4. Verify an anonymous `action=status` POST with Origin `https://nortongoh.github.io` succeeds without modifying the DB; if it returns 503 due missing IP, do not release the frontend.
5. Merge the PR and validate GitHub Pages resources match main.
6. Check that a shared public IP cap and false-positive behavior are acceptable to the site's operator.

## Security design

- Tables have RLS enabled. `anon` and `authenticated` have no direct table access; RPC execution is **service_role only**.
- The database controls counts and grading transactionally with row locks and unique question identifiers.
- No anonymous rescue, member scores, member state, rescue wallet or quiz question rows are written.
- Site `apikey` is public; never store service role or HMAC keys in the client.
- Rate limiting is a best-effort abuse-control; production requires abuse monitoring and trusted edge-network validation. If the client IP cannot be verified, visitor trial is disabled, and login is still available.

## Operations

Read-only status returns `{used,remaining,limit,locked}`. Answer returns `accepted,correct,used,remaining,locked` (or a rejected reason). Never return `correct_answer`, `answer`, `explanation` or reveal the full IP digest to visitors. There is currently no trial-IP reset UI.
