const { dynamoDB, TABLES } = require('../config/database');
const { GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { nowColombiaISO } = require('../utils/time');

class ClientRepository {
  /**
   * Obtener todos los clientes
   */
  static async getAllClients() {
    try {
      const result = await dynamoDB.send(
        new ScanCommand({
          TableName: TABLES.CLIENTS
        })
      );
      return result.Items || [];
    } catch (error) {
      console.error('Error obteniendo clientes:', error);
      throw error;
    }
  }

  /**
   * Obtener un cliente por ID
   */
  static async getClientById(clientId) {
    try {
      const result = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.CLIENTS,
          Key: { clientId }
        })
      );
      return result.Item || null;
    } catch (error) {
      console.error('Error obteniendo cliente:', error);
      throw error;
    }
  }

  /**
   * Crear un nuevo cliente
   */
  static async createClient(clientData) {
    try {
      const now = nowColombiaISO();

      const client = {
        ...clientData,
        createdAt: now,
        updatedAt: now
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.CLIENTS,
          Item: client,
          ConditionExpression: 'attribute_not_exists(clientId)'
        })
      );

      return client;
    } catch (error) {
      console.error('Error creando cliente:', error);
      throw error;
    }
  }

  /**
   * Actualizar un cliente
   */
  static async updateClient(clientId, updates) {
    try {
      const now = nowColombiaISO();

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

      const result = await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.CLIENTS,
          Key: { clientId },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW'
        })
      );

      return result.Attributes;
    } catch (error) {
      console.error('Error actualizando cliente:', error);
      throw error;
    }
  }

  /**
   * Eliminar un cliente
   */
  static async deleteClient(clientId) {
    try {
      await dynamoDB.send(
        new DeleteCommand({
          TableName: TABLES.CLIENTS,
          Key: { clientId }
        })
      );
    } catch (error) {
      console.error('Error eliminando cliente:', error);
      throw error;
    }
  }

  /**
   * Agregar usuario a cliente
   */
  static async addUserToClient(clientId, userEmail) {
    try {
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

      const result = await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.CLIENTS,
          Key: { clientId },
          UpdateExpression: 'SET allowedUsers = :users, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':users': updatedUsers,
            ':updatedAt': nowColombiaISO()
          },
          ReturnValues: 'ALL_NEW'
        })
      );

      return result.Attributes;
    } catch (error) {
      console.error('Error agregando usuario a cliente:', error);
      throw error;
    }
  }

  /**
   * Remover usuario de cliente
   */
  static async removeUserFromClient(clientId, userEmail) {
    try {
      // Primero obtener el cliente actual
      const client = await this.getClientById(clientId);

      if (!client) {
        throw new Error('Cliente no encontrado');
      }

      // Crear el array actualizado de usuarios sin el email a remover
      const currentUsers = client.allowedUsers || [];
      const updatedUsers = currentUsers.filter(email => email !== userEmail);

      const result = await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.CLIENTS,
          Key: { clientId },
          UpdateExpression: 'SET allowedUsers = :users, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':users': updatedUsers,
            ':updatedAt': nowColombiaISO()
          },
          ReturnValues: 'ALL_NEW'
        })
      );

      return result.Attributes;
    } catch (error) {
      console.error('Error removiendo usuario de cliente:', error);
      throw error;
    }
  }

  /**
   * Obtener clientes por usuario
   */
  static async getClientsByUser(userEmail) {
    try {
      const result = await dynamoDB.send(
        new ScanCommand({
          TableName: TABLES.CLIENTS
        })
      );
      const clients = result.Items || [];

      // Filtrar clientes que contienen al usuario
      return clients.filter(client =>
        client.allowedUsers && client.allowedUsers.includes(userEmail)
      );
    } catch (error) {
      console.error('Error obteniendo clientes por usuario:', error);
      throw error;
    }
  }

  /**
   * Toggle estado activo de un cliente
   */
  static async toggleClientStatus(clientId, isActive) {
    try {
      const result = await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.CLIENTS,
          Key: { clientId },
          UpdateExpression: 'SET isActive = :isActive, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':isActive': isActive,
            ':updatedAt': nowColombiaISO()
          },
          ReturnValues: 'ALL_NEW'
        })
      );

      return result.Attributes;
    } catch (error) {
      console.error('Error cambiando estado del cliente:', error);
      throw error;
    }
  }
}

module.exports = ClientRepository;
