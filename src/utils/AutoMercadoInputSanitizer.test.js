/**
 * Tests para AutoMercadoInputSanitizer
 * Ejecutar con: node AutoMercadoInputSanitizer.test.js
 */

const AutoMercadoInputSanitizer = require('./AutoMercadoInputSanitizer');

// Helper para tests
function test(description, fn) {
  try {
    fn();
    console.log(`✓ ${description}`);
  } catch (error) {
    console.error(`✗ ${description}`);
    console.error(`  ${error.message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`
    );
  }
}

console.log('\n🧪 Tests para AutoMercadoInputSanitizer\n');

// Test 1: Salchicha
test('Debe parsear línea de salchicha correctamente', () => {
  const input = "SALCHICHA SUST BEY 400 g  10.950,00 G";
  const result = AutoMercadoInputSanitizer.sanitize(input);
  
  assertEquals(result.searchTerm, "SALCHICHA SUST BEY", "searchTerm incorrecto");
  assertEquals(result.weight, "400 g", "weight incorrecto");
  assertEquals(result.weightValue, 400, "weightValue incorrecto");
  assertEquals(result.unit, "g", "unit incorrecto");
  assertEquals(result.price, 10950, "price incorrecto");
});

// Test 2: Gaseosa
test('Debe parsear línea de gaseosa correctamente', () => {
  const input = "GAS SAZUC C.COLA 2500 ml  1.560,00 G";
  const result = AutoMercadoInputSanitizer.sanitize(input);
  
  assertEquals(result.searchTerm, "GAS SAZUC C.COLA", "searchTerm incorrecto");
  assertEquals(result.weight, "2500 ml", "weight incorrecto");
  assertEquals(result.weightValue, 2500, "weightValue incorrecto");
  assertEquals(result.unit, "ml", "unit incorrecto");
  assertEquals(result.price, 1560, "price incorrecto");
});

// Test 3: Lavador
test('Debe parsear línea de lavador correctamente', () => {
  const input = "LAV CRE LIM AXIO 600 g  1.135,00 G";
  const result = AutoMercadoInputSanitizer.sanitize(input);
  
  assertEquals(result.searchTerm, "LAV CRE LIM AXIO", "searchTerm incorrecto");
  assertEquals(result.weight, "600 g", "weight incorrecto");
  assertEquals(result.price, 1135, "price incorrecto");
});

// Test 4: Energizante
test('Debe parsear línea de energizante correctamente', () => {
  const input = "ENER MONSTRUM 473 ml  1.595,00 G";
  const result = AutoMercadoInputSanitizer.sanitize(input);
  
  assertEquals(result.searchTerm, "ENER MONSTRUM", "searchTerm incorrecto");
  assertEquals(result.weight, "473 ml", "weight incorrecto");
  assertEquals(result.unit, "ml", "unit incorrecto");
  assertEquals(result.price, 1595, "price incorrecto");
});

// Test 5: Mantequilla
test('Debe parsear línea de mantequilla correctamente', () => {
  const input = "MANTEQ BARRA DP 115 g  1.845,00 G";
  const result = AutoMercadoInputSanitizer.sanitize(input);
  
  assertEquals(result.searchTerm, "MANTEQ BARRA DP", "searchTerm incorrecto");
  assertEquals(result.weight, "115 g", "weight incorrecto");
  assertEquals(result.price, 1845, "price incorrecto");
});

// Test 6: Agua
test('Debe parsear línea de agua correctamente', () => {
  const input = "AGUA NAT CRISTAL 1000 ml  995,00 G";
  const result = AutoMercadoInputSanitizer.sanitize(input);
  
  assertEquals(result.searchTerm, "AGUA NAT CRISTAL", "searchTerm incorrecto");
  assertEquals(result.weight, "1000 ml", "weight incorrecto");
  assertEquals(result.price, 995, "price incorrecto");
});

// Test 7: Precio sin decimales
test('Debe manejar precio sin decimales', () => {
  const input = "PRODUCTO TEST 100 g  5000 G";
  const result = AutoMercadoInputSanitizer.sanitize(input);
  
  assertEquals(result.price, 5000, "price sin decimales incorrecto");
});

// Test 8: Precio sin G final
test('Debe manejar precio sin G final', () => {
  const input = "PRODUCTO TEST 100 g  5.000,00";
  const result = AutoMercadoInputSanitizer.sanitize(input);
  
  assertEquals(result.price, 5000, "price sin G incorrecto");
});

// Test 9: Validación - input válido
test('Debe validar input correcto como válido', () => {
  const input = "SALCHICHA SUST BEY 400 g  10.950,00 G";
  const sanitized = AutoMercadoInputSanitizer.sanitize(input);
  const validation = AutoMercadoInputSanitizer.validate(sanitized);
  
  assertEquals(validation.valid, true, "Debería ser válido");
  assertEquals(validation.errors.length, 0, "No debería tener errores");
});

// Test 10: Validación - sin peso
test('Debe detectar input sin peso', () => {
  const input = "PRODUCTO TEST  5.000,00 G";
  const sanitized = AutoMercadoInputSanitizer.sanitize(input);
  const validation = AutoMercadoInputSanitizer.validate(sanitized);
  
  assertEquals(validation.valid, false, "Debería ser inválido");
  assertEquals(validation.errors.includes('No se detectó gramaje/volumen'), true, "Error no detectado");
});

// Test 11: Validación - sin precio
test('Debe detectar input sin precio', () => {
  const input = "PRODUCTO TEST 100 g";
  const sanitized = AutoMercadoInputSanitizer.sanitize(input);
  const validation = AutoMercadoInputSanitizer.validate(sanitized);
  
  assertEquals(validation.valid, false, "Debería ser inválido");
});

// Test 12: buildSearchUrl
test('Debe construir URL de búsqueda correcta', () => {
  const input = "SALCHICHA SUST BEY 400 g  10.950,00 G";
  const sanitized = AutoMercadoInputSanitizer.sanitize(input);
  const url = AutoMercadoInputSanitizer.buildSearchUrl(sanitized);
  
  const expectedUrl = 'https://automercado.cr/buscar?q=SALCHICHA+SUST+BEY&weight=400+g&price=10950';
  assertEquals(url, expectedUrl, "URL incorrecta");
});

// Test 13: Litros
test('Debe manejar litros correctamente', () => {
  const input = "TE LIMON + FUZE 5000 ml  230,00 G";
  const result = AutoMercadoInputSanitizer.sanitize(input);
  
  assertEquals(result.weight, "5000 ml", "weight con litros incorrecto");
  assertEquals(result.unit, "ml", "unit incorrecto");
});

// Test 14: Unidades
test('Debe manejar unidades correctamente', () => {
  const input = "TORTA BEYO 907 g  24.665,00 G";
  const result = AutoMercadoInputSanitizer.sanitize(input);
  
  assertEquals(result.searchTerm, "TORTA BEYO", "searchTerm incorrecto");
  assertEquals(result.weight, "907 g", "weight incorrecto");
  assertEquals(result.price, 24665, "price incorrecto");
});

// Test 15: Precios grandes
test('Debe manejar precios grandes correctamente', () => {
  const input = "PRODUCTO CARO 100 g  56.205,00 G";
  const result = AutoMercadoInputSanitizer.sanitize(input);
  
  assertEquals(result.price, 56205, "price grande incorrecto");
});

console.log('\n✅ Tests completados\n');
