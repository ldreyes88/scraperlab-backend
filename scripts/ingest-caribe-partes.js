// scripts/ingest-caribe-partes.js
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const CaribePartesRepository = require('../src/repositories/CaribePartesRepository');

const CSV_PATH = process.env.CSV_PATH || '/Users/ldreyes/Downloads/bd-inventario-caribe-partes.csv';

function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

function parsePrice(raw) {
  if (!raw) return 0;
  // Formato ej: 100.000,00 -> 100000
  const clean = raw.replace(/\./g, '').replace(/,/g, '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num);
}

function parseStock(raw) {
  if (!raw) return 0;
  const num = parseInt(raw.trim(), 10);
  return isNaN(num) ? 0 : num;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(amount);
}

function enrichProductName(nombreOriginal) {
  let enriched = nombreOriginal;
  // Expansión de abreviaturas del sector
  enriched = enriched.replace(/\bF\.?A\.?\b/gi, 'FILTRO DE AIRE');
  enriched = enriched.replace(/\bF\.?C\.?\b/gi, 'FILTRO DE COMBUSTIBLE');
  enriched = enriched.replace(/\bF\.?A\/C\.?\b/gi, 'FILTRO DE AIRE ACONDICIONADO');
  enriched = enriched.replace(/\bA\/T\b|\bATM\b/gi, 'AUTOMATICA');
  return enriched;
}

async function runIngestion() {
  console.log(`[Ingestion] Leyendo archivo desde: ${CSV_PATH}`);
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`El archivo no existe en: ${CSV_PATH}`);
    process.exit(1);
  }

  const fileStream = fs.createReadStream(CSV_PATH);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineNumber = 0;
  const items = [];

  for await (const line of rl) {
    lineNumber++;
    if (lineNumber === 1) continue; // Saltar cabecera

    const parts = line.split(';');
    if (parts.length < 8) continue;

    const [rawCodigo, rawNombre, rawMarca, rawGrupo, rawAlmacen, rawBodega, rawConsig, rawPrecio] = parts;
    const codigo = (rawCodigo || '').trim();
    const nombreOriginal = (rawNombre || '').trim();
    if (!codigo && !nombreOriginal) continue;

    const marca = (rawMarca || 'GENERICA').trim().toUpperCase();
    const grupo = (rawGrupo || 'REPUESTOS').trim().toUpperCase();
    const almacen = parseStock(rawAlmacen);
    const bodega = parseStock(rawBodega);
    const consignacion = parseStock(rawConsig);
    const stockTotal = almacen + bodega + consignacion;
    const precio = parsePrice(rawPrecio);
    const nombreEnriquecido = enrichProductName(nombreOriginal);

    const codigoLimpio = codigo.replace(/[^a-zA-Z0-9]/g, '');
    const searchText = normalizeText(`${codigo} ${codigoLimpio} ${nombreOriginal} ${nombreEnriquecido} ${marca} ${grupo}`);

    const item = {
      PK: `PART#${codigoLimpio || 'AUTO'}#${lineNumber}`,
      SK: 'METADATA',
      lineNumber,
      codigo,
      codigoLimpio,
      nombreOriginal,
      nombreEnriquecido,
      marca,
      grupo,
      saldoAlmacen: almacen,
      saldoBodega: bodega,
      saldoConsignacion: consignacion,
      stockTotal,
      disponible: stockTotal > 0,
      precio,
      precioFormato: formatCurrency(precio),
      searchText,
      GSI1PK: `GRUPO#${grupo}`,
      GSI1SK: `MARCA#${marca}#PART#${codigoLimpio}#${lineNumber}`,
      updatedAt: new Date().toISOString()
    };

    items.push(item);
  }

  console.log(`[Ingestion] Parseados ${items.length} productos listos para insertar.`);
  console.log(`[Ingestion] Guardando en DynamoDB en lotes de 25...`);

  const BATCH_LOG = 100;
  for (let i = 0; i < items.length; i += BATCH_LOG) {
    const chunk = items.slice(i, i + BATCH_LOG);
    await CaribePartesRepository.batchWrite(chunk);
    process.stdout.write(`\rCargados: ${Math.min(i + BATCH_LOG, items.length)} / ${items.length} productos`);
  }

  console.log(`\n[Ingestion] ¡Carga completada con éxito en ScraperLab-Products-CaribePartes!`);
}

runIngestion().catch(err => {
  console.error('[Ingestion] Error durante la carga:', err);
  process.exit(1);
});
