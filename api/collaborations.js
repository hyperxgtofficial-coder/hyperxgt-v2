// Vercel Serverless Function: Brand Collaborations API (GET, POST, PUT, DELETE)
const https = require('https');

let inMemoryCollaborations = [
  { id: 1, name: "Citroen Racing WRC", logo: "assets/hyperxgt-logo.png", link: "https://hyperxgt.com", order: 1, active: true },
  { id: 2, name: "MJX Hyper Go", logo: "assets/hyperxgt-logo.png", link: "https://hyperxgt.com", order: 2, active: true },
  { id: 3, name: "HBX Racing", logo: "assets/hyperxgt-logo.png", link: "https://hyperxgt.com", order: 3, active: true },
  { id: 4, name: "WLtoys High Speed", logo: "assets/hyperxgt-logo.png", link: "https://hyperxgt.com", order: 4, active: true },
  { id: 5, name: "FlySky Radio Systems", logo: "assets/hyperxgt-logo.png", link: "https://hyperxgt.com", order: 5, active: true },
  { id: 6, name: "Gens Ace Lipo Power", logo: "assets/hyperxgt-logo.png", link: "https://hyperxgt.com", order: 6, active: true }
];

function httpsRequest(urlStr, method, headers, bodyObj) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const postData = bodyObj ? JSON.stringify(bodyObj) : '';
      const reqHeaders = { 'Content-Type': 'application/json', ...headers };
      if (postData) reqHeaders['Content-Length'] = Buffer.byteLength(postData);

      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: method || 'GET',
        headers: reqHeaders
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }); }
          catch(e) { resolve({ statusCode: res.statusCode, body: data }); }
        });
      });

      req.on('error', err => reject(err));
      if (postData) req.write(postData);
      req.end();
    } catch(err) { reject(err); }
  });
}

function verifyAdminAuth(req) {
  const adminKey = req.headers['x-admin-key'] || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : '');
  const secretKey = process.env.ADMIN_SECRET_KEY || "hx_admin_sec_2026_super_key";
  return !!(adminKey && adminKey === secretKey);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = (process.env.SUPABASE_URL || "https://hyperxgt-db.supabase.co").replace(/\/$/, '');
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

  try {
    if (req.method === 'GET') {
      if (supabaseAnonKey && supabaseUrl.includes("supabase")) {
        try {
          const dbRes = await httpsRequest(`${supabaseUrl}/rest/v1/collaborations?select=*`, 'GET', {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`
          });
          if (dbRes.statusCode === 200 && Array.isArray(dbRes.body) && dbRes.body.length > 0) {
            inMemoryCollaborations = dbRes.body;
          }
        } catch(e) {}
      }

      inMemoryCollaborations.sort((a, b) => (a.order || 0) - (b.order || 0));
      return res.status(200).json({ success: true, collaborations: inMemoryCollaborations });
    }

    // REQUIRE ADMIN AUTH FOR WRITE / EDIT / DELETE
    if (!verifyAdminAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized: Store Admin credentials required for brand collaboration operations' });
    }

    if (req.method === 'POST') {
      const newCollab = req.body || {};
      newCollab.id = Date.now();
      newCollab.active = newCollab.active !== undefined ? newCollab.active : true;
      inMemoryCollaborations.push(newCollab);

      if (supabaseServiceKey && supabaseUrl.includes("supabase")) {
        try {
          await httpsRequest(`${supabaseUrl}/rest/v1/collaborations`, 'POST', {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Prefer': 'return=minimal'
          }, newCollab);
        } catch(e) { console.error('Supabase collab POST error:', e.message); }
      }

      return res.status(201).json({ success: true, collaboration: newCollab });
    }

    if (req.method === 'PUT') {
      const updated = req.body || {};
      const idx = inMemoryCollaborations.findIndex(c => String(c.id) === String(updated.id));
      if (idx !== -1) {
        inMemoryCollaborations[idx] = { ...inMemoryCollaborations[idx], ...updated };
      }

      if (supabaseServiceKey && supabaseUrl.includes("supabase")) {
        try {
          await httpsRequest(`${supabaseUrl}/rest/v1/collaborations?id=eq.${updated.id}`, 'PATCH', {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          }, updated);
        } catch(e) { console.error('Supabase collab PUT error:', e.message); }
      }

      return res.status(200).json({ success: true, collaboration: updated });
    }

    if (req.method === 'DELETE') {
      const deleteId = req.query.id;
      inMemoryCollaborations = inMemoryCollaborations.filter(c => String(c.id) !== String(deleteId));

      if (supabaseServiceKey && supabaseUrl.includes("supabase")) {
        try {
          await httpsRequest(`${supabaseUrl}/rest/v1/collaborations?id=eq.${deleteId}`, 'DELETE', {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          });
        } catch(e) { console.error('Supabase collab DELETE error:', e.message); }
      }

      return res.status(200).json({ success: true, message: `Collaboration ID ${deleteId} deleted.` });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error("Collaborations API Error:", err.message);
    return res.status(500).json({ error: "Failed to process collaborations", details: err.message });
  }
};
