import { readFileSync } from 'node:fs';
import { getDeletionPageKind, renderDeletionDocument } from '../src/lib/deletionPages.js';

// These policy resources must remain usable without the SPA, auth, APIs or JS.
export default function deletionPagesPlugin() {
  const stylesheet = () => readFileSync(new URL('../src/pages/AccountDeletion.css', import.meta.url), 'utf8');
  const serve = server => {
    server.middlewares.use((request, response, next) => {
      if (!['GET', 'HEAD'].includes(request.method)) return next();
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const kind = getDeletionPageKind(pathname);
      if (!kind) return next();
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.end(request.method === 'HEAD' ? undefined : renderDeletionDocument(kind, stylesheet()));
    });
  };
  return {
    name: 'smarty-public-deletion-pages',
    configureServer: serve,
    configurePreviewServer: serve,
    generateBundle() {
      for (const kind of ['account', 'data']) {
        this.emitFile({ type: 'asset', fileName: `delete-${kind}.html`, source: renderDeletionDocument(kind, stylesheet()) });
      }
    },
  };
}
