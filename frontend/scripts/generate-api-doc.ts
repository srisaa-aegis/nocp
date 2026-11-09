/**
 * Prints the API traceability matrix (docs/03-api-catalog.md §2) from core/api/api-endpoints.ts.
 *   npx tsx scripts/generate-api-doc.ts > /tmp/matrix.md
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { API_ENDPOINTS } from '../src/app/core/api/api-endpoints';

const src = readFileSync(join(__dirname, '..', 'src', 'app', 'core', 'api', 'api-endpoints.ts'), 'utf8');
const sections: { title: string; ids: string[] }[] = [];
for (const line of src.split('\n')) {
  const h = /^ {2}\/\/ ([A-Z].*)$/.exec(line);
  if (h && !h[1].startsWith('-')) sections.push({ title: h[1], ids: [] });
  const e = /^ {2}([a-zA-Z0-9]+): endpoint\(/.exec(line);
  if (e && sections.length) sections[sections.length - 1].ids.push(e[1]);
}
const out: string[] = [];
for (const s of sections) {
  out.push(`### ${s.title}`, '', '| Catalog id | Method | Asset | Mock write? | Legacy endpoint | Purpose |', '|---|---|---|---|---|---|');
  for (const id of s.ids) {
    const e = (API_ENDPOINTS as Record<string, { method: string; asset: string; mutates?: boolean; legacy: string; description: string }>)[id];
    out.push(`| \`${id}\` | ${e.method} | \`${e.asset.replace('assets/data/', '')}\` | ${e.mutates ? 'yes' : '—'} | \`${e.legacy}\` | ${e.description} |`);
  }
  out.push('');
}
console.log(out.join('\n'));
console.error(`${Object.keys(API_ENDPOINTS).length} endpoints`);
