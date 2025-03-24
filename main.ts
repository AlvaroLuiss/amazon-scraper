import * as fs from 'fs/promises';
import * as path from 'path';
import { scrapeAmazon } from './src/services/scraper';
import { Product } from './src/types/types';
import logger from './src/utils/logger';

async function generateHTML(keyword: string, products: Product[]) {
  const styleContent = await fs.readFile(path.join(__dirname, 'styles', 'style.css'), 'utf-8');
  
  const productsHTML = products.map(product => `
    <a href="${product.url}" target="_blank" class="product-card">
      <div class="product-image-container">
        <img class="product-image" src="${product.imageUrl}" alt="${product.title}" loading="lazy">
      </div>
      <div class="product-info">
        <h3 class="product-title">${product.title}</h3>
        <div class="product-price">
          ${product.price ? `R$ ${product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Indisponível'}
        </div>
        <div class="product-rating">
          ${product.rating ? `${product.rating} ★` : ''} 
          ${product.reviewCount ? `${product.reviewCount.toLocaleString('pt-BR')} avaliações` : ''}
        </div>
      </div>
    </a>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${keyword} - Resultados da Busca</title>
      <style>${styleContent}</style>
    </head>
    <body>
      <div class="container">
        <header class="search-header">
          <h1 class="search-term">${keyword}</h1>
          <form class="search-form" id="search-form">
            <input type="search" 
                   class="search-input" 
                   placeholder="Buscar produtos..." 
                   value="${keyword}"
                   aria-label="Buscar produtos">
          </form>
          <p>${products.length} resultados encontrados</p>
        </header>
        <div class="products-grid">
          ${productsHTML}
        </div>
      </div>
      <script>
        document.getElementById('search-form').addEventListener('submit', (e) => {
          e.preventDefault();
          const input = e.target.querySelector('input');
          if (input.value.trim()) {
            window.location.href = '?q=' + encodeURIComponent(input.value.trim());
          }
        });
      </script>
    </body>
    </html>
  `;

  const outputPath = path.join(process.cwd(), 'results.html');
  await fs.writeFile(outputPath, html);
  return outputPath;
}

async function main() {
  const keyword = process.argv[2];
  if (!keyword) {
    console.error('Por favor, forneça uma palavra-chave para busca.');
    process.exit(1);
  }

  logger.info(`Iniciando scraping para a palavra-chave: ${keyword}`);
  const result = await scrapeAmazon(keyword);

  if (result.ok) {
    const outputPath = await generateHTML(keyword, result.value);
    console.log(`\nResultados salvos em: ${outputPath}`);
  } else {
    logger.error('Erro ao realizar scraping:', result.error);
  }
}

main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});