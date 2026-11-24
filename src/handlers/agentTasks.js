const AgentTaskRepository = require('../repositories/AgentTaskRepository');

// Flujo de etapas
// ideation (PO) -> architecture (Arquitecto) -> [Aprobación Humana 1] -> coding (Dev TI) -> testing (QA) -> [Aprobación Humana 2] -> ready_for_prod -> deployed

const STAGES = ['ideation', 'architecture', 'coding', 'testing', 'ready_for_prod', 'deployed'];

exports.getAllTasks = async (req, res, next) => {
  try {
    const { project, status } = req.query;
    let tasks = await AgentTaskRepository.getAll();

    if (project) {
      tasks = tasks.filter(t => t.project === project);
    }
    if (status) {
      tasks = tasks.filter(t => t.status === status);
    }

    res.json({
      success: true,
      data: tasks,
      total: tasks.length
    });
  } catch (error) {
    next(error);
  }
};

exports.getTaskById = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const task = await AgentTaskRepository.getById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Tarea no encontrada'
      });
    }
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    next(error);
  }
};

exports.createTask = async (req, res, next) => {
  try {
    const { title, project, description, priority } = req.body;
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'El título de la tarea es obligatorio'
      });
    }

    const task = await AgentTaskRepository.create({
      title,
      project: project || 'oferty',
      description: description || '',
      priority: priority || 'medium',
      status: 'ideation',
      currentAgent: 'po_agent'
    });

    res.status(201).json({
      success: true,
      data: task,
      message: 'Tarea creada exitosamente en el backlog'
    });
  } catch (error) {
    next(error);
  }
};

exports.updateTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const task = await AgentTaskRepository.update(taskId, req.body);
    res.json({
      success: true,
      data: task,
      message: 'Tarea actualizada exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

exports.advanceTaskStage = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { approved, actionNote, artifactData } = req.body;
    const task = await AgentTaskRepository.getById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Tarea no encontrada'
      });
    }

    let nextStatus = task.status;
    let nextAgent = task.currentAgent;
    let approvals = { ...(task.approvals || {}) };
    let artifacts = { ...(task.artifacts || {}) };

    if (artifactData) {
      artifacts = { ...artifacts, ...artifactData };
    }

    // Transiciones controladas
    switch (task.status) {
      case 'ideation':
        // PO termina especificación -> Pasa a Arquitectura
        nextStatus = 'architecture';
        nextAgent = 'arch_agent';
        break;

      case 'architecture':
        // Si el usuario aprueba la arquitectura -> Pasa a Coding
        if (approved) {
          approvals.architectureApproved = true;
          nextStatus = 'coding';
          nextAgent = 'dev_agent';
        } else {
          return res.status(400).json({
            success: false,
            message: 'Se requiere aprobación de arquitectura para avanzar al desarrollo'
          });
        }
        break;

      case 'coding':
        // Dev termina código en worktree -> Pasa a QA
        nextStatus = 'testing';
        nextAgent = 'qa_agent';
        break;

      case 'testing':
        // QA pasa pruebas -> Pasa a listo para producción
        nextStatus = 'ready_for_prod';
        nextAgent = 'human_validator';
        break;

      case 'ready_for_prod':
        // Aprobación final humana para deploy
        if (approved) {
          approvals.deployApproved = true;
          nextStatus = 'deployed';
          nextAgent = 'release_agent';
        } else {
          return res.status(400).json({
            success: false,
            message: 'Se requiere aprobación final humana para desplegar a producción'
          });
        }
        break;

      default:
        break;
    }

    const updated = await AgentTaskRepository.update(taskId, {
      status: nextStatus,
      currentAgent: nextAgent,
      approvals,
      artifacts,
      actionNote: actionNote || `Avanzado a ${nextStatus}`,
      note: req.body.note || ''
    });

    res.json({
      success: true,
      data: updated,
      message: `Tarea avanzada a la etapa: ${nextStatus}`
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    await AgentTaskRepository.delete(taskId);
    res.json({
      success: true,
      message: 'Tarea eliminada exitosamente'
    });
  } catch (error) {
    next(error);
  }
};
