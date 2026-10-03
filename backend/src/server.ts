import app from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 SQLPulse Backend Engine running on http://localhost:${PORT}`);
  console.log(`📡 API Health Endpoint: http://localhost:${PORT}/health`);
  console.log(`🔍 Analyzer API Base: http://localhost:${PORT}/api/v1`);
});
