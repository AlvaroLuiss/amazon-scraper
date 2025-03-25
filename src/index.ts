import express from 'express';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { z } from 'zod';
import { scrapeAmazon } from './services/scraper';
import logger from './utils/logger';

const app = express();
const port = process.env.PORT || 3000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use(limiter);
app.use(express.static('public'));

const querySchema = z.object({
  keyword: z.string().min(1)
});

const ProductResponseSchema = z.object({
  title: z.string(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().min(0).optional(),
  imageUrl: z.string().url(),
  price: z.number().min(0).optional(),
  url: z.string().url(),
  asin: z.string().min(1)
});

app.get('/api/scrape', async (req, res) => {
  try {
    const query = querySchema.parse(req.query);
    logger.info(`Scraping request received for keyword: ${query.keyword}`);

    const result = await scrapeAmazon(query.keyword);

    if (!result.ok) {
      const error = result.error;
      logger.error('Scraping failed:', error);
      return res.status(error.status || 500).json({ 
        error: error.message,
        code: error.code 
      });
    }

    const validatedProducts = z.array(ProductResponseSchema).parse(result.value);

    if (validatedProducts.length === 0) {
      return res.status(404).json({ 
        error: 'No products found for the given keyword' 
      });
    }

    res.json(validatedProducts);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid keyword parameter' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

const startServer = async (initialPort: number) => {
  const server = createServer(app);

  const tryPort = async (port: number): Promise<number> => {
    try {
      await new Promise((resolve, reject) => {
        server.once('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            server.close();
            resolve(tryPort(port + 1));
          } else {
            reject(err);
          }
        });

        server.listen(port, () => {
          logger.info(`Server running at http://localhost:${port}`);
          resolve(port);
        });
      });
      return port;
    } catch (err) {
      logger.error('Failed to start server:', err);
      throw err;
    }
  };

  return tryPort(initialPort);
};

startServer(Number(port)).catch(err => {
  logger.error('Fatal error starting server:', err);
  process.exit(1);
});
