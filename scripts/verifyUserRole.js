require('dotenv').config();
const { CognitoIdentityProviderClient, AdminGetUserCommand, AdminUpdateUserAttributesCommand } = require('@aws-sdk/client-cognito-identity-provider');

const client = new CognitoIdentityProviderClient({ 
  region: process.env.COGNITO_REGION 
});

async function verifyAndUpdateUserRole(email, newRole = 'admin') {
  try {
    console.log(`\n🔍 Verificando usuario: ${email}`);
    
    // Obtener información del usuario
    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: email
    });
    
    const userData = await client.send(getUserCommand);
    console.log('✅ Usuario encontrado en Cognito');
    
    // Buscar el atributo custom:role
    const roleAttr = userData.UserAttributes.find(attr => attr.Name === 'custom:role');
    console.log(`📋 Rol actual: ${roleAttr ? roleAttr.Value : 'NO DEFINIDO'}`);
    
    if (!roleAttr || roleAttr.Value !== newRole) {
      console.log(`\n🔧 Actualizando rol a: ${newRole}`);
      
      const updateCommand = new AdminUpdateUserAttributesCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: email,
        UserAttributes: [
          {
            Name: 'custom:role',
            Value: newRole
          }
        ]
      });
      
      await client.send(updateCommand);
      console.log('✅ Rol actualizado exitosamente');
      console.log('\n⚠️  IMPORTANTE: El usuario debe hacer logout y login nuevamente para que los cambios tomen efecto');
    } else {
      console.log('✅ El rol ya está correcto');
      console.log('\n💡 Si sigues teniendo problemas de permisos:');
      console.log('   1. Haz logout de la aplicación');
      console.log('   2. Haz login nuevamente');
      console.log('   3. Esto generará un nuevo token con el rol actualizado');
    }
    
    // Mostrar todos los atributos del usuario
    console.log('\n📊 Atributos del usuario:');
    userData.UserAttributes.forEach(attr => {
      console.log(`   ${attr.Name}: ${attr.Value}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.name === 'UserNotFoundException') {
      console.log('\n💡 El usuario no existe en Cognito. Asegúrate de que el email sea correcto.');
    }
  }
}

// Uso: node scripts/verifyUserRole.js usuario@ejemplo.com [admin|user]
const email = process.argv[2];
const role = process.argv[3] || 'admin';

if (!email) {
  console.log('Uso: node scripts/verifyUserRole.js <email> [role]');
  console.log('Ejemplo: node scripts/verifyUserRole.js admin@scraperlab.com admin');
  process.exit(1);
}

verifyAndUpdateUserRole(email, role)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
