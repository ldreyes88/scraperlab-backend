require('dotenv').config();
const express = require('express');
const cors = require('cors');

const errorHandler = require('./src/middleware/errorHandler');
const { verifyToken, requireRole, verifyAuth } = require('./src/middleware/auth');

// Importar handlers
const scraperHandler = require('./src/handlers/scraper');
const providersHandler = require('./src/handlers/providers');
const domainsHandler = require('./src/handlers/domains');
const processHandler = require('./src/handlers/process');
const authHandler = require('./src/handlers/auth');
const usersHandler = require('./src/handlers/users');
const clientsHandler = require('./src/handlers/clients');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'scraperlab-backend',
    stage: process.env.STAGE,
    timestamp: new Date().toISOString()
  });
});

// Routes

// 🔐 Auth endpoints (públicos)
app.post('/api/auth/signup', authHandler.signup);
app.post('/api/auth/login', authHandler.login);
app.post('/api/auth/refresh', authHandler.refresh);
app.post('/api/auth/forgot-password', authHandler.forgotPassword);
app.post('/api/auth/reset-password', authHandler.resetPassword);
app.get('/api/auth/oauth/url', authHandler.getOAuthUrl);
app.post('/api/auth/oauth/callback', authHandler.oauthCallback);

// 🔐 Auth endpoints (protegidos)
app.get('/api/auth/me', verifyAuth, authHandler.me);
app.post('/api/auth/logout', verifyToken, authHandler.logout);
app.post('/api/auth/change-password', verifyToken, authHandler.changePassword);

// 👥 Users endpoints (solo admin)
app.get('/api/users', verifyToken, requireRole(['admin']), usersHandler.getAllUsers);
app.get('/api/users/stats', verifyToken, requireRole(['admin']), usersHandler.getUserStats);
app.get('/api/users/:userId', verifyToken, requireRole(['admin']), usersHandler.getUser);
app.post('/api/users', verifyToken, requireRole(['admin']), usersHandler.createUser);
app.put('/api/users/:userId', verifyToken, requireRole(['admin']), usersHandler.updateUser);
app.delete('/api/users/:userId', verifyToken, requireRole(['admin']), usersHandler.deleteUser);
app.put('/api/users/:userId/role', verifyToken, requireRole(['admin']), usersHandler.changeUserRole);
app.post('/api/users/:userId/api-key', verifyToken, requireRole(['admin']), usersHandler.generateApiKey);
app.delete('/api/users/:userId/api-key', verifyToken, requireRole(['admin']), usersHandler.revokeApiKey);
app.put('/api/users/:userId/status', verifyToken, requireRole(['admin']), usersHandler.toggleUserStatus);

// 🏢 Clients endpoints (solo admin)
app.get('/api/clients', verifyToken, requireRole(['admin']), clientsHandler.getAllClients);
app.get('/api/clients/user/:userEmail', verifyToken, requireRole(['admin']), clientsHandler.getClientsByUser);
app.get('/api/clients/:clientId', verifyToken, requireRole(['admin']), clientsHandler.getClientById);
app.post('/api/clients', verifyToken, requireRole(['admin']), clientsHandler.createClient);
app.put('/api/clients/:clientId', verifyToken, requireRole(['admin']), clientsHandler.updateClient);
app.delete('/api/clients/:clientId', verifyToken, requireRole(['admin']), clientsHandler.deleteClient);
app.post('/api/clients/:clientId/users', verifyToken, requireRole(['admin']), clientsHandler.addUserToClient);
app.delete('/api/clients/:clientId/users/:userEmail', verifyToken, requireRole(['admin']), clientsHandler.removeUserFromClient);
app.put('/api/clients/:clientId/toggle', verifyToken, requireRole(['admin']), clientsHandler.toggleClientStatus);

// 🔧 Scraping endpoints (protegidos - permite JWT o API key)
app.post('/api/scrape', verifyAuth, scraperHandler.scrapeUrl);
app.post('/api/scrape/batch', verifyAuth, scraperHandler.scrapeBatch);
app.post('/api/scrape/batch/create', verifyAuth, scraperHandler.createBatch);
app.post('/api/scrape/test', verifyAuth, scraperHandler.testScrape);

// 🏭 Providers endpoints (solo admin)
app.get('/api/providers', verifyToken, requireRole(['admin']), providersHandler.getAllProviders);
app.get('/api/providers/:providerId', verifyToken, requireRole(['admin']), providersHandler.getProvider);
app.get('/api/providers/:providerId/schema', verifyToken, requireRole(['admin']), providersHandler.getProviderSchema);
app.get('/api/providers/:providerId/fields', verifyToken, requireRole(['admin']), providersHandler.getProviderFields);
app.post('/api/providers', verifyToken, requireRole(['admin']), providersHandler.createProvider);
app.put('/api/providers/:providerId', verifyToken, requireRole(['admin']), providersHandler.updateProvider);

// 🌐 Domains endpoints (solo admin)
app.get('/api/domains', verifyToken, requireRole(['admin']), domainsHandler.getAllConfigs);
app.get('/api/domains/:domainId', verifyToken, requireRole(['admin']), domainsHandler.getConfig);
app.post('/api/domains', verifyToken, requireRole(['admin']), domainsHandler.createConfig);
app.put('/api/domains/:domainId', verifyToken, requireRole(['admin']), domainsHandler.updateConfig);
app.delete('/api/domains/:domainId', verifyToken, requireRole(['admin']), domainsHandler.deleteConfig);
app.put('/api/domains/:domainId/provider', verifyToken, requireRole(['admin']), domainsHandler.switchProvider);
app.post('/api/domains/validate', verifyToken, requireRole(['admin']), domainsHandler.validateConfig);
app.put('/api/domains/:domainId/toggle', verifyToken, requireRole(['admin']), domainsHandler.toggleEnabled);

// 📊 Process endpoints (admin y usuarios pueden ver sus propios logs)
app.get('/api/process', verifyToken, requireRole(['admin', 'user']), processHandler.getLogs);
app.get('/api/process/:processId/details', verifyToken, requireRole(['admin', 'user']), processHandler.getBatchDetails);
app.get('/api/process/domain/:domainId', verifyToken, requireRole(['admin', 'user']), processHandler.getLogsByDomain);
app.get('/api/process/stats', verifyToken, requireRole(['admin']), processHandler.getStats);
app.get('/api/process/stats/domain/:domainId', verifyToken, requireRole(['admin']), processHandler.getDomainStats);
app.delete('/api/process/:logId', verifyToken, requireRole(['admin']), processHandler.deleteLog);

// Error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    path: req.path,
    method: req.method
  });
});

if (require.main === module) {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`🚀 Servidor local de ScraperLab corriendo en http://localhost:${port}`);
    });
  }

module.exports = app;