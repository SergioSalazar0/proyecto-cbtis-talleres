// Script temporal para generar hash de contraseña para admin
import bcrypt from 'bcryptjs';

const password = 'Password123';
const saltRounds = 10;

try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('🔐 Hash para Password123:');
    console.log(hash);
    console.log('\n📝 Ejecuta este UPDATE en pgAdmin:');
    console.log(`UPDATE usuarios SET password_hash = '${hash}' WHERE email = 'admin@cbtis258.edu.mx';`);
    console.log('\n✅ Después podrás hacer login con:');
    console.log('Email: admin@cbtis258.edu.mx');
    console.log('Password: Password123');
} catch (error) {
    console.error('❌ Error:', error);
}