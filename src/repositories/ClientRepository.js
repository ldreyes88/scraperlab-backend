const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.CLIENTS_TABLE_NAME || 'ScraperLab-Clients';

class ClientRepository {
  /**
   * Obtener todos los clientes
   */
  async getAllClients() {
    const params = {
      TableName: TABLE_NAME
    };

    const result = await dynamoDB.scan(params).promise();
    return result.Items || [];
  }

  /**
   * Obtener un cliente por ID
   */
  async getClientById(clientId) {
    const params = {
      TableName: TABLE_NAME,
      Key: { clientId }
    };

    const result = await dynamoDB.get(params).promise();
    return result.Item;
  }

  /**
   * Crear un nuevo cliente
   */
  async createClient(clientData) {
    const now = new Date().toISOString();
    
    const client = {
      ...clientData,
      createdAt: now,
      updatedAt: now
    };

    const params = {
      TableName: TABLE_NAME,
      Item: client,
      ConditionExpression: 'attribute_not_exists(clientId)'
    };

    await dynamoDB.put(params).promise();
    return client;
  }

  /**
   * Actualizar un cliente
   */
  async updateClient(clientId, updates) {
    const now = new Date().toISOString();
    
    // Construir expresión de actualización dinámica
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    Object.keys(updates).forEach((key, index) => {
      const placeholder = `#attr${index}`;
      const valuePlaceholder = `:val${index}`;
      updateExpressions.push(`${placeholder} = ${valuePlaceholder}`);
      expressionAttributeNames[placeholder] = key;
      expressionAttributeValues[valuePlaceholder] = updates[key];
    });
    
    // Agregar updatedAt
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = now;

    const params = {
      TableName: TABLE_NAME,
      Key: { clientId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  /**
   * Eliminar un cliente
   */
  async deleteClient(clientId) {
    const params = {
      TableName: TABLE_NAME,
      Key: { clientId }
    };

    await dynamoDB.delete(params).promise();
  }

  /**
   * Agregar usuario a cliente
   */
  async addUserToClient(clientId, userEmail) {
    // Primero obtener el cliente actual
    const client = await this.getClientById(clientId);
    
    if (!client) {
      throw new Error('Cliente no encontrado');
    }

    // Crear el array actualizado de usuarios
    const currentUsers = client.allowedUsers || [];
    
    // Si el usuario ya existe, no agregarlo de nuevo
    if (currentUsers.includes(userEmail)) {
      return client;
    }

    const updatedUsers = [...currentUsers, userEmail];

    const params = {
      TableName: TABLE_NAME,
      Key: { clientId },
      UpdateExpression: 'SET allowedUsers = :users, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':users': updatedUsers,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  /**
   * Remover usuario de cliente
   */
  async removeUserFromClient(clientId, userEmail) {
    // Primero obtener el cliente actual
    const client = await this.getClientById(clientId);
    
    if (!client) {
      throw new Error('Cliente no encontrado');
    }

    // Crear el array actualizado de usuarios sin el email a remover
    const currentUsers = client.allowedUsers || [];
    const updatedUsers = currentUsers.filter(email => email !== userEmail);

    const params = {
      TableName: TABLE_NAME,
      Key: { clientId },
      UpdateExpression: 'SET allowedUsers = :users, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':users': updatedUsers,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  /**
   * Obtener clientes por usuario
   */
  async getClientsByUser(userEmail) {
    const params = {
      TableName: TABLE_NAME
    };

    const result = await dynamoDB.scan(params).promise();
    const clients = result.Items || [];
    
    // Filtrar clientes que contienen al usuario
    return clients.filter(client => 
      client.allowedUsers && client.allowedUsers.includes(userEmail)
    );
  }

  /**
   * Toggle estado activo de un cliente
   */
  async toggleClientStatus(clientId, isActive) {
    const params = {
      TableName: TABLE_NAME,
      Key: { clientId },
      UpdateExpression: 'SET isActive = :isActive, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isActive': isActive,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }
}

module.exports = new ClientRepository();
