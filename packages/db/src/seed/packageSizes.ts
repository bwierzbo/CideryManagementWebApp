import { db } from '../client'
import { packageSizes } from '../schema/packaging'
import { sql } from 'drizzle-orm'

export const packageSizesData = [
  // Cans
  {
    sizeML: 355,
    sizeOz: '12.00',
    displayName: '355ml (12 oz) Can',
    packageType: 'can' as const,
    sortOrder: 1
  },
  {
    sizeML: 473,
    sizeOz: '16.00',
    displayName: '473ml (16 oz) Can',
    packageType: 'can' as const,
    sortOrder: 3
  },

  // Bottles
  {
    sizeML: 355,
    sizeOz: '12.00',
    displayName: '355ml (12 oz) Bottle',
    packageType: 'bottle' as const,
    sortOrder: 2
  },
  {
    sizeML: 500,
    sizeOz: '16.90',
    displayName: '500ml (16.9 oz) Bottle',
    packageType: 'bottle' as const,
    sortOrder: 4
  },
  {
    sizeML: 750,
    sizeOz: '25.40',
    displayName: '750ml (25.4 oz) Bottle',
    packageType: 'bottle' as const,
    sortOrder: 5
  },
  {
    sizeML: 1000,
    sizeOz: '33.80',
    displayName: '1000ml (33.8 oz) Bottle',
    packageType: 'bottle' as const,
    sortOrder: 6
  },

  // Kegs
  {
    sizeML: 19500,
    sizeOz: '659.00',
    displayName: '19.5L Keg (1/6 barrel)',
    packageType: 'keg' as const,
    sortOrder: 7
  },
  {
    sizeML: 30000,
    sizeOz: '1014.00',
    displayName: '30L Keg (1/4 barrel)',
    packageType: 'keg' as const,
    sortOrder: 8
  },
  {
    sizeML: 50000,
    sizeOz: '1690.00',
    displayName: '50L Keg (1/2 barrel)',
    packageType: 'keg' as const,
    sortOrder: 9
  }
]

export async function seedPackageSizes() {
  console.log('📦 Seeding package sizes...')

  try {
    // Use INSERT ... ON CONFLICT for idempotent upsert
    const result = await db
      .insert(packageSizes)
      .values(packageSizesData.map(item => ({
        ...item,
        isActive: true
      })))
      .onConflictDoUpdate({
        target: [packageSizes.sizeML, packageSizes.packageType],
        set: {
          sizeOz: sql`excluded.size_oz`,
          displayName: sql`excluded.display_name`,
          sortOrder: sql`excluded.sort_order`,
          isActive: sql`excluded.is_active`,
          updatedAt: sql`now()`
        }
      })
      .returning()

    console.log(`✅ Seeded ${result.length} package sizes`)
    return result
  } catch (error) {
    console.error('❌ Error seeding package sizes:', error)
    throw error
  }
}