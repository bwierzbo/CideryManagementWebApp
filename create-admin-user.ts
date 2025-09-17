import 'dotenv/config'
import { db } from './packages/db/src/index'
import { users } from './packages/db/src/schema'
import bcrypt from 'bcryptjs'

async function createAdminUser() {
  const email = 'admin@cidery.com'
  const password = 'admin123'

  try {
    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create the admin user
    const result = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name: 'Admin User',
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          passwordHash,
          role: 'admin',
          isActive: true,
          updatedAt: new Date(),
        }
      })
      .returning()

    console.log('✅ Admin user created/updated successfully!')
    console.log('📧 Email:', email)
    console.log('🔑 Password:', password)
    console.log('👤 Role: admin')
    console.log('\nYou can now login at http://localhost:3000/auth/signin')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error creating admin user:', error)
    process.exit(1)
  }
}

createAdminUser()