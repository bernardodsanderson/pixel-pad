/// <reference types="vite/client" />

/**
 * Canonical public site URL, injected by `vite.config.ts` from
 * `VITE_SITE_URL` or Netlify's `URL` build variable. Empty during local
 * development, where relative share-card URLs are used instead.
 */
declare const __SITE_URL__: string;
