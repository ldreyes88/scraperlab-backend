const AWS = require('aws-sdk');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Configuración de DynamoDB
// Intentamos usar las variables de entorno locales primero
const dynamoDB = new AWS.DynamoDB({
    region: process.env.AWS_REGION || 'us-east-1'
});
const docClient = new AWS.DynamoDB.DocumentClient({ service: dynamoDB });

const TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || 'Oferty-Products';

const INFLATED_DOMAINS = [
    'mac-center.com',
    'co.tiendasishop.com',
    'ishop.com.co'
];

async function fixInflatedPrices() {
    console.log(`🚀 Iniciando ESCANEO para corregir precios inflados en ${TABLE_NAME}...`);
    
    try {
        // 1. Escanear todos los marketplaces de los dominios afectados
        console.log("📥 Buscando registros de Mac Center e iShop...");
        const scanParams = {
            TableName: TABLE_NAME,
            FilterExpression: "begins_with(SK, :mp) AND (contains(#url, :domain1) OR contains(#url, :domain2) OR contains(#url, :domain3))",
            ExpressionAttributeNames: {
                "#url": "url"
            },
            ExpressionAttributeValues: {
                ":mp": "MARKETPLACE#",
                ":domain1": "mac-center.com",
                ":domain2": "tiendasishop.com",
                ":domain3": "ishop.com.co"
            }
        };

        const scanRes = await docClient.scan(scanParams).promise();
        const items = scanRes.Items || [];
        
        console.log(`🔍 Se encontraron ${items.length} registros para analizar.`);

        let fixCount = 0;
        const affectedProducts = new Set();

        for (const item of items) {
            const currentPrice = parseFloat(item.currentPrice || 0);
            const originalPrice = parseFloat(item.originalPrice || 0);
            
            // Heurística: Si el precio es > 15,000,000 y termina en 0, es muy probable que sea el bug
            // (La mayoría de iPhones están entre 3M y 10M)
            if (currentPrice > 15000000) {
                const newCurrentPrice = Math.round(currentPrice / 10);
                const newOriginalPrice = originalPrice > 15000000 ? Math.round(originalPrice / 10) : originalPrice;
                
                console.log(`\n🛠️ Corrigiendo ${item.PK} (${item.name}):`);
                console.log(`   - Precio actual: ${currentPrice} -> ${newCurrentPrice}`);
                console.log(`   - URL: ${item.url}`);

                // Actualizar el registro del Marketplace
                await docClient.update({
                    TableName: TABLE_NAME,
                    Key: {
                        PK: item.PK,
                        SK: item.SK
                    },
                    UpdateExpression: "SET currentPrice = :cp, originalPrice = :op, updatedAt = :u",
                    ExpressionAttributeValues: {
                        ":cp": newCurrentPrice,
                        ":op": newOriginalPrice,
                        ":u": new Date().toISOString()
                    }
                }).promise();

                fixCount++;
                affectedProducts.add(item.PK);
            }
        }

        console.log(`\n✅ Se corrigieron ${fixCount} registros de Marketplace.`);

        // 2. Recalcular BEST_PRICE#CO para los productos afectados
        if (affectedProducts.size > 0) {
            console.log(`\n🔄 Recalculando Mejores Precios para ${affectedProducts.size} productos...`);
            for (const pk of affectedProducts) {
                await recalculateBestPriceForProduct(pk);
            }
        }

        console.log("\n✨ Proceso de corrección terminado.");

    } catch (error) {
        console.error('❌ Error fatal:', error.message);
        if (error.stack) console.error(error.stack);
    }
}

async function recalculateBestPriceForProduct(pk) {
    try {
        // Obtener todos los items del producto
        const res = await docClient.query({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: { ":pk": pk }
        }).promise();

        const group = res.Items || [];
        const metadata = group.find(i => i.SK === 'METADATA');
        const marketplaces = group.filter(i => i.SK.startsWith('MARKETPLACE#'));
        const bestPriceRecord = group.find(i => i.SK === 'BEST_PRICE#CO');

        if (marketplaces.length === 0) return;

        // Encontrar el mejor MP
        let bestMp = null;
        marketplaces.forEach(mp => {
            const price = parseFloat(mp.currentPrice || 0);
            if (price > 0) {
                if (!bestMp || price < parseFloat(bestMp.currentPrice || 0)) {
                    bestMp = mp;
                }
            }
        });

        if (bestMp) {
            const productId = pk.replace('PRODUCT#', '');
            const country = bestMp.country || 'CO';
            const price = parseFloat(bestMp.currentPrice || 0);
            const padPrice = (p) => p.toString().padStart(10, '0');
            const priceType = parseFloat(bestMp.currentPrice) < parseFloat(bestMp.originalPrice) ? 'promotion' : 'best_price';

            const bestPriceEntry = {
                PK: pk,
                SK: `BEST_PRICE#${country}`,
                country: country,
                marketplaceName: bestMp.name,
                currentPrice: price,
                originalPrice: parseFloat(bestMp.originalPrice || price),
                discount: parseInt(bestMp.discount || 0),
                url: bestMp.url,
                delivery: bestMp.delivery || 'Estándar',
                qualityPrice: bestMp.qualityPrice || 3.0,
                bestPriceType: priceType,
                updatedAt: new Date().toISOString(),
                GSI4PK: `COUNTRY#${country}`,
                GSI4SK: `TYPE#${priceType}#CATEGORY#${metadata?.category || 'sin-categoria'}#PRICE#${padPrice(price)}#PRODUCT#${productId}`
            };

            await docClient.put({
                TableName: TABLE_NAME,
                Item: bestPriceEntry
            }).promise();

            console.log(`   🏆 Best-Price actualizado para ${pk}: ${bestMp.name} ($${price})`);
        }
    } catch (e) {
        console.error(`   ⚠️ Error recalculando ${pk}:`, e.message);
    }
}

fixInflatedPrices();
