import { z } from 'https://unpkg.com/zod@3.22.4/lib/index.mjs';

const ProductSchema = z.object({
  title: z.string(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().min(0).optional(),
  imageUrl: z.string().url(),
  price: z.number().optional(),
  url: z.string().url(),
  asin: z.string().min(1)
});

const ITEMS_PER_PAGE = 20;
let currentPage = 1;
let allProducts = [];

/**
 * @template T
 * @template E
 * @param {Promise<T>} promise
 * @returns {Promise<import('../../src/types/types').Result<T, E>>}
 */
async function tryCatch(promise) {
  try {
    const value = await promise;
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error };
  }
}

const searchBtn = document.getElementById('searchBtn');
const keywordInput = document.getElementById('keyword');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const resultsEl = document.getElementById('results');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfoEl = document.getElementById('pageInfo');
const paginationContainer = document.querySelector('.pagination-container');

function showSkeletonLoading() {
  const skeletonHTML = Array(20).fill(`
    <div class="product-card">
      <div class="skeleton skeleton-image"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
    </div>
  `).join('');
  resultsEl.innerHTML = skeletonHTML;
}

function updatePagination() {
  const totalPages = Math.ceil(allProducts.length / ITEMS_PER_PAGE);
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages;
  pageInfoEl.textContent = `Page ${currentPage} of ${totalPages}`;
  paginationContainer.classList.toggle('visible', totalPages > 1);
}

function displayProductsForPage(page) {
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageProducts = allProducts.slice(start, end);
  displayProducts(pageProducts);
  updatePagination();
}

prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    displayProductsForPage(currentPage);
  }
});

nextPageBtn.addEventListener('click', () => {
  const totalPages = Math.ceil(allProducts.length / ITEMS_PER_PAGE);
  if (currentPage < totalPages) {
    currentPage++;
    displayProductsForPage(currentPage);
  }
});

searchBtn.addEventListener('click', async () => {
  const keyword = keywordInput.value.trim();
  if (!keyword) {
    showError('Please enter a keyword');
    return;
  }

  showError('');
  showSkeletonLoading();
  currentPage = 1;

  const result = await tryCatch(
    fetch(`/api/scrape?keyword=${encodeURIComponent(keyword)}`)
      .then(res => res.json())
  );

  if (!result.ok) {
    showError('Failed to fetch products');
    resultsEl.innerHTML = '';
    return;
  }

  try {
    allProducts = z.array(ProductSchema).parse(result.value);
    displayProductsForPage(currentPage);
  } catch (error) {
    showError('Invalid data received from server');
    resultsEl.innerHTML = '';
  }
});

function displayProducts(products) {
  resultsEl.innerHTML = products.map(product => `
    <div class="product-card">
      <div class="product-image-container">
        <img src="${product.imageUrl}" alt="${product.title}" loading="lazy">
      </div>
      <div class="product-info">
        <h3 class="product-title">${product.title}</h3>
        <div class="rating-container">
          ${product.rating ? `
            <span class="star-rating">
              ${'★'.repeat(Math.floor(product.rating))}${product.rating % 1 >= 0.5 ? '½' : ''}${'☆'.repeat(5 - Math.ceil(product.rating))}
            </span>
            <span>${product.rating.toFixed(1)}</span>
          ` : ''}
          ${product.reviewCount ? `
            <span>(${product.reviewCount.toLocaleString()})</span>
          ` : ''}
        </div>
        ${product.price ? `
          <div class="price">R$ ${product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        ` : ''}
      </div>
      <a href="${product.url}" target="_blank" rel="noopener" class="product-link" aria-label="View on Amazon"></a>
    </div>
  `).join('');
}

document.querySelector('.search-container').addEventListener('submit', (e) => {
  e.preventDefault();
  searchBtn.click();
});

keywordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    searchBtn.click();
  }
});

function showLoading(show) {
  loadingEl.classList.toggle('hidden', !show);
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.toggle('hidden', !message);
}
