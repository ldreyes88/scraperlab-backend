// scripts/createAdminUser.js
// Script para crear un usuario admin directamente en Cognito y DynamoDB
require('dotenv').config();
const { 
  CognitoIdentityProviderClient, 
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const UserRepository = require('../src/repositories/UserRepository');

// ⚠️  CONFIGURA ESTOS VALORES
const CONFIG = {
  email: 'ldreyes88@gmail.com',
  name: 'Luis Reyes',
  temporaryPassword: 'TempPass123!',  // El usuario deberá cambiarla en el primer login
  role: 'admin'
};

async function createAdminUser() {
  const cognitoClient = new CognitoIdentityProviderClient({ 
    region: process.env.COGNITO_REGION || 'us-east-1'
  });
  const userRepo = new UserRepository();

  try {
    console.log('🚀 Creando usuario admin en Cognito y DynamoDB\n');
    console.log(`📧 Email: ${CONFIG.email}`);
    console.log(`👤 Nombre: ${CONFIG.name}`);
    console.log(`🔑 Rol: ${CONFIG.role}\n`);

    // 1. Crear usuario en Cognito
    console.log('🔄 Paso 1: Creando usuario en Cognito...');
    
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: CONFIG.email,
      UserAttributes: [
        { Name: 'email', Value: CONFIG.email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: CONFIG.name },
        { Name: 'custom:role', Value: CONFIG.role }
      ],
      TemporaryPassword: CONFIG.temporaryPassword,
      MessageAction: 'SUPPRESS', // No enviar email de bienvenida
      DesiredDeliveryMediums: []
    });
    
    const createResponse = await cognitoClient.send(createUserCommand);
    const userSub = createResponse.User.Attributes.find(attr => attr.Name === 'sub').Value;
    
    console.log(`✅ Usuario creado en Cognito!`);
    console.log(`   User Sub (ID): ${userSub}`);

    // 2. Establecer contraseña permanente (opcional)
    console.log('\n🔄 Paso 2: Estableciendo contraseña permanente...');
    
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: CONFIG.email,
      Password: CONFIG.temporaryPassword,
      Permanent: true // Hacer la contraseña permanente
    });
    
    await cognitoClient.send(setPasswordCommand);
    console.log(`✅ Contraseña establecida como permanente`);

    // 3. Crear usuario en DynamoDB
    console.log('\n🔄 Paso 3: Creando usuario en DynamoDB...');
    
    const dbUser = await userRepo.createUser({
      userId: userSub,
      email: CONFIG.email,
      role: CONFIG.role,
      isActive: true,
      metadata: {
        name: CONFIG.name,
        createdBy: 'admin-script',
        initialRole: CONFIG.role
      }
    });
    
    console.log(`✅ Usuario creado en DynamoDB!`);
    
    // 4. Resumen
    console.log('\n' + '='.repeat(60));
    console.log('✅ USUARIO ADMIN CREADO EXITOSAMENTE!');
    console.log('='.repeat(60));
    console.log('\n📋 Detalles del usuario:\n');
    console.log(`   Email:     ${CONFIG.email}`);
    console.log(`   Password:  ${CONFIG.temporaryPassword}`);
    console.log(`   Rol:       ${CONFIG.role}`);
    console.log(`   User ID:   ${userSub}`);
    console.log(`   Estado:    Activo`);
    
    console.log('\n⚠️  IMPORTANTE:');
    console.log('   1. Guarda la contraseña en un lugar seguro');
    console.log('   2. Cambia la contraseña después del primer login');
    console.log('   3. El usuario puede iniciar sesión inmediatamente');
    console.log('   4. Tiene acceso completo al panel de administración\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.name === 'UsernameExistsException') {
      console.log(`\n💡 El usuario ${CONFIG.email} ya existe en Cognito.`);
      console.log(`   Usa el script setAdminInCognito.js para asignar el rol admin.`);
      console.log(`   O usa un email diferente.`);
    } else if (error.message.includes('ya está registrado')) {
      console.log(`\n💡 El usuario ya existe en DynamoDB.`);
      console.log(`   El usuario fue creado en Cognito pero ya existía en la base de datos.`);
    } else if (error.name === 'InvalidPasswordException') {
      console.log(`\n💡 La contraseña no cumple con los requisitos del User Pool.`);
      console.log(`   Requisitos típicos: mínimo 8 caracteres, mayúsculas, minúsculas, números y símbolos.`);
    } else {
      console.log(`\n💡 Verifica:`);
      console.log(`   - Credenciales AWS correctas`);
      console.log(`   - Permisos IAM adecuados`);
      console.log(`   - Variables de entorno configuradas`);
      console.log(`   - El atributo custom:role existe en el User Pool`);
    }
    
    throw error;
  }
}

// Confirmar antes de ejecutar
console.log('⚠️  ATENCIÓN: Este script creará un nuevo usuario admin\n');
console.log(`Email: ${CONFIG.email}`);
console.log(`Password temporal: ${CONFIG.temporaryPassword}\n`);

createAdminUser()
  .then(() => {
    console.log('✅ Proceso completado!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Proceso fallido:', err.message);
    process.exit(1);
  });
