// Vercel Serverless Function: Persistent Database Product CRUD API (GET, POST, PUT, DELETE)
const https = require('https');
const fs = require('fs');
const path = require('path');

// Global serverless memory cache (persists across warm function invocations)
let cachedProducts = null;

function getInitialProducts() {
  if (cachedProducts && Array.isArray(cachedProducts) && cachedProducts.length > 0) {
    return cachedProducts;
  }
  try {
    const jsonPath = path.join(__dirname, '..', 'data', 'products.json');
    if (fs.existsSync(jsonPath)) {
      const data = fs.readFileSync(jsonPath, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedProducts = parsed;
        return cachedProducts;
      }
    }
  } catch(e) {}
  return cachedProducts || [];
}

function saveProductsToJsonDisk(arr) {
  try {
    if (!Array.isArray(arr) || !arr.length) return;

    let existingMap = new Map();
    const jsonPath = path.join(__dirname, '..', 'data', 'products.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const diskArr = JSON.parse(raw);
        if (Array.isArray(diskArr)) {
          diskArr.forEach(p => existingMap.set(String(p.id), p));
        }
      } catch(e) {}
    }

    const merged = arr.map(p => {
      const old = existingMap.get(String(p.id)) || {};
      const isExplicitNoImage = p.no_image === true || (p.image === '' && (!p.images || p.images.length === 0));
      
      let imgs = [];
      if (!isExplicitNoImage) {
        if (Array.isArray(p.images) && p.images.length > 0) {
          p.images.forEach(x => {
            if (typeof x === 'string') {
              x.split(',').map(u => u.trim()).filter(Boolean).forEach(u => {
                if (!imgs.includes(u)) imgs.push(u);
              });
            }
          });
        } else if (typeof p.images === 'string' && p.images.trim()) {
          p.images.split(',').map(u => u.trim()).filter(Boolean).forEach(u => {
            if (!imgs.includes(u)) imgs.push(u);
          });
        }

        if (p.image && typeof p.image === 'string' && p.image.trim()) {
          p.image.split(',').map(u => u.trim()).filter(Boolean).forEach(u => {
            if (!imgs.includes(u)) imgs.push(u);
          });
        }

        if (!imgs.length && old.image && !old.no_image) {
          if (Array.isArray(old.images) && old.images.length) {
            imgs = old.images.filter(Boolean);
          } else if (typeof old.image === 'string') {
            imgs = old.image.split(',').map(u => u.trim()).filter(Boolean);
          }
        }
      }

      const mainImg = imgs[0] || '';

      return {
        ...old,
        ...p,
        image: mainImg,
        images: imgs,
        no_image: isExplicitNoImage || !mainImg
      };
    });

    const dir = path.dirname(jsonPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2), 'utf8');

    // Keep assets/products.js in exact parity
    const jsPath = path.join(__dirname, '..', 'assets', 'products.js');
    try {
      fs.writeFileSync(jsPath, `window.HX_PRODUCTS = ${JSON.stringify(merged, null, 2)};\n`, 'utf8');
    } catch(e) {}

    cachedProducts = merged;
  } catch(e) {
    console.error("Disk save error:", e.message);
  }
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

      const req = https.request(options, (res) => {
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

function verifyAdminAuth(req) {
  const adminKey = req.headers['x-admin-key'] || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : '');
  const secretKey = process.env.ADMIN_SECRET_KEY || "hx_admin_sec_2026_super_key";
  return !!(adminKey && adminKey === secretKey);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, '');
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

  try {
    cachedProducts = getInitialProducts();

    // GET METHOD IS PUBLIC
    if (req.method === 'GET') {
      const id = req.query.id ? Number(req.query.id) : null;

      // Try fetching live products from Supabase REST database
      if (supabaseAnonKey && supabaseUrl.includes("supabase")) {
        try {
          const dbRes = await httpsRequest(`${supabaseUrl}/rest/v1/products?select=*`, 'GET', {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`
          });
          if (dbRes.statusCode === 200 && Array.isArray(dbRes.body) && dbRes.body.length > 0) {
            // Map Supabase column names to frontend attributes
            cachedProducts = dbRes.body.map(item => {
              let rawImgs = [];
              if (item.image && typeof item.image === 'string' && item.image.trim()) {
                const trimmed = item.image.trim();
                if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                  try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) rawImgs = parsed.filter(Boolean);
                  } catch(e) {}
                }
                if (!rawImgs.length) {
                  rawImgs = trimmed.split(',').map(x => x.trim()).filter(Boolean);
                }
              }
              const mainHeroImg = rawImgs[0] || '';

              return {
                id: Number(item.id),
                sku: item.sku,
                name: item.name,
                category: item.category,
                price: Number(item.price || 0),
                mrp: Number(item.mrp || item.regular_price || item.price || 0),
                stock: Number(item.stock !== undefined ? item.stock : 25),
                gstRate: Number(item.gst_rate || 18),
                taxMode: item.tax_mode || 'inclusive',
                hsn: item.hsn || '95030090',
                scale: item.scale || '1:16',
                speed: item.speed || '35 KM/H',
                drive: item.drive || '4WD',
                image: mainHeroImg,
                images: rawImgs,
                no_image: !mainHeroImg,
                short_description: item.short_description || '',
                full_description: item.full_description || '',
                discount: item.mrp && item.price ? Math.round(((item.mrp - item.price) / item.mrp) * 100) : 0
              };
            });
          }
        } catch(e) {}
      }

      if (id && cachedProducts) {
        const item = cachedProducts.find(x => String(x.id) === String(id));
        return res.status(200).json({ success: true, product: item });
      }

      return res.status(200).json({
        success: true,
        count: cachedProducts ? cachedProducts.length : 0,
        products: cachedProducts || []
      });
    }

    // REQUIRE ADMIN AUTH FOR WRITE & DELETE OPERATIONS
    if (!verifyAdminAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized: Store Admin credentials required for database modifications' });
    }

    // 2. PUT: UPDATE EXISTING PRODUCT (STOCK, PRICE, SPECS)
    if (req.method === 'PUT') {
      const updatedProd = req.body || {};
      if (!updatedProd.id && !updatedProd.sku) {
        return res.status(400).json({ error: 'Product ID or SKU required for update' });
      }

      // Update in memory cache
      if (cachedProducts && Array.isArray(cachedProducts)) {
        const idx = cachedProducts.findIndex(x => String(x.id) === String(updatedProd.id) || (x.sku && x.sku.toLowerCase() === (updatedProd.sku || '').toLowerCase()));
        if (idx !== -1) {
          cachedProducts[idx] = { ...cachedProducts[idx], ...updatedProd };
        } else {
          cachedProducts.unshift(updatedProd);
        }
        saveProductsToJsonDisk(cachedProducts);
      }

      // Persist to Supabase DB if credentials set
      if (supabaseServiceKey && supabaseUrl.includes("supabase")) {
        try {
          let existingDbImg = '';
          try {
            const singleDbRes = await httpsRequest(`${supabaseUrl}/rest/v1/products?id=eq.${updatedProd.id}&select=image`, 'GET', {
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`
            });
            if (singleDbRes.statusCode === 200 && Array.isArray(singleDbRes.body) && singleDbRes.body.length > 0) {
              existingDbImg = singleDbRes.body[0].image || '';
            }
          } catch(e) {}

          const isExplicitNoImage = updatedProd.no_image === true || (updatedProd.image === '' && (!updatedProd.images || updatedProd.images.length === 0));
          let allImgs = [];
          if (!isExplicitNoImage) {
            if (Array.isArray(updatedProd.images) && updatedProd.images.length > 0) {
              updatedProd.images.forEach(x => {
                if (typeof x === 'string') {
                  x.split(',').map(u => u.trim()).filter(Boolean).forEach(u => {
                    if (!allImgs.includes(u)) allImgs.push(u);
                  });
                }
              });
            }
            if (updatedProd.image && typeof updatedProd.image === 'string' && updatedProd.image.trim()) {
              updatedProd.image.split(',').map(u => u.trim()).filter(Boolean).forEach(u => {
                if (!allImgs.includes(u)) allImgs.push(u);
              });
            }
            if (!allImgs.length && existingDbImg) {
              existingDbImg.split(',').map(u => u.trim()).filter(Boolean).forEach(u => {
                if (!allImgs.includes(u)) allImgs.push(u);
              });
            }
          }

          const finalSupabaseImg = isExplicitNoImage ? '' : allImgs.join(', ');

          const dbItem = {
            id: Number(updatedProd.id),
            sku: String(updatedProd.sku || `HX-${updatedProd.id}`),
            name: String(updatedProd.name || ''),
            category: String(updatedProd.category || 'Racing Cars'),
            price: Number(updatedProd.price || 0),
            mrp: Number(updatedProd.mrp || updatedProd.regular_price || updatedProd.price || 0),
            stock: Number(updatedProd.stock !== undefined ? updatedProd.stock : 25),
            gst_rate: Number(updatedProd.gstRate || updatedProd.gst_rate || 18),
            tax_mode: String(updatedProd.taxMode || updatedProd.tax_mode || 'inclusive'),
            hsn: String(updatedProd.hsn || '95030090'),
            scale: String(updatedProd.scale || '1:16'),
            speed: String(updatedProd.speed || '35 KM/H'),
            drive: String(updatedProd.drive || '4WD'),
            image: finalSupabaseImg,
            short_description: String(updatedProd.short_description || ''),
            full_description: String(updatedProd.full_description || updatedProd.description || '')
          };

          await httpsRequest(`${supabaseUrl}/rest/v1/products`, 'POST', {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Prefer': 'resolution=merge-duplicates, return=minimal'
          }, [dbItem]);
        } catch(e) { console.error('Supabase PUT error:', e.message); }
      }

      return res.status(200).json({
        success: true,
        message: `Product #${updatedProd.id} (${updatedProd.sku}) updated in database!`,
        product: updatedProd
      });
    }

    // 3. POST: ADD NEW PRODUCT OR BULK SYNC
    if (req.method === 'POST') {
      const payload = req.body || {};

      // Bulk list sync from CSV or admin
      if (req.query.bulk === '1' && Array.isArray(payload)) {
        cachedProducts = payload;
        saveProductsToJsonDisk(cachedProducts);

        if (supabaseServiceKey && supabaseUrl.includes("supabase")) {
          try {
            let existingDbMap = new Map();
            try {
              const fetchDbRes = await httpsRequest(`${supabaseUrl}/rest/v1/products?select=id,image`, 'GET', {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`
              });
              if (fetchDbRes.statusCode === 200 && Array.isArray(fetchDbRes.body)) {
                fetchDbRes.body.forEach(item => existingDbMap.set(String(item.id), item));
              }
            } catch(e) {}

            const dbPayload = payload.map(p => {
              const dbItem = existingDbMap.get(String(p.id)) || {};
              const isNoImg = p.no_image === true || (p.image === '' && (!p.images || p.images.length === 0));
              let pImgs = [];
              if (!isNoImg) {
                if (Array.isArray(p.images) && p.images.length > 0) {
                  p.images.forEach(x => {
                    if (typeof x === 'string') {
                      x.split(',').map(u => u.trim()).filter(Boolean).forEach(u => {
                        if (!pImgs.includes(u)) pImgs.push(u);
                      });
                    }
                  });
                }
                if (p.image && typeof p.image === 'string' && p.image.trim()) {
                  p.image.split(',').map(u => u.trim()).filter(Boolean).forEach(u => {
                    if (!pImgs.includes(u)) pImgs.push(u);
                  });
                }
                if (!pImgs.length && dbItem.image) {
                  pImgs = String(dbItem.image).split(',').map(u => u.trim()).filter(Boolean);
                }
              }

              const imgVal = isNoImg ? '' : pImgs.join(', ');

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

            await httpsRequest(`${supabaseUrl}/rest/v1/products`, 'POST', {
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Prefer': 'resolution=merge-duplicates, return=minimal'
            }, dbPayload);
          } catch(e) { console.error('Supabase bulk POST error:', e.message); }
        }

        return res.status(200).json({ success: true, message: `Bulk updated ${payload.length} products to live database!` });
      }

      const newProd = payload;
      if (cachedProducts && Array.isArray(cachedProducts)) {
        cachedProducts.unshift(newProd);
        saveProductsToJsonDisk(cachedProducts);
      }

      if (supabaseServiceKey && supabaseUrl.includes("supabase")) {
        try {
          const isNoImg = newProd.no_image === true || (!newProd.image && (!newProd.images || newProd.images.length === 0));
          let pImgs = [];
          if (!isNoImg) {
            if (Array.isArray(newProd.images) && newProd.images.length > 0) {
              newProd.images.forEach(x => {
                if (typeof x === 'string') {
                  x.split(',').map(u => u.trim()).filter(Boolean).forEach(u => {
                    if (!pImgs.includes(u)) pImgs.push(u);
                  });
                }
              });
            }
            if (newProd.image && typeof newProd.image === 'string' && newProd.image.trim()) {
              newProd.image.split(',').map(u => u.trim()).filter(Boolean).forEach(u => {
                if (!pImgs.includes(u)) pImgs.push(u);
              });
            }
          }
          const imgVal = isNoImg ? '' : pImgs.join(', ');

          const dbItem = {
            id: Number(newProd.id),
            sku: String(newProd.sku || `HX-${newProd.id}`),
            name: String(newProd.name || ''),
            category: String(newProd.category || 'Racing Cars'),
            price: Number(newProd.price || 0),
            mrp: Number(newProd.mrp || newProd.regular_price || newProd.price || 0),
            stock: Number(newProd.stock !== undefined ? newProd.stock : 25),
            gst_rate: Number(newProd.gstRate || newProd.gst_rate || 18),
            tax_mode: String(newProd.taxMode || newProd.tax_mode || 'inclusive'),
            hsn: String(newProd.hsn || '95030090'),
            scale: String(newProd.scale || '1:16'),
            speed: String(newProd.speed || '35 KM/H'),
            drive: String(newProd.drive || '4WD'),
            image: imgVal,
            short_description: String(newProd.short_description || ''),
            full_description: String(newProd.full_description || newProd.description || '')
          };
          await httpsRequest(`${supabaseUrl}/rest/v1/products`, 'POST', {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Prefer': 'resolution=merge-duplicates, return=minimal'
          }, [dbItem]);
        } catch(e) { console.error('Supabase POST error:', e.message); }
      }

      return res.status(201).json({
        success: true,
        message: `New product SKU ${newProd.sku || 'HX-NEW'} saved to database!`,
        product: newProd
      });
    }

    // 4. DELETE PRODUCT FROM DATABASE
    if (req.method === 'DELETE') {
      const deleteId = Number(req.query.id);
      if (cachedProducts && Array.isArray(cachedProducts)) {
        cachedProducts = cachedProducts.filter(x => x.id !== deleteId);
        saveProductsToJsonDisk(cachedProducts);
      }

      if (supabaseServiceKey && supabaseUrl.includes("supabase")) {
        try {
          await httpsRequest(`${supabaseUrl}/rest/v1/products?id=eq.${deleteId}`, 'DELETE', {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          });
        } catch(e) { console.error('Supabase DELETE error:', e.message); }
      }

      return res.status(200).json({
        success: true,
        message: `Product ID ${deleteId} deleted from database!`
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Products CRUD API Error:', err.message);
    return res.status(500).json({ error: 'Database operation failed', details: err.message });
  }
};
