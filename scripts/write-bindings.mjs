// Called by .github/workflows/provision-infra.yml after D1/R2/KV are
// created: replaces the placeholder comment block in wrangler.toml with
// the real bindings. Idempotent — running it again just rewrites the
// same trailing block.
import { readFileSync, writeFileSync } from 'node:fs';

const { D1_NAME, D1_ID, R2_NAME, KV_ID } = process.env;
if (!D1_NAME || !D1_ID || !R2_NAME || !KV_ID) {
  console.error('Missing required env vars: D1_NAME, D1_ID, R2_NAME, KV_ID');
  process.exit(1);
}

let toml = readFileSync('wrangler.toml', 'utf-8');

// Drop everything from the placeholder comment (fresh repo) or from a
// previously written bindings block (re-run) so we never duplicate.
for (const marker of ['# D1, R2, and KV bindings are added', '[[d1_databases]]']) {
  const idx = toml.indexOf(marker);
  if (idx !== -1) {
    toml = toml.slice(0, idx).trimEnd() + '\n';
    break;
  }
}

toml += `
[[d1_databases]]
binding = "DB"
database_name = "${D1_NAME}"
database_id = "${D1_ID}"
migrations_dir = "d1/migrations"

[[r2_buckets]]
binding = "REPORTS"
bucket_name = "${R2_NAME}"

[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "${KV_ID}"
`;

writeFileSync('wrangler.toml', toml);
console.log(toml);
