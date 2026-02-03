// scripts/syncUserRoleInDB.js
// Script para sincronizar el rol en DynamoDB con el de Cognito
require('dotenv').config();
const UserRepository = require('../src/repositories/UserRepository');

const userId = '14489448-50e1-70d4-56ed-86cd34df5ecd'; // El User Sub de Cognito
const email = 'ldreyes88@gmail.com';
const role = 'admin';

async function syncRoleInDB() {
  const userRepo = new UserRepository();

  try {
    console.log('🚀 Sincronizando rol en DynamoDB\n');
    console.log(`👤 User ID: ${userId}`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Rol: ${role}\n`);

    // Verificar si el usuario existe en DynamoDB
    console.log('🔍 Verificando usuario en DynamoDB...');
    
    let user;
    try {
      user = await userRepo.getUserById(userId);
      console.log(`✅ Usuario encontrado en DynamoDB!`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Rol actual: ${user.role}`);
      console.log(`   Estado: ${user.isActive ? 'Activo' : 'Inactivo'}`);
      
      if (user.role === role) {
        console.log(`\n✓ El usuario ya tiene el rol '${role}' en DynamoDB`);
        console.log(`  No es necesario actualizar.`);
        return;
      }
    } catch (error) {
      if (error.message.includes('no encontrado')) {
        console.log(`⚠️  Usuario no encontrado en DynamoDB, creándolo...`);
        
        // Crear usuario en DynamoDB
        user = await userRepo.createUser({
          userId: userId,
          email: email,
          role: role,
          isActive: true,
          metadata: {
            createdBy: 'sync-script',
            source: 'cognito-oauth'
          }
        });
        
        console.log(`✅ Usuario creado en DynamoDB!`);
        console.log(`   Rol: ${user.role}`);
        return;
      }
      throw error;
    }

    // Actualizar rol en DynamoDB
    console.log(`\n🔄 Actualizando rol en DynamoDB...`);
    const updatedUser = await userRepo.updateUser(userId, {
      role: role
    });
    
    console.log(`✅ Rol actualizado en DynamoDB!`);
    console.log(`   Rol anterior: ${user.role}`);
    console.log(`   Rol nuevo: ${updatedUser.role}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ SINCRONIZACIÓN COMPLETADA!');
    console.log('='.repeat(60));
    console.log('\n📊 Estado final:');
    console.log(`   ✓ Cognito: custom:role = ${role}`);
    console.log(`   ✓ DynamoDB: role = ${role}`);
    console.log('\n✅ El usuario ahora es admin en ambos sistemas!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

// Ejecutar
syncRoleInDB()
  .then(() => {
    console.log('\n✅ Script completado!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Script fallido');
    process.exit(1);
  });
