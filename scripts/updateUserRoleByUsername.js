require('dotenv').config();
const { CognitoIdentityProviderClient, AdminGetUserCommand, AdminUpdateUserAttributesCommand } = require('@aws-sdk/client-cognito-identity-provider');

const client = new CognitoIdentityProviderClient({ 
  region: process.env.COGNITO_REGION 
});

async function updateUserRole(username, newRole = 'admin') {
  try {
    console.log(`\n🔍 Actualizando usuario: ${username}`);
    
    // Obtener información del usuario
    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: username
    });
    
    const userData = await client.send(getUserCommand);
    console.log('✅ Usuario encontrado en Cognito');
    
    // Buscar atributos
    const email = userData.UserAttributes.find(attr => attr.Name === 'email')?.Value;
    const roleAttr = userData.UserAttributes.find(attr => attr.Name === 'custom:role');
    
    console.log(`   Email: ${email}`);
    console.log(`   Rol actual: ${roleAttr ? roleAttr.Value : 'NO DEFINIDO'}`);
    
    console.log(`\n🔧 Actualizando rol a: ${newRole}`);
    
    const updateCommand = new AdminUpdateUserAttributesCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: username,
      UserAttributes: [
        {
          Name: 'custom:role',
          Value: newRole
        }
      ]
    });
    
    await client.send(updateCommand);
    console.log('✅ Rol actualizado exitosamente');
    console.log('\n⚠️  IMPORTANTE: El usuario debe:');
    console.log('   1. Hacer LOGOUT de la aplicación');
    console.log('   2. Hacer LOGIN nuevamente');
    console.log('   3. Esto generará un nuevo token JWT con el rol actualizado\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Uso: node scripts/updateUserRoleByUsername.js Google_116462479144849168711 admin
const username = process.argv[2];
const role = process.argv[3] || 'admin';

if (!username) {
  console.log('\nUso: node scripts/updateUserRoleByUsername.js <username> [role]');
  console.log('Ejemplo: node scripts/updateUserRoleByUsername.js Google_116462479144849168711 admin\n');
  console.log('Para ver los usernames disponibles, ejecuta: node scripts/listCognitoUsers.js\n');
  process.exit(1);
}

updateUserRole(username, role)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
