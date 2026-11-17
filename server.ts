import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/db.ts';
import authRoutes from './server/routes/authRoutes.ts';
import hrRoutes from './server/routes/hrRoutes.ts';
import projectRoutes from './server/routes/projectRoutes.ts';
import quotationFinanceRoutes from './server/routes/quotationFinanceRoutes.ts';
import systemRoutes from './server/routes/systemRoutes.ts';

async function startServer() {
  await initDatabase();

  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true }));

  // CORS for Flutter mobile/desktop clients connecting to this backend
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Static uploaded files
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  // API Routes
  app.use('/api', authRoutes);
  app.use('/api', hrRoutes);
  app.use('/api', projectRoutes);
  app.use('/api', quotationFinanceRoutes);
  app.use('/api', systemRoutes);

  // Vite middleware in dev / static dist in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SIID ERP] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[SIID ERP] Failed to start server:', err);
  process.exit(1);
});
