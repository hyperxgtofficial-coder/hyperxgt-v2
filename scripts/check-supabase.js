const https = require('https');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const t = line.trim();
  if (t && !t.startsWith('#')) {
    const idx = t.indexOf('=');
    if (idx !== -1) env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
  }
});

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

function api(reqPath, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url + reqPath);
    const postData = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method,
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function test() {
  console.log('🚀 Connecting to Supabase project:', url);

  // 1. Check storage buckets
  const buckets = await api('/storage/v1/bucket');
  console.log('📦 Storage buckets response:', buckets.status, buckets.body);

  if (Array.isArray(buckets.body)) {
    const hasProducts = buckets.body.some(b => b.name === 'products' || b.id === 'products');
    if (!hasProducts) {
      console.log('Creating public "products" storage bucket...');
      const createB = await api('/storage/v1/bucket', 'POST', {
        id: 'products',
        name: 'products',
        public: true,
        file_size_limit: 52428800
      });
      console.log('Create bucket status:', createB.status, createB.body);
    } else {
      console.log('✓ Public "products" storage bucket exists and is ready!');
    }
  }

  // 2. Check tables
  const productsTable = await api('/rest/v1/products?select=count');
  console.log('Products table status:', productsTable.status, productsTable.body);

  const ordersTable = await api('/rest/v1/orders?select=count');
  console.log('Orders table status:', ordersTable.status, ordersTable.body);

  const profilesTable = await api('/rest/v1/profiles?select=count');
  console.log('Profiles table status:', profilesTable.status, profilesTable.body);
}

test().catch(err => console.error(err));
