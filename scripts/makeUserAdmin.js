// scripts/makeUserAdmin.js
require('dotenv').config();
const UserRepository = require('../src/repositories/UserRepository');
const CognitoService = require('../src/services/CognitoService');

const userRepo = new UserRepository();
const cognitoService = new CognitoService();

async function makeUserAdmin(email) {
  try {
    console.log(`🔍 Buscando usuario ${email}...`);
    const user = await userRepo.getUserByEmail(email);
    
    if (!user) {
      console.error('❌ Usuario no encontrado en DynamoDB');
      return;
    }
    
    console.log(`👤 Usuario encontrado: ${user.userId}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`🔑 Rol actual: ${user.role}`);
    
    // Actualizar en DynamoDB
    console.log(`\n🔄 Actualizando rol a 'admin' en DynamoDB...`);
    const updatedUser = await userRepo.updateUser(user.userId, {
      role: 'admin'
    });
    
    console.log(`✅ Usuario actualizado en DynamoDB!`);
    console.log(`🔑 Nuevo rol: ${updatedUser.role}`);
    
    // Actualizar en Cognito
    console.log(`\n🔄 Actualizando custom:role en Cognito...`);
    try {
      const cognitoResult = await cognitoService.updateUserAttributes(user.email, {
        'custom:role': 'admin'
      });
      
      if (cognitoResult.success) {
        console.log(`✅ Atributos actualizados en Cognito!`);
        
        // Invalidar sesiones para forzar re-login
        console.log(`\n🔄 Invalidando sesiones activas...`);
        await cognitoService.adminSignOutUser(user.email);
        console.log(`✅ Sesiones invalidadas! El usuario debe volver a iniciar sesión.`);
      } else {
        console.warn(`⚠️  No se pudo actualizar Cognito: ${cognitoResult.message}`);
      }
    } catch (cognitoError) {
      console.error(`⚠️  Error actualizando Cognito:`, cognitoError.message);
      console.log(`   El rol fue actualizado en DynamoDB, pero no en Cognito.`);
      console.log(`   El usuario puede tener problemas de permisos hasta que se actualice manualmente.`);
    }
    
    console.log(`\n✅ Proceso completado!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar
makeUserAdmin('ldreyes88@gmail.com')
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });