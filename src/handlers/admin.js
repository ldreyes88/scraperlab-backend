// src/handlers/admin.js
const updateUserRole = async (req, res) => {
    try {
      // Verificar que quien hace la petición es admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'No tienes permisos para esta acción' 
        });
      }
  
      const { userId } = req.params;
      const { role } = req.body;
  
      const validRoles = ['user', 'admin', 'api_user'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ 
          error: 'ValidationError',
          message: `Rol inválido. Válidos: ${validRoles.join(', ')}` 
        });
      }
  
      const updatedUser = await userService.updateUserRole(userId, role);
  
      res.json({
        message: 'Rol actualizado exitosamente',
        user: updatedUser
      });
    } catch (error) {
      console.error('Error actualizando rol:', error);
      res.status(500).json({ 
        error: 'InternalServerError',
        message: 'Error actualizando rol' 
      });
    }
  };