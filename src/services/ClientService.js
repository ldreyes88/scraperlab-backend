const ClientRepository = require('../repositories/ClientRepository');

class ClientService {
  /**
   * Obtener todos los clientes
   */
  async getAllClients() {
    try {
      const clients = await ClientRepository.getAllClients();
      return {
        success: true,
        clients,
        count: clients.length
      };
    } catch (error) {
      console.error('Error al obtener clientes:', error);
      throw new Error('Error al obtener clientes');
    }
  }

  /**
   * Obtener un cliente por ID
   */
  async getClientById(clientId) {
    try {
      const client = await ClientRepository.getClientById(clientId);
      
      if (!client) {
        throw new Error('Cliente no encontrado');
      }

      return {
        success: true,
        client
      };
    } catch (error) {
      console.error(`Error al obtener cliente ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Crear un nuevo cliente
   */
  async createClient(clientData) {
    try {
      // Validar datos requeridos
      if (!clientData.clientId) {
        throw new Error('Campo requerido: clientId');
      }
      if (!clientData.clientName) {
        throw new Error('Campo requerido: clientName');
      }
      if (!clientData.clientType) {
        throw new Error('Campo requerido: clientType');
      }

      // Validar que el clientId no exista
      const existingClient = await ClientRepository.getClientById(clientData.clientId);
      if (existingClient) {
        throw new Error('El clientId ya existe');
      }

      // Valores por defecto
      const client = {
        clientId: clientData.clientId,
        clientName: clientData.clientName,
        clientType: clientData.clientType,
        allowedUsers: clientData.allowedUsers || [],
        dataSource: clientData.dataSource || {},
        outputConfig: clientData.outputConfig || {},
        scheduleConfig: clientData.scheduleConfig || { enabled: false },
        isActive: clientData.isActive !== undefined ? clientData.isActive : true,
        metadata: clientData.metadata || {}
      };

      const newClient = await ClientRepository.createClient(client);

      return {
        success: true,
        client: newClient,
        message: 'Cliente creado exitosamente'
      };
    } catch (error) {
      console.error('Error al crear cliente:', error);
      throw error;
    }
  }

  /**
   * Actualizar un cliente
   */
  async updateClient(clientId, updates) {
    try {
      // Validar que el cliente existe
      const existingClient = await ClientRepository.getClientById(clientId);
      if (!existingClient) {
        throw new Error('Cliente no encontrado');
      }

      // No permitir cambiar el clientId
      delete updates.clientId;
      delete updates.createdAt;

      const updatedClient = await ClientRepository.updateClient(clientId, updates);

      return {
        success: true,
        client: updatedClient,
        message: 'Cliente actualizado exitosamente'
      };
    } catch (error) {
      console.error(`Error al actualizar cliente ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Eliminar un cliente
   */
  async deleteClient(clientId) {
    try {
      // Validar que el cliente existe
      const existingClient = await ClientRepository.getClientById(clientId);
      if (!existingClient) {
        throw new Error('Cliente no encontrado');
      }

      await ClientRepository.deleteClient(clientId);

      return {
        success: true,
        message: 'Cliente eliminado exitosamente'
      };
    } catch (error) {
      console.error(`Error al eliminar cliente ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Agregar usuario a cliente
   */
  async addUserToClient(clientId, userEmail) {
    try {
      if (!userEmail) {
        throw new Error('Campo requerido: userEmail');
      }

      // Validar que el cliente existe
      const existingClient = await ClientRepository.getClientById(clientId);
      if (!existingClient) {
        throw new Error('Cliente no encontrado');
      }

      // Verificar si el usuario ya está asignado
      if (existingClient.allowedUsers && existingClient.allowedUsers.includes(userEmail)) {
        throw new Error('El usuario ya está asignado a este cliente');
      }

      const updatedClient = await ClientRepository.addUserToClient(clientId, userEmail);

      return {
        success: true,
        client: updatedClient,
        message: 'Usuario agregado exitosamente al cliente'
      };
    } catch (error) {
      console.error(`Error al agregar usuario ${userEmail} al cliente ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Remover usuario de cliente
   */
  async removeUserFromClient(clientId, userEmail) {
    try {
      if (!userEmail) {
        throw new Error('Campo requerido: userEmail');
      }

      // Validar que el cliente existe
      const existingClient = await ClientRepository.getClientById(clientId);
      if (!existingClient) {
        throw new Error('Cliente no encontrado');
      }

      const updatedClient = await ClientRepository.removeUserFromClient(clientId, userEmail);

      return {
        success: true,
        client: updatedClient,
        message: 'Usuario removido exitosamente del cliente'
      };
    } catch (error) {
      console.error(`Error al remover usuario ${userEmail} del cliente ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Obtener clientes por usuario
   */
  async getClientsByUser(userEmail) {
    try {
      if (!userEmail) {
        throw new Error('Campo requerido: userEmail');
      }

      const clients = await ClientRepository.getClientsByUser(userEmail);

      return {
        success: true,
        clients,
        count: clients.length
      };
    } catch (error) {
      console.error(`Error al obtener clientes del usuario ${userEmail}:`, error);
      throw error;
    }
  }

  /**
   * Toggle estado activo de un cliente
   */
  async toggleClientStatus(clientId, isActive) {
    try {
      // Validar que el cliente existe
      const existingClient = await ClientRepository.getClientById(clientId);
      if (!existingClient) {
        throw new Error('Cliente no encontrado');
      }

      const updatedClient = await ClientRepository.toggleClientStatus(clientId, isActive);

      return {
        success: true,
        client: updatedClient,
        message: `Cliente ${isActive ? 'activado' : 'desactivado'} exitosamente`
      };
    } catch (error) {
      console.error(`Error al cambiar estado del cliente ${clientId}:`, error);
      throw error;
    }
  }
}

module.exports = new ClientService();
