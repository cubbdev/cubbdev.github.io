// GitHub Pages serves 404.html for unknown paths. Copying index.html lets client-side routes
// such as /app/s/str_x/licenses load directly. .nojekyll disables Jekyll processing.
import { copyFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));
writeFileSync(join(dist, '.nojekyll'), '');
console.log('SPA fallback written (404.html, .nojekyll)');
