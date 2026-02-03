// scripts/setAdminRoleByEmail.js
// Script para asignar rol admin buscando usuario por email (funciona con OAuth también)
require('dotenv').config();
const { 
  CognitoIdentityProviderClient, 
  ListUsersCommand,
  AdminUpdateUserAttributesCommand,
  AdminGetUserCommand
} = require('@aws-sdk/client-cognito-identity-provider');

const email = 'ldreyes88@gmail.com'; // El email del usuario
const role = 'admin'; // El rol a asignar

async function setAdminRoleByEmail() {
  const client = new CognitoIdentityProviderClient({ 
    region: process.env.COGNITO_REGION || 'us-east-1'
  });

  try {
    console.log('🚀 Buscando usuario por email en Cognito\n');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Rol a asignar: ${role}\n`);

    // Buscar usuario por email
    console.log('🔍 Buscando usuario...');
    
    const listCommand = new ListUsersCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Filter: `email = "${email}"`
    });
    
    const listResponse = await client.send(listCommand);
    
    if (!listResponse.Users || listResponse.Users.length === 0) {
      console.error(`❌ No se encontró usuario con email: ${email}`);
      console.log(`\n💡 Verifica que el email sea correcto en la consola de Cognito`);
      process.exit(1);
    }
    
    const user = listResponse.Users[0];
    const username = user.Username;
    
    console.log(`✅ Usuario encontrado!`);
    console.log(`   Username: ${username}`);
    
    // Mostrar atributos actuales
    const emailAttr = user.Attributes.find(attr => attr.Name === 'email');
    const emailVerified = user.Attributes.find(attr => attr.Name === 'email_verified');
    const currentRole = user.Attributes.find(attr => attr.Name === 'custom:role');
    const sub = user.Attributes.find(attr => attr.Name === 'sub');
    
    console.log(`   Email: ${emailAttr?.Value}`);
    console.log(`   Email verificado: ${emailVerified?.Value}`);
    console.log(`   User Sub (ID): ${sub?.Value}`);
    console.log(`   Rol actual: ${currentRole?.Value || 'No definido'}`);
    console.log(`   Estado: ${user.UserStatus}`);
    
    // Actualizar el atributo custom:role
    console.log(`\n🔄 Asignando rol '${role}' en Cognito...`);
    
    const updateCommand = new AdminUpdateUserAttributesCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: username,
      UserAttributes: [
        {
          Name: 'custom:role',
          Value: role
        }
      ]
    });
    
    await client.send(updateCommand);
    
    console.log(`✅ Rol '${role}' asignado exitosamente en Cognito!`);
    
    // Verificar el cambio
    console.log(`\n🔍 Verificando cambio...`);
    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: username
    });
    
    const verifyUser = await client.send(getUserCommand);
    const newRole = verifyUser.UserAttributes.find(attr => attr.Name === 'custom:role');
    console.log(`✓ Rol verificado: ${newRole?.Value}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ PROCESO COMPLETADO EXITOSAMENTE!');
    console.log('='.repeat(60));
    console.log('\n⚠️  IMPORTANTE:');
    console.log('   1. El usuario debe cerrar sesión completamente');
    console.log('   2. Limpiar caché del navegador (o localStorage)');
    console.log('   3. Volver a iniciar sesión');
    console.log('   4. Ahora tendrá acceso al panel de administración\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.name === 'UserNotFoundException') {
      console.log(`\n💡 El usuario no se encontró en Cognito.`);
    } else if (error.name === 'InvalidParameterException') {
      console.log(`\n💡 Verifica que el atributo custom:role esté configurado en tu User Pool.`);
      console.log(`   AWS Console > Cognito > User Pools > Attributes`);
    } else if (error.name === 'NotAuthorizedException') {
      console.log(`\n💡 No tienes permisos para actualizar usuarios.`);
      console.log(`   Verifica tus credenciales AWS y permisos IAM.`);
    } else {
      console.log(`\n💡 Detalles del error:`, error);
    }
    
    throw error;
  }
}

// Ejecutar
setAdminRoleByEmail()
  .then(() => {
    console.log('✅ Script completado!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Script fallido');
    process.exit(1);
  });
