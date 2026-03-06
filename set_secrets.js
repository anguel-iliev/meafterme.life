#!/usr/bin/env node
/**
 * MEafterMe — Set Firebase Secrets via REST API
 * Usage: GOOGLE_APPLICATION_CREDENTIALS=./sa.json node set_secrets.js
 * 
 * Set secrets via environment variables before running:
 *   export ELEVENLABS_API_KEY=sk_...
 *   export DID_API_KEY=...
 *   export OPENAI_API_KEY=sk-proj-...
 *   export ANTHROPIC_API_KEY=sk-ant-...
 */

const https = require('https');
const fs = require('fs');

const PROJECT = 'meafterme-d0347';

const SECRETS = {
  'ELEVENLABS_API_KEY': process.env.ELEVENLABS_API_KEY,
  'DID_API_KEY':        process.env.DID_API_KEY,
  'OPENAI_API_KEY':     process.env.OPENAI_API_KEY,
  'ANTHROPIC_API_KEY':  process.env.ANTHROPIC_API_KEY,
};

async function main() {
  const saPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!saPath || !fs.existsSync(saPath)) {
    console.error('❌ Provide path to service account JSON as argument');
    process.exit(1);
  }

  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({
    keyFile: saPath,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;
  console.log('✅ Authenticated!');

  for (const [name, value] of Object.entries(SECRETS)) {
    if (!value) { console.log(`⚠ Skipping ${name} (not set)`); continue; }
    console.log(`\n🔑 Setting: ${name}`);

    try {
      await apiCall('POST',
        `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets`,
        token, { replication: { automatic: {} } }, `?secretId=${name}`);
      console.log(`  ✓ Created`);
    } catch (e) {
      if (e.message.includes('409')) console.log(`  ℹ Already exists`);
      else console.error(`  ⚠ ${e.message}`);
    }

    try {
      await apiCall('POST',
        `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${name}:addVersion`,
        token, { payload: { data: Buffer.from(value).toString('base64') } });
      console.log(`  ✓ Version added`);
    } catch (e) {
      console.error(`  ❌ ${e.message}`);
    }
  }

  console.log('\n✅ Done! Now run: firebase deploy --only functions --project meafterme-d0347');
}

function apiCall(method, url, token, body, query = '') {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(url + query);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: fullUrl.hostname,
      path: fullUrl.pathname + fullUrl.search,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => res.statusCode < 300 ? resolve(JSON.parse(body))
        : reject(new Error(`${res.statusCode}: ${body.slice(0, 200)}`)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
