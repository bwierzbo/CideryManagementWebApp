import { describe, it, expect } from 'vitest'
import {
  calculateAbv,
  calculatePotentialAbv,
  brixToSpecificGravity,
  calculateAbvFromBrix,
  calculateAttenuation,
  isValidSpecificGravity,
  getAbvCategory
} from '../../calc/abv'

describe('ABV Calculations', () => {
  describe('calculateAbv', () => {
    it('should calculate ABV correctly with typical cider values', () => {
      // Typical cider: OG 1.050, FG 1.000 = 6.56% ABV
      expect(calculateAbv(1.050, 1.000)).toBe(6.56)
      
      // Strong cider: OG 1.070, FG 1.005 = 8.53% ABV
      expect(calculateAbv(1.070, 1.005)).toBe(8.53)
      
      // Weak cider: OG 1.035, FG 1.008 = 3.54% ABV
      expect(calculateAbv(1.035, 1.008)).toBe(3.54)
    })

    it('should handle edge cases correctly', () => {
      // No fermentation (OG = FG)
      expect(calculateAbv(1.050, 1.050)).toBe(0)
      
      // Very small difference
      expect(calculateAbv(1.001, 1.000)).toBe(0.13)
    })

    it('should round to 2 decimal places', () => {
      expect(calculateAbv(1.0456, 1.0123)).toBe(4.37)
    })

    it('should throw error for invalid inputs', () => {
      // Negative values
      expect(() => calculateAbv(-1.050, 1.000)).toThrow('Specific gravity readings must be positive numbers')
      expect(() => calculateAbv(1.050, -1.000)).toThrow('Specific gravity readings must be positive numbers')
      
      // Zero values
      expect(() => calculateAbv(0, 1.000)).toThrow('Specific gravity readings must be positive numbers')
      expect(() => calculateAbv(1.050, 0)).toThrow('Specific gravity readings must be positive numbers')
      
      // FG > OG
      expect(() => calculateAbv(1.000, 1.050)).toThrow('Original gravity must be greater than or equal to final gravity')
      
      // Out of range values
      expect(() => calculateAbv(0.900, 1.000)).toThrow('Original gravity must be between 0.980 and 1.200')
      expect(() => calculateAbv(1.050, 0.900)).toThrow('Final gravity must be between 0.980 and 1.200')
      expect(() => calculateAbv(1.300, 1.000)).toThrow('Original gravity must be between 0.980 and 1.200')
      expect(() => calculateAbv(1.050, 1.300)).toThrow('Final gravity must be between 0.980 and 1.200')
    })
  })

  describe('calculatePotentialAbv', () => {
    it('should calculate potential ABV assuming complete fermentation', () => {
      expect(calculatePotentialAbv(1.050)).toBe(6.56)
      expect(calculatePotentialAbv(1.070)).toBe(9.19)
      expect(calculatePotentialAbv(1.040)).toBe(5.25)
    })
  })

  describe('brixToSpecificGravity', () => {
    it('should convert Brix to specific gravity correctly', () => {
      // 0 Brix should be 1.000 SG
      expect(brixToSpecificGravity(0)).toBe(1.000)
      
      // Typical apple juice: ~12-15 Brix
      const sg12 = brixToSpecificGravity(12)
      expect(sg12).toBeGreaterThan(1.040)
      expect(sg12).toBeLessThan(1.060)
      
      const sg15 = brixToSpecificGravity(15)
      expect(sg15).toBeGreaterThan(1.055)
      expect(sg15).toBeLessThan(1.070)
      
      // Higher Brix should give higher SG
      expect(brixToSpecificGravity(20)).toBeGreaterThan(brixToSpecificGravity(15))
    })

    it('should throw error for invalid Brix values', () => {
      expect(() => brixToSpecificGravity(-1)).toThrow('Brix must be between 0 and 50')
      expect(() => brixToSpecificGravity(51)).toThrow('Brix must be between 0 and 50')
    })

    it('should round to 3 decimal places', () => {
      const result = brixToSpecificGravity(12.5)
      const decimalPlaces = result.toString().split('.')[1]?.length || 0
      expect(decimalPlaces).toBeLessThanOrEqual(3)
    })
  })

  describe('calculateAbvFromBrix', () => {
    it('should calculate ABV from Brix readings', () => {
      // Typical fermentation: 14 Brix to 0 Brix
      const abv = calculateAbvFromBrix(14, 0)
      expect(abv).toBeGreaterThan(6)
      expect(abv).toBeLessThan(9)
      
      // Partial fermentation
      const partialAbv = calculateAbvFromBrix(14, 5)
      expect(partialAbv).toBeGreaterThan(3)
      expect(partialAbv).toBeLessThan(6)
      expect(partialAbv).toBeLessThan(abv)
    })
  })

  describe('calculateAttenuation', () => {
    it('should calculate apparent attenuation correctly', () => {
      // Complete fermentation: OG 1.050, FG 1.000 = 100% attenuation
      expect(calculateAttenuation(1.050, 1.000)).toBe(100)
      
      // Partial fermentation: OG 1.050, FG 1.010 = 80% attenuation
      expect(calculateAttenuation(1.050, 1.010)).toBe(80)
      
      // No fermentation: OG 1.050, FG 1.050 = 0% attenuation
      expect(calculateAttenuation(1.050, 1.050)).toBe(0)
      
      // Typical cider: OG 1.045, FG 1.002 = ~95.6% attenuation
      expect(calculateAttenuation(1.045, 1.002)).toBeCloseTo(95.56, 1)
    })

    it('should handle edge cases', () => {
      // Very small difference
      expect(calculateAttenuation(1.001, 1.000)).toBe(100)
    })

    it('should throw error for invalid inputs', () => {
      expect(() => calculateAttenuation(-1.050, 1.000)).toThrow('Specific gravity readings must be positive numbers')
      expect(() => calculateAttenuation(1.050, -1.000)).toThrow('Specific gravity readings must be positive numbers')
      expect(() => calculateAttenuation(0, 1.000)).toThrow('Specific gravity readings must be positive numbers')
      expect(() => calculateAttenuation(1.000, 1.050)).toThrow('Original gravity must be greater than or equal to final gravity')
    })
  })

  describe('isValidSpecificGravity', () => {
    it('should validate typical specific gravity readings', () => {
      expect(isValidSpecificGravity(1.000)).toBe(true)
      expect(isValidSpecificGravity(1.050)).toBe(true)
      expect(isValidSpecificGravity(1.100)).toBe(true)
      expect(isValidSpecificGravity(0.995)).toBe(true)
      expect(isValidSpecificGravity(1.180)).toBe(true)
    })

    it('should reject invalid specific gravity readings', () => {
      expect(isValidSpecificGravity(0.970)).toBe(false)
      expect(isValidSpecificGravity(1.250)).toBe(false)
      expect(isValidSpecificGravity(-1.050)).toBe(false)
      expect(isValidSpecificGravity(0)).toBe(false)
    })
  })

  describe('getAbvCategory', () => {
    it('should categorize ABV levels correctly', () => {
      expect(getAbvCategory(0.3)).toBe('Non-alcoholic')
      expect(getAbvCategory(2.5)).toBe('Low alcohol')
      expect(getAbvCategory(5.0)).toBe('Standard cider')
      expect(getAbvCategory(8.5)).toBe('Strong cider')
      expect(getAbvCategory(15.0)).toBe('Very strong cider')
    })

    it('should handle edge cases', () => {
      expect(getAbvCategory(0.5)).toBe('Low alcohol')
      expect(getAbvCategory(3.5)).toBe('Standard cider')
      expect(getAbvCategory(7.0)).toBe('Strong cider')
      expect(getAbvCategory(12.0)).toBe('Very strong cider')
    })
  })

  describe('ABV Curve Validation', () => {
    it('should follow expected ABV curve progression', () => {
      const testPoints = [
        { og: 1.040, expectedRange: [4.5, 5.5] },
        { og: 1.045, expectedRange: [5.5, 6.5] },
        { og: 1.050, expectedRange: [6.0, 7.0] },
        { og: 1.055, expectedRange: [7.0, 8.0] },
        { og: 1.060, expectedRange: [7.5, 8.5] },
        { og: 1.070, expectedRange: [8.5, 9.5] }
      ]

      testPoints.forEach(({ og, expectedRange }) => {
        const abv = calculateAbv(og, 1.000)
        expect(abv).toBeGreaterThanOrEqual(expectedRange[0])
        expect(abv).toBeLessThanOrEqual(expectedRange[1])
      })
    })

    it('should show consistent relationship between OG difference and ABV', () => {
      const baseOG = 1.050
      const testFGs = [1.000, 1.005, 1.010, 1.015, 1.020]
      
      let previousAbv = Infinity
      
      testFGs.forEach(fg => {
        const abv = calculateAbv(baseOG, fg)
        expect(abv).toBeLessThan(previousAbv)
        previousAbv = abv
      })
    })

    it('should validate the 131.25 multiplier accuracy', () => {
      // Test the formula ABV = (OG - FG) * 131.25
      const og = 1.050
      const fg = 1.000
      const expectedAbv = Math.round((og - fg) * 131.25 * 100) / 100
      
      expect(calculateAbv(og, fg)).toBe(expectedAbv)
      
      // Test with different values
      const og2 = 1.065
      const fg2 = 1.008
      const expectedAbv2 = Math.round((og2 - fg2) * 131.25 * 100) / 100
      
      expect(calculateAbv(og2, fg2)).toBe(expectedAbv2)
    })
  })
})