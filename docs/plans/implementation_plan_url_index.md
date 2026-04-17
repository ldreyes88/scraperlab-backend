# Debugging Product 71 and Sitemap-based URL Discovery

The user reports that product 71 (Xiaomi 15T Pro) in the `product-hunter` pipeline has no associated marketplaces. Additionally, they are looking for a more efficient way to consult product URLs, specifically considering sitemaps.

## User Review Required

> [!IMPORTANT]
> To debug product 71, I need to reproduce the pipeline execution. If the process is not in the logs, I will trigger a test run for this specific product.
> For the sitemap proposal, I have discovered that retailers like Exito and Falabella use nested sitemap indexes. I will implement a **periodic indexing service** that parses these product-level XMLs (`product-*.xml`, `pdp-*.xml`) and stores them in a searchable database.

## Proposed Changes

### 1. Debugging Product 71
I will create a script to manually trigger the `product-hunter` pipeline for product 71 and capture detailed logs of each node's output.

### 2. Sitemap-based URL Discovery
I will implement a new strategy for finding product URLs using XML sitemaps.

#### [NEW] [SitemapIndexer.js](file:///Users/ldreyes/Documents/Proyectos/github/scraperlab-backend/src/services/SitemapIndexer.js)
A background service to:
1. Discover product sitemaps from the main `sitemap.xml` index.
2. Efficiently parse large XML files (using streams).
3. Store `domainId`, `productNameSlug`, and `url` in a new DynamoDB table.

#### [NEW] [url-index-table.js](file:///Users/ldreyes/Documents/Proyectos/github/scraperlab-backend/src/config/url-index-table.js)
Definition for the new `ScraperLab-URL-Index` table.

#### [MODIFY] [PipelineService.js](file:///Users/ldreyes/Documents/Proyectos/github/scraperlab-backend/src/services/PipelineService.js)
Update `SCRAPE_SEARCH` to first check the `URL-Index` table before performing a costly site search.

## Open Questions

1. **For Product 71**: I will trigger a manual execution. Do you have the `productId` 71 already active in the Oferty database, or should I create a temporary test product?
2. **For Indexing**: Given the volume (Exito has >200 product sitemaps), I propose a **partial index** (only top domains). Is this acceptable, or do you want a full crawl?

## Verification Plan

### Automated Tests
- Run a test script for product 71 and verify which node fails.
- Unit test for `SitemapService` with a sample XML.

### Manual Verification
- Check the `product-hunter` execution in the dashboard.
- Verify that products found via sitemaps are correctly matched by the AI node.
