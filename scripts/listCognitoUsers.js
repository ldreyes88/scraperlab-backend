require('dotenv').config();
const { CognitoIdentityProviderClient, ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider');

const client = new CognitoIdentityProviderClient({ 
  region: process.env.COGNITO_REGION 
});

async function listCognitoUsers() {
  try {
    console.log('\n📋 Usuarios en Cognito:\n');
    
    const command = new ListUsersCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Limit: 60
    });
    
    const response = await client.send(command);
    
    if (response.Users.length === 0) {
      console.log('❌ No hay usuarios en Cognito');
      return;
    }
    
    response.Users.forEach((user, index) => {
      console.log(`\n👤 Usuario ${index + 1}:`);
      console.log(`   Username: ${user.Username}`);
      console.log(`   Status: ${user.UserStatus}`);
      console.log(`   Enabled: ${user.Enabled}`);
      console.log(`   Created: ${user.UserCreateDate}`);
      
      const email = user.Attributes.find(attr => attr.Name === 'email')?.Value;
      const role = user.Attributes.find(attr => attr.Name === 'custom:role')?.Value;
      const name = user.Attributes.find(attr => attr.Name === 'name')?.Value;
      
      console.log(`   Email: ${email || 'N/A'}`);
      console.log(`   Rol: ${role || 'NO DEFINIDO'}`);
      console.log(`   Nombre: ${name || 'N/A'}`);
    });
    
    console.log(`\n✅ Total: ${response.Users.length} usuarios\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listCognitoUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
