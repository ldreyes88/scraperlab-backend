require('dotenv').config();
const ProcessService = require('./src/services/ProcessService');

async function test() {
  const p1 = await ProcessService.getBatchDetails('2decbe14-63c9-48ab-bcb6-f4d60347234a', 1, 20);
  console.log('--- PAGE 1 (count: ' + p1.items.length + ') ---');
  p1.items.forEach((it, idx) => {
    console.log((idx + 1) + '. url: ' + (it.url || '').substring(0, 40) + ' | success: ' + it.success + ' | hasData: ' + Boolean(it.data) + ' | hasOutput: ' + Boolean(it.output));
  });

  const p2 = await ProcessService.getBatchDetails('2decbe14-63c9-48ab-bcb6-f4d60347234a', 2, 20);
  console.log('--- PAGE 2 (count: ' + p2.items.length + ') ---');
  p2.items.forEach((it, idx) => {
    console.log((idx + 21) + '. url: ' + (it.url || '').substring(0, 40) + ' | success: ' + it.success + ' | hasData: ' + Boolean(it.data) + ' | hasOutput: ' + Boolean(it.output));
    if (!it.data && !it.output) {
      console.log('   Keys:', Object.keys(it));
    }
  });

  const p3 = await ProcessService.getBatchDetails('2decbe14-63c9-48ab-bcb6-f4d60347234a', 3, 20);
  console.log('--- PAGE 3 (count: ' + p3.items.length + ') ---');
  p3.items.forEach((it, idx) => {
    console.log((idx + 41) + '. url: ' + (it.url || '').substring(0, 40) + ' | success: ' + it.success + ' | hasData: ' + Boolean(it.data) + ' | hasOutput: ' + Boolean(it.output));
  });
}

test().catch(console.error);
