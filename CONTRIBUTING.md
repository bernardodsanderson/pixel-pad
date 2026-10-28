# Contributing to Pixel Pad

Thanks for taking the time to contribute. This is a small, focused project:
bug fixes, accessibility improvements, tests, and documentation are all
welcome. For anything larger than a typo, open an issue first so we can agree
on the direction before you invest time.

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

You need **Node.js 22 or newer**.

```bash
git clone https://github.com/bernardodsanderson/pixel-pad.git
cd pixel-pad
npm install
npm run dev
```

Open <http://localhost:8080>. Drawing and PNG export work with no configuration.
Accounts and the cloud library require a Netlify deployment with Identity and
Blobs enabled; see the [README](README.md#local-accounts-and-the-cloud-library)
for the local proxy setup.

## Before you send a pull request

Run the same checks CI runs:

```bash
npm run check        # typecheck + lint + tests
npm run format       # Prettier
```

Or individually: `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build`, `npm run format:check`.

A pull request is ready when:

- [ ] The change has a clear reason, described in the PR.
- [ ] New behavior has tests. Tests should fail without your change.
- [ ] `npm run check` and `npm run build` pass.
- [ ] The change works on a phone-sized viewport as well as desktop.
- [ ] No new dependency is added without a note explaining why.
- [ ] No secrets, personal data, or provider-specific credentials are committed.

## What to test

Pure logic lives in `src/lib` and is the easiest place to add coverage. The
Netlify function tests mock `@netlify/blobs` and `@netlify/identity` in memory,
so they need no network and no account.

If you change the sprite API, update both the function and
`src/lib/drawings.ts`, and add tests for the happy path, validation failures,
and the unauthenticated path.

## Code style

- TypeScript everywhere; avoid `any` when a narrower type is practical.
- Tailwind classes for styling, using the tokens in `src/styles.css`.
- Keep components accessible: labels, focus states, and keyboard paths matter.
- Prettier owns formatting. Run `npm run format` rather than hand-wrapping.
- Prefer small, focused pull requests over a rewrite.

## Commits

Write an imperative subject line ("Fix flood fill at the canvas edge"), and use
the body to explain _why_ when it is not obvious. Conventional Commits
(`fix:`, `feat:`, `docs:`, `test:`, `chore:`) are welcome but not required.

## Reporting bugs and security issues

- Bugs and feature requests: use the GitHub issue templates.
- Security vulnerabilities: **do not open a public issue**. Follow
  [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
