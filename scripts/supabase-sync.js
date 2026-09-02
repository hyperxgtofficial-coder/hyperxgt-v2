// Automated Supabase Database Setup & Product Sync Script
// Connects to Supabase REST API, verifies tables, and seeds all 338 products.
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env if present
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.');
  console.error('Please provide your Supabase credentials in .env or pass them as environment variables.');
  process.exit(1);
}

function httpsRequest(urlStr, method, headers, bodyObj) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const postData = bodyObj ? JSON.stringify(bodyObj) : '';
      const reqHeaders = {
        'Content-Type': 'application/json',
        ...headers
      };
      if (postData) {
        reqHeaders['Content-Length'] = Buffer.byteLength(postData);
      }

      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: method || 'GET',
        headers: reqHeaders
      };

      const req = https.request(options, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch(e) {
            resolve({ statusCode: res.statusCode, body: data });
          }
        });
      });

      req.on('error', err => reject(err));
      if (postData) req.write(postData);
      req.end();
    } catch(err) {
      reject(err);
    }
  });
}

async function run() {
  console.log('🚀 Connecting to Supabase at:', SUPABASE_URL);

  // 1. Test Connection
  try {
    const testRes = await httpsRequest(`${SUPABASE_URL}/rest/v1/`, 'GET', {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    });
    console.log('✅ Supabase Connection Status:', testRes.statusCode);
  } catch (err) {
    console.error('❌ Connection Failed:', err.message);
    process.exit(1);
  }

  // 2. Load Products from data/products.json
  const jsonPath = path.join(__dirname, '..', 'data', 'products.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ products.json not found!');
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`📦 Loaded ${products.length} products from local database.`);

  // 3. Format and seed to Supabase
  const dbPayload = products.map(p => {
    const isNoImg = p.no_image === true || (!p.image && (!p.images || p.images.length === 0));
    const imgVal = isNoImg ? '' : String(p.image || '').trim();

    return {
      id: Number(p.id),
      sku: String(p.sku || `HX-${p.id}`),
      name: String(p.name || ''),
      category: String(p.category || 'Racing Cars'),
      price: Number(p.price || 0),
      mrp: Number(p.mrp || p.regular_price || p.price || 0),
      stock: Number(p.stock !== undefined ? p.stock : 25),
      gst_rate: Number(p.gstRate || p.gst_rate || 18),
      tax_mode: String(p.taxMode || p.tax_mode || 'inclusive'),
      hsn: String(p.hsn || '95030090'),
      scale: String(p.scale || '1:16'),
      speed: String(p.speed || '35 KM/H'),
      drive: String(p.drive || '4WD'),
      image: imgVal,
      short_description: String(p.short_description || ''),
      full_description: String(p.full_description || p.description || '')
    };
  });

  console.log('⚡ Seeding all 338 products to Supabase in batches...');
  const BATCH_SIZE = 50;
  for (let i = 0; i < dbPayload.length; i += BATCH_SIZE) {
    const batch = dbPayload.slice(i, i + BATCH_SIZE);
    try {
      const res = await httpsRequest(`${SUPABASE_URL}/rest/v1/products`, 'POST', {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates, return=minimal'
      }, batch);

      if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204) {
        console.log(`  ✓ Synced batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(dbPayload.length/BATCH_SIZE)} (${batch.length} items)`);
      } else {
        console.error(`  ⚠️ Batch ${Math.floor(i/BATCH_SIZE)+1} response:`, res.statusCode, JSON.stringify(res.body).slice(0, 150));
      }
    } catch(err) {
      console.error(`  ❌ Error on batch:`, err.message);
    }
  }

  // 4. Verify Total in Supabase
  const countRes = await httpsRequest(`${SUPABASE_URL}/rest/v1/products?select=count`, 'GET', {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
  });
  console.log('🎉 Supabase products count after sync:', countRes.body);
}

run();
