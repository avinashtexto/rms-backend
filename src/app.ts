import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import adminRoutes from './routes/admin.routes';
import mobileRoutes from './routes/mobile.routes';
import { errorHandler } from './middleware/error.middleware';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './config/swagger.json';
import { logger } from './lib/logger';

const app = express();
const PORT = process.env.PORT || 3002;

// Middlewares
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3002'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const { method, url, ip } = req;
  const userAgent = req.get('user-agent') || '';

  logger.info(`Incoming Request: ${method} ${url} - IP: ${ip} - UA: ${userAgent}`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    logger.info(`Response Status: ${statusCode} for ${method} ${url} - Duration: ${duration}ms`);
  });

  next();
});

// Swagger UI Route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Base routes
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/mobile', mobileRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the RMS API with Clean MVC Architecture and PostgreSQL' });
});

// Centralized error handler
app.use(errorHandler as any);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
