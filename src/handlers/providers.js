const ProviderService = require('../services/ProviderService');

exports.getAllProviders = async (req, res, next) => {
  try {
    const providers = await ProviderService.getAllProviders();
    res.json({
      success: true,
      data: providers,
      total: providers.length
    });
  } catch (error) {
    next(error);
  }
};

exports.getProvider = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const provider = await ProviderService.getProvider(providerId);
    res.json({
      success: true,
      data: provider
    });
  } catch (error) {
    next(error);
  }
};

exports.getProviderSchema = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const schema = await ProviderService.getProviderSchema(providerId);
    res.json({
      success: true,
      data: {
        providerId,
        schema
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getProviderFields = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const provider = await ProviderService.getProvider(providerId);
    const fields = await ProviderService.getProviderFields(providerId);
    
    res.json({
      success: true,
      data: {
        providerId,
        name: provider.name,
        fields
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.createProvider = async (req, res, next) => {
  try {
    const provider = await ProviderService.createProvider(req.body);
    res.status(201).json({
      success: true,
      data: provider,
      message: `Provider ${provider.providerId} creado exitosamente`
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProvider = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const provider = await ProviderService.updateProvider(providerId, req.body);
    res.json({
      success: true,
      data: provider,
      message: `Provider ${providerId} actualizado exitosamente`
    });
  } catch (error) {
    next(error);
  }
};