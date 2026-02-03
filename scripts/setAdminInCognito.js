// scripts/setAdminInCognito.js
// Script para asignar rol admin directamente en Cognito
require('dotenv').config();
const { 
  CognitoIdentityProviderClient, 
  AdminUpdateUserAttributesCommand,
  AdminGetUserCommand
} = require('@aws-sdk/client-cognito-identity-provider');

const email = 'ldreyes88@gmail.com'; // Cambia este email si es necesario
const role = 'admin';

async function setAdminRole() {
  const client = new CognitoIdentityProviderClient({ 
    region: process.env.COGNITO_REGION || 'us-east-1'
  });

  try {
    console.log(`🔍 Buscando usuario en Cognito: ${email}...`);
    
    // Verificar que el usuario existe
    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: email
    });
    
    const userResponse = await client.send(getUserCommand);
    const username = userResponse.Username;
    
    console.log(`✅ Usuario encontrado: ${username}`);
    console.log(`📧 Email: ${userResponse.UserAttributes.find(attr => attr.Name === 'email')?.Value}`);
    
    // Mostrar atributos actuales
    const currentRole = userResponse.UserAttributes.find(attr => attr.Name === 'custom:role');
    console.log(`🔑 Rol actual: ${currentRole?.Value || 'No definido'}`);
    
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
    console.log(`\n⚠️  IMPORTANTE: El usuario debe cerrar sesión y volver a iniciar sesión`);
    console.log(`   para obtener un nuevo JWT con el rol actualizado.`);
    
    // Verificar el cambio
    console.log(`\n🔍 Verificando cambio...`);
    const verifyUser = await client.send(getUserCommand);
    const newRole = verifyUser.UserAttributes.find(attr => attr.Name === 'custom:role');
    console.log(`✓ Rol verificado: ${newRole?.Value}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.name === 'UserNotFoundException') {
      console.log(`\n💡 El usuario ${email} no existe en Cognito.`);
      console.log(`   Debe registrarse primero en la aplicación.`);
    } else if (error.name === 'InvalidParameterException') {
      console.log(`\n💡 Verifica que el atributo custom:role esté configurado en tu User Pool.`);
      console.log(`   Puedes verificarlo en: AWS Console > Cognito > User Pools > ${process.env.COGNITO_USER_POOL_ID} > Attributes`);
    } else {
      console.log(`\n💡 Verifica tus credenciales AWS y permisos IAM.`);
    }
    
    process.exit(1);
  }
}

// Ejecutar
console.log('🚀 Script: Asignar rol admin en Cognito\n');
console.log(`User Pool ID: ${process.env.COGNITO_USER_POOL_ID}`);
console.log(`Region: ${process.env.COGNITO_REGION || 'us-east-1'}`);
console.log(`Email: ${email}`);
console.log(`Rol a asignar: ${role}\n`);

setAdminRole()
  .then(() => {
    console.log('\n✅ Proceso completado exitosamente!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
