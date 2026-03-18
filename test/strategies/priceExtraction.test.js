const test = require('node:test');
const assert = require('node:assert');
const cheerio = require('cheerio');
const BaseDomainStrategy = require('../../src/strategies/domain/BaseDomainStrategy');
const { cleanPrice } = require('../../src/utils/currency');

class MockStrategy extends BaseDomainStrategy {
  constructor() {
    super({ providerName: 'Mock' });
  }
}

test('BaseDomainStrategy - price extraction from attributes', async (t) => {
  const strategy = new MockStrategy();
  
  await t.test('prefers data-event-price over noisy text', () => {
    const html = `
      <li data-event-price="2.185.500" class="prices-0">
        <span class="primary">$ 2.185.500</span>
        <div class="discount">-48%</div>
      </li>
    `;
    const $ = cheerio.load(html);
    const selectors = {
      price: '.prices-0'
    };
    
    const result = strategy.applySelectors($, selectors);
    const cleaned = cleanPrice(result.currentPrice, 'CO');
    // Should extract 2185500, not 218550048
    assert.strictEqual(cleaned, 2185500);
  });

  await t.test('uses text if no attribute is present', () => {
    const html = `
      <div class="price">1.299.000</div>
    `;
    const $ = cheerio.load(html);
    const selectors = {
      price: '.price'
    };
    
    const result = strategy.applySelectors($, selectors);
    const cleaned = cleanPrice(result.currentPrice, 'CO');
    assert.strictEqual(cleaned, 1299000);
  });
});

test('BaseDomainStrategy - NextData path resolution', async (t) => {
  const strategy = new MockStrategy();
  
  await t.test('resolves absolute path if relative fails', () => {
    const nextData = {
      props: {
        pageProps: {
          productData: {
            name: 'Test Product',
            prices: [{ eventPrice: 5000 }]
          }
        }
      }
    };
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>`;
    const $ = cheerio.load(html);
    
    // Path that looks absolute
    const config = {
      pricePath: 'props.pageProps.productData.prices[0].eventPrice'
    };
    
    const result = strategy.extractNextData($, config);
    assert.strictEqual(result.currentPrice, 5000);
  });
});
