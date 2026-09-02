const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // matches the base64 image uploads used by /api/upload-image

const mimeTypes = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.csv': 'text/csv; charset=UTF-8',
  '.txt': 'text/plain; charset=UTF-8',
  '.xml': 'application/xml; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

// The /api handlers are written for the Vercel Node runtime, which hands them an
// Express-shaped req/res (req.query, req.body, res.status().json()). Raw http objects
// have none of that, so we adapt them here to keep local and Vercel behaviour identical.
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseBody(raw, contentType) {
  if (!raw || raw.length === 0) return undefined;
  const text = raw.toString('utf8');
  const type = (contentType || '').toLowerCase();
  if (type.includes('application/json')) return JSON.parse(text);
  if (type.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(text).entries());
  }
  // Vercel falls back to JSON detection when the client omits the header.
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed); } catch (e) { /* fall through to raw text */ }
  }
  return text;
}

function decorateResponse(res) {
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (payload) {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=UTF-8');
    res.end(JSON.stringify(payload));
    return res;
  };
  res.send = function (payload) {
    if (payload === undefined || payload === null) return res.end();
    if (Buffer.isBuffer(payload)) return res.end(payload);
    if (typeof payload === 'object') return res.json(payload);
    if (!res.headersSent) res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.end(String(payload));
    return res;
  };
  res.redirect = function (location, code) {
    if (!res.headersSent) res.writeHead(code || 302, { Location: location });
    res.end();
    return res;
  };
  return res;
}

async function handleApi(req, res, apiName) {
  // Only allow a flat handler name; blocks /api/../server style traversal.
  if (!/^[a-z0-9-]+$/i.test(apiName)) {
    return res.status(404).json({ error: 'Not found' });
  }

  let targetName = apiName;
  if (targetName === 'zoho' || targetName === 'shiprocket') {
    targetName = 'integrations';
  }

  const apiPath = path.join(PUBLIC_DIR, 'api', targetName + '.js');
  if (!fs.existsSync(apiPath)) {
    return res.status(404).json({ error: 'No API route named ' + apiName });
  }

  const parsedUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  req.query = Object.fromEntries(parsedUrl.searchParams.entries());
  if (apiName === 'zoho') req.query.service = 'zoho';

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      req.body = parseBody(await readBody(req), req.headers['content-type']);
    } catch (err) {
      const code = err.statusCode || 400;
      return res.status(code).json({ error: code === 413 ? 'Request body too large' : 'Invalid request body' });
    }
  }

  // require() is cached per-file; clearing it mirrors a Vercel cold start and picks up edits.
  delete require.cache[require.resolve(apiPath)];
  const handler = require(apiPath);
  if (typeof handler !== 'function') {
    return res.status(500).json({ error: 'API route ' + apiName + ' does not export a handler function' });
  }

  await handler(req, res);
}

function resolveStaticPath(reqUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(reqUrl);
  } catch (e) {
    return null; // malformed percent-encoding
  }

  if (pathname === '/') pathname = '/index.html';

  const candidate = path.resolve(PUBLIC_DIR, '.' + pathname);
  // Reject anything that escapes the project root via ../ segments.
  if (candidate !== PUBLIC_DIR && !candidate.startsWith(PUBLIC_DIR + path.sep)) return null;

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;

  // Vercel runs with cleanUrls, so /shop must resolve to shop.html locally too.
  if (!path.extname(candidate)) {
    const withHtml = candidate + '.html';
    if (fs.existsSync(withHtml) && fs.statSync(withHtml).isFile()) return withHtml;
    const indexFile = path.join(candidate, 'index.html');
    if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) return indexFile;
  }

  return null;
}

const server = http.createServer((req, res) => {
  decorateResponse(res);

  const reqUrl = req.url.split('?')[0];

  if (reqUrl.startsWith('/api/')) {
    const apiName = reqUrl.slice('/api/'.length).replace(/\/+$/, '');
    handleApi(req, res, apiName).catch(err => {
      // A handler that throws must return a useful 500, not take the whole server down.
      console.error('[api/' + apiName + ']', err && err.stack ? err.stack : err);
      if (res.headersSent) return res.end();
      res.status(500).json({ error: 'Internal server error', details: err && err.message });
    });
    return;
  }

  const filePath = resolveStaticPath(reqUrl);

  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const stats = fs.statSync(filePath);

  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Content-Length': stats.size,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff'
  });

  if (req.method === 'HEAD') return res.end();

  const stream = fs.createReadStream(filePath);
  stream.on('error', err => {
    console.error('[static]', err.message);
    res.end();
  });
  stream.pipe(res);
});

// Last line of defence: log and keep serving instead of exiting on an unexpected throw.
process.on('uncaughtException', err => console.error('[uncaughtException]', err && err.stack ? err.stack : err));
process.on('unhandledRejection', err => console.error('[unhandledRejection]', err && err.stack ? err.stack : err));

// A failed bind must exit rather than be swallowed by the uncaughtException handler above,
// which would otherwise leave a live process that is not actually serving anything.
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or set PORT.`);
  } else {
    console.error('[server]', err.stack || err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log('Hyper X GT static + API server listening on http://localhost:' + PORT);
});
