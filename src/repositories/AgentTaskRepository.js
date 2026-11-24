const fs = require('fs');
const path = require('path');
const { dynamoDB, TABLES } = require('../config/database');
const { GetCommand, PutCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { nowColombiaISO } = require('../utils/time');

const LOCAL_FALLBACK_FILE = path.join(__dirname, '../../data/agent_tasks.json');

// Helper para asegurar directorio data en local
function ensureLocalDir() {
  const dir = path.dirname(LOCAL_FALLBACK_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readLocalTasks() {
  ensureLocalDir();
  if (!fs.existsSync(LOCAL_FALLBACK_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(LOCAL_FALLBACK_FILE, 'utf-8');
    return JSON.parse(raw) || [];
  } catch (e) {
    return [];
  }
}

function writeLocalTasks(tasks) {
  ensureLocalDir();
  fs.writeFileSync(LOCAL_FALLBACK_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}

class AgentTaskRepository {
  static get tableName() {
    return TABLES.AGENT_TASKS || process.env.AGENT_TASKS_TABLE_NAME || 'ScraperLab-AgentTasks';
  }

  static async getAll() {
    try {
      const result = await dynamoDB.send(
        new ScanCommand({
          TableName: this.tableName
        })
      );
      return result.Items || [];
    } catch (error) {
      console.warn(`[AgentTaskRepository] DynamoDB no disponible (${error.message}). Usando almacenamiento local.`);
      return readLocalTasks();
    }
  }

  static async getById(taskId) {
    try {
      const result = await dynamoDB.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { taskId }
        })
      );
      if (result.Item) return result.Item;
    } catch (error) {
      console.warn(`[AgentTaskRepository] Fallback a local para getById: ${error.message}`);
    }
    const local = readLocalTasks();
    return local.find(t => t.taskId === taskId) || null;
  }

  static async create(taskData) {
    const now = nowColombiaISO ? nowColombiaISO() : new Date().toISOString();
    const task = {
      taskId: taskData.taskId || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: taskData.title,
      project: taskData.project || 'oferty', // 'oferty' | 'influenty' | 'scraperlabs'
      description: taskData.description || '',
      status: taskData.status || 'ideation', // 'ideation' | 'architecture' | 'coding' | 'testing' | 'ready_for_prod' | 'deployed'
      currentAgent: taskData.currentAgent || 'po_agent',
      priority: taskData.priority || 'medium', // 'low' | 'medium' | 'high'
      artifacts: taskData.artifacts || {
        spec: null,
        architecture: null,
        branch: null,
        tests: null,
        prUrl: null
      },
      approvals: taskData.approvals || {
        architectureApproved: false,
        deployApproved: false
      },
      history: taskData.history || [
        {
          timestamp: now,
          agent: 'po_agent',
          action: 'created',
          note: 'Tarea creada en el backlog'
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    try {
      await dynamoDB.send(
        new PutCommand({
          TableName: this.tableName,
          Item: task
        })
      );
    } catch (error) {
      console.warn(`[AgentTaskRepository] Fallback creando en local: ${error.message}`);
    }

    // Persistir siempre en copia local por seguridad en desarrollo 24/7
    const local = readLocalTasks();
    const existingIdx = local.findIndex(t => t.taskId === task.taskId);
    if (existingIdx >= 0) {
      local[existingIdx] = task;
    } else {
      local.unshift(task);
    }
    writeLocalTasks(local);

    return task;
  }

  static async update(taskId, updateData) {
    const existing = await this.getById(taskId);
    if (!existing) {
      throw new Error(`Tarea con ID ${taskId} no encontrada`);
    }

    const now = nowColombiaISO ? nowColombiaISO() : new Date().toISOString();
    const updated = {
      ...existing,
      ...updateData,
      taskId,
      updatedAt: now
    };

    if (updateData.actionNote) {
      updated.history = updated.history || [];
      updated.history.push({
        timestamp: now,
        agent: updateData.currentAgent || updated.currentAgent,
        action: updateData.actionNote,
        note: updateData.note || ''
      });
    }

    try {
      await dynamoDB.send(
        new PutCommand({
          TableName: this.tableName,
          Item: updated
        })
      );
    } catch (error) {
      console.warn(`[AgentTaskRepository] Fallback guardando en local update: ${error.message}`);
    }

    const local = readLocalTasks();
    const idx = local.findIndex(t => t.taskId === taskId);
    if (idx >= 0) {
      local[idx] = updated;
    } else {
      local.unshift(updated);
    }
    writeLocalTasks(local);

    return updated;
  }

  static async delete(taskId) {
    try {
      await dynamoDB.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { taskId }
        })
      );
    } catch (error) {
      console.warn(`[AgentTaskRepository] Fallback borrando en local: ${error.message}`);
    }

    const local = readLocalTasks().filter(t => t.taskId !== taskId);
    writeLocalTasks(local);
    return true;
  }
}

module.exports = AgentTaskRepository;
