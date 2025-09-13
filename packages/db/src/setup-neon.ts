#!/usr/bin/env tsx
import 'dotenv/config'
import { db } from './client'
import { sql } from 'drizzle-orm'

async function setupNeonDatabase() {
  console.log('🚀 Setting up Neon database connection...')
  console.log(`🔗 Connection URL: ${process.env.DATABASE_URL?.substring(0, 50)}...`)
  
  try {
    // Test the connection
    console.log('🔌 Testing database connection...')
    const result = await db.execute(sql`SELECT NOW() as current_time, version() as pg_version`)
    console.log('✅ Connection successful!')
    console.log(`   Database time: ${result.rows?.[0]?.current_time || 'Unknown'}`)
    console.log(`   PostgreSQL version: ${result.rows?.[0]?.pg_version || 'Unknown'}`)

    // Check if pgcrypto extension exists
    console.log('\n🔐 Checking pgcrypto extension...')
    const extensions = await db.execute(sql`
      SELECT extname 
      FROM pg_extension 
      WHERE extname = 'pgcrypto'
    `)
    
    if ((extensions.rows?.length || 0) === 0) {
      console.log('📦 Installing pgcrypto extension...')
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`)
      console.log('✅ pgcrypto extension installed!')
    } else {
      console.log('✅ pgcrypto extension already available!')
    }

    // Check if tables exist
    console.log('\n🗄️ Checking existing tables...')
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)
    
    if ((tables.rows?.length || 0) === 0) {
      console.log('📋 No tables found. Database is ready for schema migration.')
    } else {
      console.log(`📋 Found ${tables.rows?.length || 0} existing tables:`)
      tables.rows?.forEach((table: any) => {
        console.log(`   - ${table.table_name}`)
      })
    }

    console.log('\n🎉 Neon database setup complete!')
    console.log('\n📝 Next steps:')
    console.log('   1. Update your .env.local file with your actual Neon connection string')
    console.log('   2. Run: pnpm --filter db run db:push')
    console.log('   3. Run: pnpm --filter db run db:seed')
    console.log('   4. Test with: pnpm --filter db run db:test')
    
  } catch (error) {
    console.error('❌ Database setup failed:')
    console.error('Error details:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('ENOTFOUND')) {
        console.error('\n💡 This looks like a connection issue. Please check:')
        console.error('   - Your DATABASE_URL in .env.local is correct')
        console.error('   - Your Neon database is running')
        console.error('   - Your internet connection is stable')
      } else if (error.message.includes('authentication')) {
        console.error('\n💡 This looks like an authentication issue. Please check:')
        console.error('   - Your username and password are correct in DATABASE_URL')
        console.error('   - The database user has the necessary permissions')
      } else if (error.message.includes('SSL')) {
        console.error('\n💡 This looks like an SSL issue. Please check:')
        console.error('   - Your connection string includes ?sslmode=require')
        console.error('   - The Neon database allows SSL connections')
      }
    }
    
    throw error
  }
}

// Run the setup function
if (require.main === module) {
  setupNeonDatabase()
    .then(() => {
      console.log('\n✨ Setup completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Setup failed:', error.message)
      process.exit(1)
    })
}