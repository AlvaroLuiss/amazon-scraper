export interface Product {
  title: string;
  rating?: number;
  reviewCount?: number;
  imageUrl: string;
  price?: number;
  url: string;
  asin: string;
}

export interface ScraperError extends Error {
code?: string;
status?: number;
}

export type Result<T, E = Error> = 
| { ok: true; value: T }
| { ok: false; error: E };
