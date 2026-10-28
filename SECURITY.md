# Security Policy

## Supported versions

Only the latest release on `main` is supported. The project is a static web app
with one serverless function; there are no long-lived release branches.

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |
| < 1.0   | ❌        |

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private vulnerability reporting on this repository:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability**.
3. Describe the issue, the impact, and the smallest reproduction you can share.

If private reporting is unavailable, contact the maintainer through
[@bernardodsanderson](https://github.com/bernardodsanderson) and ask for a
private channel. Do not include exploit details in a public issue.

You can expect an initial acknowledgement within **72 hours** and a status
update within **7 days**. Please give us a reasonable window to fix the issue
before public disclosure; we will credit you in the advisory if you would like.

## Scope

In scope:

- Authentication or authorization bypass in `netlify/functions/drawings.ts`.
- Access to another account's sprites (IDOR), including via a guessed id.
- Stored or reflected cross-site scripting through sprite titles or pixels.
- Cross-site request forgery against the sprite API.
- Exposure of secrets, session material, or private user data.
- Vulnerabilities in the app's own dependencies that are reachable here.

Out of scope:

- Netlify Identity, Netlify Blobs, or other platform-level issues. Report those
  to Netlify directly.
- Denial of service, volumetric attacks, or rate-limit tuning.
- Social engineering, physical access, or issues that require a compromised
  device.
- Findings from automated scanners without a demonstrated impact.
- The public demo's third-party hosting configuration.

## Security model

- The browser talks to `/.netlify/identity` for sessions and `/api/drawings` for
  sprites. Netlify Identity cookies are `SameSite`, and the function additionally
  rejects browser requests labelled `sec-fetch-site: cross-site`.
- The sprite function derives the owner from `getUser()`; it never accepts a
  user id from the request body. Blob keys are prefixed with `u/<userId>/`.
- Every stored sprite is re-validated before it is returned: id format, title
  length, supported grid, exact pixel count, and colour range.
- Request bodies are capped at 64 KB; titles at 48 characters; libraries at 40
  sprites per account.
- No secrets or provider credentials are stored in this repository. Netlify
  injects its runtime credentials at deploy time.

## Safe harbour

We will not pursue legal action against researchers who make a good-faith
effort to follow this policy, avoid privacy violations and service disruption,
and give us reasonable time to respond before disclosure.
