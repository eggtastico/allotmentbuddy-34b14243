import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 5173;
const distPath = join(__dirname, 'dist');

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  next();
});

// Gzip compression middleware
app.use((req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding.includes('gzip')) return next();

  const originalSend = res.send.bind(res);
  res.send = function (body) {
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      const buf = typeof body === 'string' ? Buffer.from(body) : body;
      if (buf.length > 1024) {
        res.setHeader('Content-Encoding', 'gzip');
        res.removeHeader('Content-Length');
        return originalSend(zlib.gzipSync(buf));
      }
    }
    return originalSend(body);
  };
  next();
});

// Serve static files with cache headers
const staticOptions = { maxAge: '1y', immutable: true };
const htmlOptions = { maxAge: '0' };

// Middleware to serve dist folder as static at / prefix
app.use(express.static(distPath, staticOptions));

// Create a middleware to serve dist as /allotment
app.use('/allotment', express.static(distPath, staticOptions));

// For SPA, catch unknown routes and serve index.html
app.use((req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✨ Allotment Buddy deployed!`);
  console.log(`📍 Local: http://localhost:${PORT}/allotment/`);
  console.log(`🌐 Access via Nginx at http://your-server-ip/allotment/`);
  console.log(`\n📦 Build size: ${(fs.statSync(distPath).size / 1024 / 1024).toFixed(2)} MB`);
});
