import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const distDir = path.join(root, 'dist-single-build');
const outputFile = path.join(root, '深海棋战-单文件版.html');

function resolveAssetPath(assetPath) {
  const normalized = assetPath.replace(/^\.\//, '').replace(/^\//, '');
  return path.join(distDir, normalized);
}

async function inlineHtml() {
  let html = await fs.readFile(path.join(distDir, 'index.html'), 'utf8');

  html = html.replace(
    /<link\s+rel="modulepreload"[^>]*>\s*/g,
    ''
  );

  html = await replaceAsync(
    html,
    /<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>\s*/g,
    async (_match, href) => {
      const css = await fs.readFile(resolveAssetPath(href), 'utf8');
      return `<style>\n${css}\n</style>\n`;
    }
  );

  html = await replaceAsync(
    html,
    /<script\s+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g,
    async (_match, src) => {
      const js = await fs.readFile(resolveAssetPath(src), 'utf8');
      return `<script type="module">\n${js}\n</script>`;
    }
  );

  html = html.replace(
    /<link\s+rel="sitemap"[^>]*>\s*/g,
    ''
  );

  await fs.writeFile(outputFile, html, 'utf8');

  const stats = await fs.stat(outputFile);
  console.log(`Created ${path.relative(root, outputFile)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
}

async function replaceAsync(input, pattern, replacer) {
  const matches = [...input.matchAll(pattern)];
  const replacements = await Promise.all(
    matches.map((match) => replacer(...match))
  );

  let index = 0;
  return input.replace(pattern, () => replacements[index++]);
}

await inlineHtml();
