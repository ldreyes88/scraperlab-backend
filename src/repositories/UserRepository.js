const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand
} = require('@aws-sdk/lib-dynamodb');

class UserRepository {
  constructor() {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.USERS_TABLE_NAME || 'ScraperLab-Users';
  }

  /**
   * Obtener usuario por ID (Cognito sub)
   */
  async getUserById(userId) {
    const params = {
      TableName: this.tableName,
      Key: { userId }
    };

    const result = await this.docClient.send(new GetCommand(params));
    return result.Item;
  }

  /**
   * Obtener usuario por email (usando GSI)
   */
  async getUserByEmail(email) {
    const params = {
      TableName: this.tableName,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    };

    const result = await this.docClient.send(new QueryCommand(params));
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  }

  /**
   * Obtener usuario por API key (usando GSI)
   */
  async getUserByApiKey(apiKey) {
    const params = {
      TableName: this.tableName,
      IndexName: 'ApiKeyIndex',
      KeyConditionExpression: 'apiKey = :apiKey',
      ExpressionAttributeValues: {
        ':apiKey': apiKey
      }
    };

    const result = await this.docClient.send(new QueryCommand(params));
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  }

  /**
   * Crear nuevo usuario
   */
  async createUser(userData) {
    const now = new Date().toISOString();
    
    const user = {
      userId: userData.userId, // Cognito sub
      email: userData.email,
      role: userData.role || 'user',
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      createdAt: now,
      updatedAt: now,
      metadata: userData.metadata || {}
    };
    
    // Only add apiKey if it exists
    if (userData.apiKey) {
      user.apiKey = userData.apiKey;
    }

    const params = {
      TableName: this.tableName,
      Item: user,
      ConditionExpression: 'attribute_not_exists(userId)' // Evitar duplicados
    };

    await this.docClient.send(new PutCommand(params));
    return user;
  }

  /**
   * Actualizar usuario
   */
  async updateUser(userId, updates) {
    const now = new Date().toISOString();
    
    // Construir expresión de actualización dinámica
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {
      ':updatedAt': now
    };

    // Campos permitidos para actualizar
    const allowedFields = ['role', 'isActive', 'metadata', 'apiKey', 'apiKeyLastUsed'];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    }

    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';

    const params = {
      TableName: this.tableName,
      Key: { userId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    const result = await this.docClient.send(new UpdateCommand(params));
    return result.Attributes;
  }

  /**
   * Actualizar última vez usado el API key
   */
  async updateApiKeyLastUsed(apiKey) {
    // Primero buscar el usuario por API key
    const user = await this.getUserByApiKey(apiKey);
    if (!user) return null;

    const params = {
      TableName: this.tableName,
      Key: { userId: user.userId },
      UpdateExpression: 'SET apiKeyLastUsed = :lastUsed',
      ExpressionAttributeValues: {
        ':lastUsed': new Date().toISOString()
      }
    };

    await this.docClient.send(new UpdateCommand(params));
  }

  /**
   * Eliminar usuario (soft delete - marcar como inactivo)
   */
  async deleteUser(userId) {
    return await this.updateUser(userId, { isActive: false });
  }

  /**
   * Eliminar usuario permanentemente
   */
  async deleteUserPermanently(userId) {
    const params = {
      TableName: this.tableName,
      Key: { userId }
    };

    await this.docClient.send(new DeleteCommand(params));
  }

  /**
   * Listar todos los usuarios con paginación
   */
  async listUsers(options = {}) {
    const { limit = 50, lastEvaluatedKey, filterByRole, filterByStatus } = options;

    const params = {
      TableName: this.tableName,
      Limit: limit
    };

    // Agregar filtros si existen
    const filterExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    if (filterByRole) {
      filterExpressions.push('#role = :role');
      expressionAttributeNames['#role'] = 'role';
      expressionAttributeValues[':role'] = filterByRole;
    }

    if (filterByStatus !== undefined) {
      filterExpressions.push('isActive = :isActive');
      expressionAttributeValues[':isActive'] = filterByStatus;
    }

    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(' AND ');
      params.ExpressionAttributeNames = expressionAttributeNames;
      params.ExpressionAttributeValues = expressionAttributeValues;
    }

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await this.docClient.send(new ScanCommand(params));
    
    return {
      users: result.Items || [],
      lastEvaluatedKey: result.LastEvaluatedKey,
      count: result.Count
    };
  }

  /**
   * Contar usuarios por rol
   */
  async countUsersByRole() {
    const params = {
      TableName: this.tableName,
      ProjectionExpression: '#role',
      ExpressionAttributeNames: {
        '#role': 'role'
      }
    };

    const result = await this.docClient.send(new ScanCommand(params));
    
    const counts = {
      admin: 0,
      user: 0,
      api_user: 0,
      total: result.Items?.length || 0
    };

    result.Items?.forEach(item => {
      if (counts[item.role] !== undefined) {
        counts[item.role]++;
      }
    });

    return counts;
  }
}

module.exports = UserRepository;
