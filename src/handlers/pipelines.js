// src/handlers/pipelines.js
const PipelineRepository = require('../repositories/PipelineRepository');
const PipelineService = require('../services/PipelineService');

exports.getAllPipelines = async (req, res, next) => {
  try {
    const pipelines = await PipelineRepository.getAll();
    res.json({
      success: true,
      data: pipelines,
      total: pipelines.length
    });
  } catch (error) {
    next(error);
  }
};

exports.getPipeline = async (req, res, next) => {
  try {
    const { pipelineId } = req.params;
    const pipeline = await PipelineRepository.getById(pipelineId);
    if (!pipeline) {
      return res.status(404).json({
        success: false,
        message: 'Pipeline no encontrado'
      });
    }
    res.json({
      success: true,
      data: pipeline
    });
  } catch (error) {
    next(error);
  }
};

exports.createPipeline = async (req, res, next) => {
  try {
    const pipeline = await PipelineRepository.create(req.body);
    res.status(201).json({
      success: true,
      data: pipeline,
      message: `Pipeline ${pipeline.pipelineId} creado exitosamente`
    });
  } catch (error) {
    next(error);
  }
};

exports.updatePipeline = async (req, res, next) => {
  try {
    const { pipelineId } = req.params;
    const pipeline = await PipelineRepository.update(pipelineId, req.body);
    res.json({
      success: true,
      data: pipeline,
      message: `Pipeline ${pipelineId} actualizado exitosamente`
    });
  } catch (error) {
    next(error);
  }
};

exports.deletePipeline = async (req, res, next) => {
  try {
    const { pipelineId } = req.params;
    await PipelineRepository.delete(pipelineId);
    res.json({
      success: true,
      message: `Pipeline ${pipelineId} eliminado exitosamente`
    });
  } catch (error) {
    next(error);
  }
};

exports.runPipeline = async (req, res, next) => {
  try {
    const { pipelineId } = req.params;
    // req.body contiene los inputs iniciales del pipeline
    const result = await PipelineService.execute(pipelineId, req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
