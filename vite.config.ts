/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Emit dist/sw.js with this build's files to precache and a cache name derived from their
 * contents, so any change to the app, an icon or the manifest ships a new service worker.
 */
function serviceWorker(): Plugin {
  return {
    name: 'elastic-day-sw',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const hash = createHash('sha256');
      const files: string[] = [];
      for (const [name, out] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) {
        hash.update(name).update(out.type === 'chunk' ? out.code : out.source);
        // The page is fetched network-first; legacy .woff fonts are skipped by every current browser.
        if (name !== 'index.html' && !name.endsWith('.map') && !name.endsWith('.woff')) files.push(name);
      }
      // Top-level files only: folders like public/screenshots are for the install dialog, not offline use.
      const pub = readdirSync(here('./public')).filter(
        (f) => !f.startsWith('.') && statSync(here(`./public/${f}`)).isFile(),
      );
      for (const name of pub.sort()) {
        hash.update(name).update(readFileSync(here(`./public/${name}`)));
        files.push(name);
      }
      const source = readFileSync(here('./src/sw.js'), 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__ASSETS__', JSON.stringify(files.sort()));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// Served from kaiserkhan.com/planner/, so every asset URL is prefixed with /planner/.
export default defineConfig({
  base: '/planner/',
  plugins: [svelte(), serviceWorker()],
  test: {
    include: ['src/**/*.test.ts', 'worker/src/**/*.test.ts'],
  },
});
