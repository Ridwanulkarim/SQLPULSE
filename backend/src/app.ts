import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import apiRoutes from './routes/api.routes';

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:', 'http:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:4000', 'https://sqlpulse.vercel.app'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || !isProduction) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy: Origin ${origin} not allowed.`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'x-report-key'],
    credentials: true,
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests from this IP, please try again after 15 minutes.' },
});
app.use('/api/', globalLimiter);

const reportRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Report creation limit reached. Please wait 15 minutes before saving more reports.' },
});
app.use('/api/v1/reports', (req, res, next) => {
  if (req.method === 'POST') {
    return reportRateLimiter(req, res, next);
  }
  next();
});

app.use(express.json({ limit: '2mb' }));

export function jsonErrorHandler(err: any, _req: express.Request, res: express.Response, next: express.NextFunction) {
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400) {
    res.status(400).json({
      success: false,
      error: 'Malformed JSON payload in request body. Please verify your JSON syntax.',
    });
    return;
  }
  next(err);
}

app.use(jsonErrorHandler);

if (!isProduction) {
  app.use(morgan('dev'));
}

export function healthHandler(_req: express.Request, res: express.Response) {
  res.json({
    status: 'healthy',
    service: 'SQLPulse Engine',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
}

app.get('/health', healthHandler);

app.use('/api/v1', apiRoutes);

const candidateDistPaths = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(__dirname, '../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist'),
];

const frontendDist = candidateDistPaths.find((p) => fs.existsSync(p));

if (frontendDist) {
  app.use(express.static(frontendDist));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

export function globalErrorHandler(err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) {
  if (err.message && err.message.includes('CORS policy')) {
    res.status(403).json({ success: false, error: err.message });
    return;
  }
  if (err instanceof SyntaxError && (err as any).status === 400) {
    res.status(400).json({
      success: false,
      error: 'Malformed JSON payload in request body.',
    });
    return;
  }
  console.error('Server Internal Error:', err);
  res.status(500).json({
    success: false,
    error: isProduction ? 'An unexpected internal error occurred.' : err.message || 'Internal Server Error',
  });
}

app.use(globalErrorHandler);

export default app;
