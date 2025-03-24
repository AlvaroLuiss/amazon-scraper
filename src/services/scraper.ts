import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Product, Result, ScraperError } from '../types/types';
import logger from '../utils/logger';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function scrapeAmazon(keyword: string, retries = 3): Promise<Result<Product[], ScraperError>> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.debug(`Scraping attempt ${attempt} for keyword: ${keyword}`);
      
      const url = `https://www.amazon.com.br/s?k=${encodeURIComponent(keyword)}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Host': 'www.amazon.com.br',
          'Pragma': 'no-cache',
          'Upgrade-Insecure-Requests': '1',
          'sec-ch-ua': '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1'
        },
        timeout: 30000,
        withCredentials: true,
        maxRedirects: 5
      });

      logger.debug(`Response status: ${response.status}`);
      logger.debug('Response HTML length:', response.data.length);

      const dom = new JSDOM(response.data);
      const document = dom.window.document;
      
      logger.debug('HTML Content:', response.data.slice(0, 1000));
      
      const products: Product[] = [];

      const productElements = document.querySelectorAll(
        '[data-component-type="s-search-result"], [data-asin]:not([data-asin=""])'
      );

      logger.debug(`Found ${productElements.length} product elements`);

      for (const element of productElements) {
        try {
          const asin = element.getAttribute('data-asin');
          if (!asin) continue;

          const titleElement = element.querySelector(
            'h2 a.a-link-normal, h2 span.a-text-normal, .a-size-base-plus.a-color-base'
          );
          const title = titleElement?.textContent?.trim();

          const ratingElement = element.querySelector(
            'i.a-icon-star-small, i.a-icon-star, .a-icon-alt'
          );
          const ratingText = ratingElement?.getAttribute('aria-label')?.match(/[\d,]+/)?.[0] ||
                           ratingElement?.textContent?.match(/[\d,]+/)?.[0];
          const rating = ratingText ? parseFloat(ratingText.replace(',', '.')) : undefined;

          const reviewElement = element.querySelector(
            '.a-size-small.a-link-normal[href*="reviews"], span.a-size-base'
          );
          const reviewText = reviewElement?.textContent?.replace(/\D/g, '') ||
                           reviewElement?.getAttribute('aria-label')?.replace(/\D/g, '');
          const reviewCount = reviewText ? parseInt(reviewText) : undefined;

          const imageElement = element.querySelector(
            'img.s-image[srcset], img.s-image'
          );
          const imageUrl = imageElement?.getAttribute('srcset')?.split(' ')[0] || 
                          imageElement?.getAttribute('src');

          const priceElement = element.querySelector(
            'span.a-price span.a-offscreen, span.a-price-whole'
          );
          const priceText = priceElement?.textContent?.replace(/[^\d,]/g, '');
          const price = priceText ? parseFloat(priceText.replace(',', '.')) : undefined;

          const url = `https://www.amazon.com.br/dp/${asin}`;

          if (title && imageUrl) {
            products.push({ 
              title, 
              rating, 
              reviewCount, 
              imageUrl,
              price,
              url,
              asin
            });
          } else {
            logger.debug('Skipped product - missing required fields', {
              hasTitle: !!title,
              hasImage: !!imageUrl,
              hasUrl: !!url
            });
          }
        } catch (error) {
          logger.error('Error parsing product element:', error);
        }
      }

      if (products.length === 0) {
        if (attempt < retries) {
          const delay = Math.floor(Math.random() * 2000) + 1000;
          logger.debug(`No products found, retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        throw new Error('No products found - Amazon might be blocking the request');
      }

      return { ok: true, value: products };

    } catch (error) {
      if (attempt < retries) {
        const delay = Math.floor(Math.random() * 2000) + 1000;
        logger.debug(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      
      logger.error('All scraping attempts failed:', error);
      const scraperError: ScraperError = new Error(
        'Failed to scrape products: ' + (error as Error).message
      );
      scraperError.code = (error as any).code;
      scraperError.status = (error as any).response?.status;
      return { ok: false, error: scraperError };
    }
  }

  return { 
    ok: false, 
    error: new Error('Maximum retry attempts reached') 
  };
}
