# Supabase Auth: GitHub Pages email callback URLs

**Production website:** https://nortongoh.github.io/divination-monopoly/

The root https://nortongoh.github.io/ is **not** the deployed project website and returns GitHub Pages 404. There is no need to create or publish a new GitHub Pages site at the root.

## Required dashboard settings (must be applied by a Supabase project administrator)

Open [Authentication > URL Configuration](https://supabase.com/dashboard/project/pqwuskgkkpsqkycmnxsp/auth/url-configuration).

- **Site URL:** `https://nortongoh.github.io/divination-monopoly/`
- **Redirect URLs:** Add the exact `https://nortongoh.github.io/divination-monopoly/` (retain only other genuinely required URLs).
- Avoid an unrestricted redirect wildcard in production.

Open Authentication > Email Templates > Confirm signup. If using a custom template, make sure the confirm-email button links to `{{ .ConfirmationURL }}` so it goes through Supabase token verification, not directly to `{{ .SiteURL }}` or an invalid `/auth/confirm` page. For custom templates that intentionally use a redirect variable, check the official documentation for `{{ .RedirectTo }}`.

The browser signup request in `quiz-challenge-v7.js` also sets the exact project URL using the Auth `redirect_to` parameter. In addition to signup, other flows such as invites and password reset rely on the configured Site URL when they do not send their own redirect.

## Validation

1. Confirm GitHub Pages is deployed at the project URL.
2. **After updating URL Configuration**, use a controlled **test mailbox** to request one confirmation email.
3. Inspect the email confirmation link's destination: it should first be hosted by the project's Supabase Auth domain (token verification), not a direct GitHub Pages link.
4. Click the email and verify the final URL begins with `https://nortongoh.github.io/divination-monopoly/`, not the account root.
5. On the actual website, sign in using the confirmed account. This standalone page does not persist sessions automatically from the email callback.
6. Do not paste full confirmation URLs, access tokens, refresh tokens, passwords, or SMTP credentials into issue comments, test logs, or chats.

Old confirmation links may retain their previously generated redirect destination; if a previously clicked email verified the account despite showing a 404, open the correct project URL directly and try signing in. Do not delete or recreate existing members just to test the redirect.

References:
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/passwords
