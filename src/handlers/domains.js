const DomainConfigService = require('../services/DomainConfigService');
const ProviderService = require('../services/ProviderService');

exports.getAllConfigs = async (req, res, next) => {
  try {
    const configs = await DomainConfigService.getAllConfigs();
    res.json({
      success: true,
      data: configs,
      total: configs.length
    });
  } catch (error) {
    next(error);
  }
};

exports.getConfig = async (req, res, next) => {
  try {
    const { domainId } = req.params;
    const config = await DomainConfigService.getConfig(domainId);
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    next(error);
  }
};

exports.createConfig = async (req, res, next) => {
  try {
    const { domainId, providerId, providerConfig, selectors, supportedTypes, customRateLimit, enabled } = req.body;

    if (!domainId || !providerId) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: domainId, providerId'
      });
    }

    const config = await DomainConfigService.createOrUpdateConfig(domainId, {
      providerId,
      providerConfig,
      selectors,
      supportedTypes,
      customRateLimit,
      enabled
    });

    res.status(201).json({
      success: true,
      data: config,
      message: `Configuración para ${domainId} creada exitosamente`
    });
  } catch (error) {
    next(error);
  }
};

exports.updateConfig = async (req, res, next) => {
  try {
    const { domainId } = req.params;
    const config = await DomainConfigService.createOrUpdateConfig(domainId, req.body);
    
    res.json({
      success: true,
      data: config,
      message: `Configuración para ${domainId} actualizada exitosamente`
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteConfig = async (req, res, next) => {
  try {
    const { domainId } = req.params;
    await DomainConfigService.deleteConfig(domainId);
    
    res.json({
      success: true,
      message: `Configuración para ${domainId} eliminada exitosamente`
    });
  } catch (error) {
    next(error);
  }
};

exports.switchProvider = async (req, res, next) => {
  try {
    const { domainId } = req.params;
    const { newProviderId, providerConfig } = req.body;

    if (!newProviderId) {
      return res.status(400).json({
        success: false,
        error: 'Campo requerido: newProviderId'
      });
    }

    const config = await DomainConfigService.switchProvider(
      domainId,
      newProviderId,
      providerConfig || {}
    );

    res.json({
      success: true,
      data: config,
      message: `Provider cambiado a ${newProviderId} para ${domainId}`
    });
  } catch (error) {
    next(error);
  }
};

exports.validateConfig = async (req, res, next) => {
  try {
    const { providerId, providerConfig } = req.body;

    if (!providerId || !providerConfig) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: providerId, providerConfig'
      });
    }

    const validation = await ProviderService.validateConfig(providerId, providerConfig);

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    next(error);
  }
};

exports.toggleEnabled = async (req, res, next) => {
  try {
    const { domainId } = req.params;
    const { enabled } = req.body;

    if (enabled === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Campo requerido: enabled'
      });
    }

    const config = await DomainConfigService.toggleEnabled(domainId, enabled);

    res.json({
      success: true,
      data: config,
      message: `Scraping ${enabled ? 'habilitado' : 'deshabilitado'} para ${domainId}`
    });
  } catch (error) {
    next(error);
  }
};
