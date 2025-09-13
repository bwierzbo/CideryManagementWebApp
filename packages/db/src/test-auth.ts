import 'dotenv/config'
import { db } from './client'
import { users } from './schema'
import { eq } from 'drizzle-orm'

async function testAuth() {
  try {
    console.log('🔍 Testing authentication query...')
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set')
    
    // Test basic connection
    const result = await db.select().from(users).limit(1)
    console.log('✅ Database connection successful')
    
    // List all users
    const allUsers = await db.select().from(users)
    console.log(`📋 Found ${allUsers.length} users:`)
    allUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.role}) ${user.isActive ? '✅' : '❌'}`)
    })
    
    // Test specific query that auth uses
    const testEmail = allUsers.length > 0 ? allUsers[0].email : 'test@example.com'
    console.log(`\n🔑 Testing auth query for: ${testEmail}`)
    
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1)
      
    if (user.length > 0) {
      console.log('✅ User query successful:', user[0].email)
    } else {
      console.log('❌ No user found')
    }
    
  } catch (error) {
    console.error('❌ Auth test failed:', error)
  } finally {
    process.exit(0)
  }
}

testAuth()