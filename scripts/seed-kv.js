import { readFileSync } from 'node:fs';

const entries = [
  ['app', 'https://domain.com/download'],
  ['webapp', 'https://app.domain.com'],
  ['web', 'https://domain.com'],
  ['partner', 'https://partner.domain.com'],
];

const kvBindings = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));

console.log('KV seed entries ready for manual upload:');
for (const [id, target] of entries) {
  console.log(`- ${id} -> ${target}`);
}
console.log('\nUse this command after creating the real KV namespace:');
console.log('npx wrangler kv key put --binding REDIRECTS app "https://domain.com/download"');
console.log('npx wrangler kv key put --binding REDIRECTS webapp "https://app.domain.com"');
console.log('npx wrangler kv key put --binding REDIRECTS web "https://domain.com"');
console.log('npx wrangler kv key put --binding REDIRECTS partner "https://partner.domain.com"');
