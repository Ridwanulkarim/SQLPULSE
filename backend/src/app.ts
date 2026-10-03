import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import apiRoutes from './routes/api.routes';

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false, // Allows inline scripts & fonts in Vite React bundle
  })
);
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'SQLPulse Unified Engine',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1', apiRoutes);

const candidateDistPaths = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(__dirname, '../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist'),
];

const frontendDist = candidateDistPaths.find((p) => fs.existsSync(p));

if (frontendDist) {
  console.log(`📦 Serving React frontend from: ${frontendDist}`);
  app.use(express.static(frontendDist));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

export default app;
