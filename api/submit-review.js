// Vercel Serverless Function: Customer Review & Unboxing Media Submission API
const https = require('https');
const fs = require('fs');
const path = require('path');

let inMemoryReviews = [
  {
    id: "REV-10482",
    date: "2026-08-22 14:20",
    name: "Aman Sharma",
    email: "aman.s@gmail.com",
    phone: "+91 98450 11223",
    orderId: "HX-948210",
    prodName: "1:7 Citroen C3 WRC Brushless Rally Car",
    rating: 5,
    text: "Absolute monster of an RC car! Speeds over 60 km/h on gravel. Unboxing experience was top notch and delivery came in 2 days.",
    mediaUrl: "assets/uploads/prod_1787920104060_6427.jpg",
    mediaType: "image",
    status: "Approved",
    couponCode: "UNBOX-94821",
    featured: true
  }
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
    // 1. GET REVIEWS
    if (req.method === 'GET') {
      if (supabaseAnonKey && supabaseUrl.includes("supabase")) {
        try {
          const dbRes = await httpsRequest(`${supabaseUrl}/rest/v1/reviews?select=*`, 'GET', {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`
          });
          if (dbRes.statusCode === 200 && Array.isArray(dbRes.body) && dbRes.body.length > 0) {
            inMemoryReviews = dbRes.body;
          }
        } catch(e) {}
      }

      return res.status(200).json({ success: true, reviews: inMemoryReviews });
    }

    // 2. POST NEW CUSTOMER REVIEW / UNBOXING SUBMISSION
    if (req.method === 'POST') {
      const { name, email, phone, orderId, prodName, rating, text, mediaUrl, mediaType } = req.body || {};

      if (!name || !email || !text) {
        return res.status(400).json({ error: 'Name, email, and review text are required.' });
      }

      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email).trim())) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }

      const ratingValue = Number(rating);
      if (rating !== undefined && (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5)) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
      }

      // mediaUrl is rendered as an <a href> in the admin panel. Storing it unchecked let a
      // public submission put a javascript: URL in front of a signed-in administrator.
      const rawMedia = String(mediaUrl || '').trim();
      if (rawMedia && !/^(https?:\/\/|data:(image|video)\/|assets\/)/i.test(rawMedia)) {
        return res.status(400).json({ error: 'Media link must be an http(s) URL or an uploaded file.' });
      }

      if (String(text).trim().length > 5000) {
        return res.status(400).json({ error: 'Review text is too long (5000 character limit).' });
      }

      // Check duplicate submission for orderId / email
      const existing = inMemoryReviews.find(r => r.email === email && r.orderId === orderId);
      if (existing) {
        return res.status(400).json({ error: 'You have already submitted a review for this order.' });
      }

      const newReview = {
        id: `REV-${Date.now()}`,
        date: new Date().toLocaleString("en-IN"),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : "",
        orderId: orderId ? orderId.trim() : "HX-STORE",
        prodName: prodName ? prodName.trim() : "HyperXGT RC Model",
        rating: Number(rating) || 5,
        text: text.trim(),
        mediaUrl: rawMedia,
        mediaType: mediaType || (/\.(mp4|mov|webm)(?:$|[?#])|^data:video\//i.test(rawMedia) ? "video" : "image"),
        status: "Pending Approval",
        couponCode: null,
        featured: false
      };

      inMemoryReviews.unshift(newReview);

      if (supabaseServiceKey && supabaseUrl.includes("supabase")) {
        try {
          await httpsRequest(`${supabaseUrl}/rest/v1/reviews`, 'POST', {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Prefer': 'return=minimal'
          }, newReview);
        } catch(e) { console.error('Supabase review POST error:', e.message); }
      }

      return res.status(201).json({
        success: true,
        message: 'Review & unboxing submission received! Your submission is pending admin review. Upon approval, a 10% coupon code will be sent to your email.',
        review: newReview
      });
    }

    // 3. PUT ADMIN ACTION (APPROVE / REJECT / FEATURE) - REQUIRES ADMIN AUTH
    if (req.method === 'PUT' || req.method === 'DELETE') {
      if (!verifyAdminAuth(req)) {
        return res.status(401).json({ error: 'Unauthorized: Store Admin credentials required for review approvals and moderation' });
      }
    }

    if (req.method === 'PUT') {
      const { id, action, status } = req.body || {};
      const rev = inMemoryReviews.find(r => r.id === id);
      if (!rev) return res.status(404).json({ error: 'Review not found' });

      if (action === 'approve' || status === 'Approved') {
        rev.status = 'Approved';
        if (!rev.couponCode) {
          rev.couponCode = `UNBOX-${Math.floor(10000 + Math.random() * 90000)}`;
        }
      } else if (action === 'reject' || status === 'Rejected') {
        rev.status = 'Rejected';
      } else if (action === 'feature') {
        rev.featured = !rev.featured;
      }

      if (supabaseServiceKey && supabaseUrl.includes("supabase")) {
        try {
          await httpsRequest(`${supabaseUrl}/rest/v1/reviews?id=eq.${id}`, 'PATCH', {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          }, rev);
        } catch(e) { console.error('Supabase review PUT error:', e.message); }
      }

      return res.status(200).json({ success: true, message: `Review ${id} status updated to ${rev.status}`, review: rev });
    }

    // 4. DELETE REVIEW
    if (req.method === 'DELETE') {
      const deleteId = req.query.id;
      inMemoryReviews = inMemoryReviews.filter(r => r.id !== deleteId);

      if (supabaseServiceKey && supabaseUrl.includes("supabase")) {
        try {
          await httpsRequest(`${supabaseUrl}/rest/v1/reviews?id=eq.${deleteId}`, 'DELETE', {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          });
        } catch(e) { console.error('Supabase review DELETE error:', e.message); }
      }

      return res.status(200).json({ success: true, message: `Review ${deleteId} deleted.` });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error("Review API Error:", err.message);
    return res.status(500).json({ error: "Failed to process review", details: err.message });
  }
};
