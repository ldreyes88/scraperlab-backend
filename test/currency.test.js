const test = require('node:test');
const assert = require('node:assert');
const { cleanPrice } = require('../src/utils/currency');

test('cleanPrice - Colombia formats', async (t) => {
  await t.test('handles standard Colombian format 2.185.500', () => {
    assert.strictEqual(cleanPrice('2.185.500', 'CO'), 2185500);
  });

  await t.test('handles ambiguous format with 2 digits at end (Falabella issue) 2.185.500.48', () => {
    // Current logic treats the last part as decimal if parts > 2 and lastPart.length === 2
    // 2.185.500.48 -> 2185500.48 -> rounded to 2185500
    assert.strictEqual(cleanPrice('2.185.500.48', 'CO'), 2185500);
  });

  await t.test('handles format with comma as decimal 2.185.500,48', () => {
    assert.strictEqual(cleanPrice('2.185.500,48', 'CO'), 2185500);
  });

  await t.test('handles simple decimal with point 1299.00', () => {
    assert.strictEqual(cleanPrice('1299.00', 'CO'), 1299);
  });
});

test('cleanPrice - US formats', async (t) => {
  await t.test('handles standard US format 1,299.99', () => {
    assert.strictEqual(cleanPrice('1,299.99', 'US'), 1300); // Rounded because multiplier is 1
  });
});
