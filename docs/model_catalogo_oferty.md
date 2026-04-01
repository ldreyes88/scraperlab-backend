# Modelado de Catálogo en Oferty (Single-Table Design)

Este documento detalla la estructura técnica de familias y productos en la base de datos DynamoDB de Oferty, basada en el análisis de la implementación manual (`products-admin.js`, `families-admin.js`) y los datos reales en producción.

---

## 1. Proceso de Creación Manual (Admin Panel)

### 🧩 Familias (`SK: SPECS#GENERIC`)
Las familias agrupan variantes de un mismo modelo de producto y contienen las especificaciones comunes.
- **PK**: `FAMILY#<slug-del-nombre-de-familia>` 
- **SK**: `SPECS#GENERIC`
- **ID**: El `familyId` se genera normalizando el nombre a minúsculas y sustituyendo caracteres especiales por guiones.
- **Campos Clave**:
  - `genericSpecs`: Objeto con especificaciones técnicas compartidas.
  - `variantFields`: Array de strings que definen qué campos diferencian a los productos (ej: `["Color", "Capacidad"]`).
  - `GSI3PK`: `ALL#FAMILIES`
  - `GSI3SK`: `BRAND#<Marca>#FAMILY#<ID>`

### 📦 Productos (`SK: METADATA`)
Cada variante individual de un producto.
- **PK**: `PRODUCT#<ID>`
- **SK**: `METADATA`
- **ID**: `id` numérico secuencial obtenido de un ítem `COUNTER` en DynamoDB.
- **Relación**: Almacena el `productFamilyId` para vincularse con su familia.
- **Campos Clave**:
  - `specs`: Especificaciones técnicas completas.
  - `variantSpecs`: Especificaciones que lo hacen único dentro de su familia.
  - `GSI1`: Indexado por categoría y marca.
  - `GSI2`: Indexado por familia (Permite listar todas las variantes de una familia).
  - `GSI3SK`: `PRODUCT#<ID-rellenado-con-ceros>` (ej: `PRODUCT#0000000060`).

---

## 2. Ejemplo de Datos Reales (DDB Sample)

A continuación se muestra un ejemplo real extraído de la tabla `Oferty-Products` para un producto existente:

```json
{
  "PK": "PRODUCT#60",
  "SK": "METADATA",
  "id": "60",
  "name": "Camiseta Tiro 24 Kids",
  "category": "Caballero",
  "parentCategory": "Moda",
  "brand": "Adidas",
  "brandName": "Adidas",
  "model": "Camiseta Tiro 24 Kids",
  "modelName": "Camiseta Tiro 24 Kids",
  "productFamilyId": "camiseta-tiro-24-kids",
  "productFamilyName": "Camiseta Tiro 24 Kids",
  "description": "Camiseta personalizable\nAjuste clásico\nCuello redondo acanalado\n100% poliéster (reciclado)\nAEROREADY\nDobladillo trasero alargado...",
  "image": "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/90379e...7674_01_laydown.jpg",
  "globalRating": 0,
  "specs": {},
  "variantSpecs": {},
  "variantType": [],
  "updatableStatus": false,
  "createdAt": "2026-03-13T11:51:11-05:00",
  "updatedAt": "2026-03-16T14:38:50-05:00",
  "GSI1PK": "CATEGORY#Caballero",
  "GSI1SK": "BRAND#Adidas#PRODUCT#60",
  "GSI2PK": "FAMILY#camiseta-tiro-24-kids",
  "GSI2SK": "PRODUCT#60",
  "GSI3PK": "ALL#PRODUCTS",
  "GSI3SK": "PRODUCT#0000000060"
}
```

---

## 3. Reglas Críticas para la Ingesta AI

Para que los productos generados por la Inteligencia Artificial sean indistinguibles de los manuales, se deben seguir estas reglas:

1.  **Formato de IDs**:
    *   **Familias**: Deben usar slugs descriptivos (ej: `washtower-wk25vs6`).
    *   **Productos**: Aunque se inyecten con UUIDs temporales para agilidad, lo ideal es que el backend de Oferty asigne el ID numérico secuencial del `COUNTER` durante la ingesta.
2.  **Pulsación de Ceros (Padding)**: En `GSI3SK`, el ID del producto debe rellenarse con ceros a la izquierda hasta 10 dígitos (ej: `PRODUCT#0000000123`) para asegurar el orden correcto en el índice.
3.  **Estado Inicial**: Todos los registros deben entrar con `active: false` (Borrador AI).
4.  **Inyección de Tiempo**: Usar formato ISO con zona horaria de Colombia (`-05:00`) en `createdAt` y `updatedAt`.
