import type { ProxyOptions } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Optional local proxy for Netlify Identity and the sprite API.
 *
 * Netlify Identity only runs on a deployed Netlify site, so `npm run dev`
 * can forward `/.netlify/identity` and `/api/*` to a real deployment. That
 * keeps sign-in and the cloud sprite library usable locally without a second
 * auth stack. Leave `NETLIFY_SITE_URL` unset to run fully offline; drawing and
 * PNG export work without an account.
 */
const netlifySite = (process.env.NETLIFY_SITE_URL ?? "").trim().replace(/\/+$/, "");

/**
 * Canonical public URL, used for absolute Open Graph/Twitter image URLs in the
 * prerendered HTML. Netlify sets `URL` at build time; self-hosters can set
 * `VITE_SITE_URL` instead. A relative image is used when neither is present.
 */
const siteUrl = (process.env.VITE_SITE_URL ?? process.env.URL ?? "").trim().replace(/\/+$/, "");

const netlifyProxy: ProxyOptions | undefined = netlifySite
  ? {
      target: netlifySite,
      changeOrigin: true,
      secure: true,
      // Identity's cookies belong to the deployed host; strip the Domain so the
      // browser stores them for localhost:8080 instead.
      cookieDomainRewrite: "",
      configure(proxy) {
        proxy.on("proxyReq", (proxyReq) => {
          proxyReq.setHeader("origin", netlifySite);
          proxyReq.setHeader("referer", `${netlifySite}/`);
        });
      },
    }
  : undefined;

const proxyFor = () =>
  netlifyProxy
    ? {
        "/.netlify/identity": netlifyProxy,
        "/api/": netlifyProxy,
      }
    : undefined;

export default defineConfig(() => ({
  define: {
    __SITE_URL__: JSON.stringify(siteUrl),
  },
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    proxy: proxyFor(),
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
    proxy: netlifyProxy
      ? {
          "/.netlify/identity": netlifyProxy,
          "/api/": netlifyProxy,
        }
      : undefined,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    // Static site generation: the product is fully client-side (Netlify
    // Identity + /api/drawings), so every route is prerendered to HTML and
    // hydrated in place. Pre-rendering the real routes (rather than the SPA
    // shell) avoids React #418 on the signed-out first pass.
    tanstackStart({
      prerender: { enabled: true, crawlLinks: false },
      pages: [{ path: "/" }, { path: "/login" }, { path: "/reset-password" }],
    }),
    viteReact(),
  ],
}));
