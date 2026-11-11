// Fetch the shell while iOS reads its secure session store. Only bootstrap
// imports and evaluates the shell, after that store has been restored.
export default function startupPreloadPlugin() {
  return {
    name: 'smarty-startup-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle, chunk }) {
        // Bootstrap has one dynamic entry, the modern shell. Rollup can merge
        // that entry into a shared chunk without its original source path.
        if (chunk?.dynamicImports?.length !== 1 || chunk.fileName.includes('-legacy-')) return [];
        const app = bundle?.[chunk.dynamicImports[0]];
        if (!app) return [];
        const styles = new Set();
        const seen = new Set();
        const visit = chunk => {
          if (chunk?.type !== 'chunk' || seen.has(chunk.fileName)) return;
          seen.add(chunk.fileName);
          chunk.imports.forEach(file => visit(bundle[file]));
          chunk.viteMetadata?.importedCss?.forEach(file => styles.add(file));
        };
        visit(app);
        return [
          { tag: 'link', attrs: { rel: 'modulepreload', href: '/' + app.fileName, crossorigin: true } },
          ...[...styles].map(file => ({ tag: 'link', attrs: { rel: 'preload', as: 'style', href: '/' + file, crossorigin: true } })),
        ];
      },
    },
  };
}
