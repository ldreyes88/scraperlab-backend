function cleanPrice(val) {
  if (!val) return 0;
  return parseInt(val.toString().replace(/[^\d]/g, '')) || 0;
}

const v1 = "2999000.0";
const v2 = 2999000.0;
const v3 = "3499000.0";

console.log(`Input String "${v1}" -> ${cleanPrice(v1)}`);
console.log(`Input Number ${v2} -> ${cleanPrice(v2)}`);
console.log(`Input String "${v3}" -> ${cleanPrice(v3)}`);

function improvedCleanPrice(val) {
  if (!val) return 0;
  let cleanStr = val.toString().replace(/[^\d,.]/g, '').replace(',', '.');
  let num = parseFloat(cleanStr);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

console.log('--- Improved ---');
console.log(`Input String "${v1}" -> ${improvedCleanPrice(v1)}`);
console.log(`Input Number ${v2} -> ${improvedCleanPrice(v2)}`);
console.log(`Input String "${v3}" -> ${improvedCleanPrice(v3)}`);
