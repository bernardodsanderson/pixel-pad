# Pixel Pad

A PICO-8 pixel studio in the browser. Draw, fill, erase, undo, and export crisp
PNG sprites. With an email/password account, the sprite library follows you
across devices.

[![CI](https://github.com/bernardodsanderson/pixel-pad/actions/workflows/ci.yml/badge.svg)](https://github.com/bernardodsanderson/pixel-pad/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Live demo:** <https://pixel-pad-bdsa.netlify.app>

![Pixel Pad share card](public/og.jpg)

## Features

- The official 16-colour PICO-8 palette and 8, 16, 24, 32, 48, or 64 px grids.
- Pencil, eraser, and flood-fill tools; 48-step undo/redo; grid toggle.
- Keyboard shortcuts: `1`/`2`/`3` or `B`/`E`/`F` for tools, `G` for the grid,
  `[`/`]` to resize, `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z` to undo/redo,
  `Ctrl/Cmd+S` to export.
- PNG export, with the native share sheet on browsers that support it.
- Instant local autosave — drawing and exporting never require an account.
- Optional email/password accounts and a cloud sprite library.
- Installable PWA with an offline app shell.

## Stack

| Layer          | Choice                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| UI             | React 19, TanStack Router/Start, Tailwind CSS v4                                                                    |
| State          | Zustand + `localStorage`                                                                                            |
| Auth           | [Netlify Identity](https://docs.netlify.com/manage/security/authentication/identity/) — email + password only       |
| Sprite library | [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/) via `netlify/functions/drawings.ts` |
| Hosting        | Netlify — static prerender + one serverless function                                                                |
| Tests          | Vitest                                                                                                              |

## Quick start

Requires **Node.js 22 or newer**.

```bash
npm install
npm run dev
```

Open <http://localhost:8080>. No environment variables are needed for drawing,
PNG export, or local autosave. Accounts and the cloud library are unavailable
until a Netlify site is connected (see below).

## Local accounts and the cloud library

Netlify Identity only runs on a deployed Netlify site. During local development
you can proxy Identity and `/api/*` to a deployment that has Identity and Blobs
enabled:

```bash
NETLIFY_SITE_URL=https://your-site.netlify.app npm run dev
```

The dev server forwards `/.netlify/identity` and `/api/*` to that site and
rewrites the cookie domain so the session works on `localhost`. Point this at a
site **you control** — signing up creates a real account there. Without
`NETLIFY_SITE_URL`, the app stays fully offline and signed-out.

## Deploy to Netlify

1. Fork or clone the repository and connect it to a new Netlify site.
2. Use the included `netlify.toml`: build command `npm run build`, publish
   directory `dist/client`, functions directory `netlify/functions`.
3. In **Project configuration → Identity**, enable Identity, turn on
   email/password sign-ups, and choose whether new addresses need confirmation.
   With autoconfirm on, sign-up lands straight in the studio; with it off, the
   app asks the visitor to confirm their email first.
4. Enable **Blobs** for the site. The `pixel-pad-drawings` store is created on
   first write; no connection string or environment variable is required.
5. Optional: set `VITE_SITE_URL` if you need absolute Open Graph URLs outside
   Netlify. On Netlify the build already receives `URL`, so the share card and
   canonical link are absolute without extra configuration.

No secrets live in the repository. Netlify injects its own runtime credentials.

## Configuration

| Variable           | Where            | Purpose                                                                                   |
| ------------------ | ---------------- | ----------------------------------------------------------------------------------------- |
| `NETLIFY_SITE_URL` | local dev server | Proxy Identity and the sprite API to a deployed Netlify site.                             |
| `VITE_SITE_URL`    | build            | Absolute canonical/Open Graph URL. Falls back to `URL` on Netlify, then to relative URLs. |

## How it works

```
src/
  routes/            # /, /login, /reset-password (prerendered, then hydrated)
  components/        # studio UI, canvas, library drawer, auth chip
  lib/editor-store.ts    # Zustand editor state, history, localStorage persistence
  lib/pixel-utils.ts     # grid math, Bresenham strokes, flood fill, PNG export
  lib/drawings.ts        # typed client for /api/drawings
  lib/auth/              # Netlify Identity provider and UI helpers
netlify/functions/
  drawings.ts        # authenticated, per-account sprite library
```

- **Rendering.** `/`, `/login`, and `/reset-password` are prerendered to HTML at
  build time for a fast first paint. React hydrates them and TanStack Router
  takes over. Authentication resolves in the browser, so the prerendered shell
  is always the signed-out state.
- **Anonymous use.** The editor stores the current canvas and view preferences
  under the `pixel-pad-v1` `localStorage` key. No account is needed.
- **Cloud library.** Each account can keep up to 40 sprites:

  ```
  u/<user-id>/<drawing-id>.json
  { id, title, gridSize, pixels, updatedAt }
  ```

  The user id comes only from the verified Netlify Identity session inside the
  function, never from the request body. Titles are 1–48 characters, grids are
  8–64 px, and pixel values are integers from `-1` (empty) through `15`.

- **API.** `/api/drawings` supports `GET` (list), `POST` (create or update), and
  `DELETE ?id=` (remove). Requests are same-origin only, JSON bodies are capped
  at 64 KB, and every stored record is re-validated before it is returned.

## Scripts

| Command                 | What it does                                           |
| ----------------------- | ------------------------------------------------------ |
| `npm run dev`           | Vite dev server on `http://localhost:8080`.            |
| `npm run build`         | Prerender the routes into `dist/client`.               |
| `npm run preview`       | Serve the production build on `http://127.0.0.1:8081`. |
| `npm test`              | Run the Vitest unit suites.                            |
| `npm run test:coverage` | Unit tests with a V8 coverage report.                  |
| `npm run typecheck`     | `tsc --noEmit`.                                        |
| `npm run lint`          | ESLint.                                                |
| `npm run format`        | Prettier.                                              |
| `npm run check`         | Typecheck, lint, and test in one go.                   |

## Testing

The suites cover the editor store and history semantics, palette and pixel
utilities (including Bresenham strokes and flood fill), the drawings API client,
auth error mapping, and the Netlify function (authentication, per-user
isolation, validation, limits, malformed records, and error paths). Requests to
Netlify Blobs and Identity are mocked in-memory, so the tests need no network.

```bash
npm test
npm run test:coverage
```

## Contributing

Bug reports and pull requests are welcome. Read
[CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md) first. For security issues, follow
[SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

[MIT](LICENSE) © 2026 Bernardo Anderson.

PICO-8 is a trademark of Lexaloffle Games. This project is an independent
pixel-art tool and is not affiliated with or endorsed by Lexaloffle.
