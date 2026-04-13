import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 5173;
const distPath = join(__dirname, 'dist');

// Middleware to serve dist folder as static at / prefix
app.use(express.static(distPath));

// Create a middleware to serve dist as /allotment
app.use('/allotment', express.static(distPath));

// For SPA, catch unknown routes and serve index.html
app.use((req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✨ Allotment Buddy deployed!`);
  console.log(`📍 Local: http://localhost:${PORT}/allotment/`);
  console.log(`🌐 Access via Nginx at http://your-server-ip/allotment/`);
  console.log(`\n📦 Build size: ${(fs.statSync(distPath).size / 1024 / 1024).toFixed(2)} MB`);
});
