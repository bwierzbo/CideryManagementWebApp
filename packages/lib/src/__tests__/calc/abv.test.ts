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

  describe('ABV Precision and Edge Cases', () => {
    it('should handle floating-point precision edge cases', () => {
      // Test potential floating-point arithmetic issues
      const og = 1.0000000001
      const fg = 1.0000000000
      const abv = calculateAbv(og, fg)

      expect(abv).toBeGreaterThanOrEqual(0)
      expect(abv).toBeLessThan(0.01)
    })

    it('should maintain precision at boundary values', () => {
      // Test at the boundaries of allowed ranges
      expect(() => calculateAbv(0.980, 0.980)).not.toThrow()
      expect(() => calculateAbv(1.200, 1.200)).not.toThrow()
      expect(() => calculateAbv(1.200, 0.980)).not.toThrow()

      // Just outside boundaries should throw
      expect(() => calculateAbv(0.979, 0.979)).toThrow()
      expect(() => calculateAbv(1.201, 1.201)).toThrow()
    })

    it('should handle very small gravity differences', () => {
      // Test minimal fermentation scenarios
      const minimalFermentation = calculateAbv(1.001, 1.000)
      expect(minimalFermentation).toBe(0.13) // 0.001 * 131.25 = 0.13125, rounded to 0.13

      const tinyFermentation = calculateAbv(1.0001, 1.0000)
      expect(tinyFermentation).toBe(0.01) // 0.0001 * 131.25 = 0.013125, rounded to 0.01
    })

    it('should handle maximum realistic ABV scenarios', () => {
      // Very high gravity cider (ice cider/dessert cider)
      const highOG = calculateAbv(1.150, 1.050) // Stopped fermentation
      expect(highOG).toBe(13.12) // 0.1 * 131.25 = 13.125, rounded to 13.12

      // Maximum possible with complete fermentation
      const maxABV = calculateAbv(1.200, 0.980)
      expect(maxABV).toBe(28.87) // 0.22 * 131.25 = 28.875, rounded to 28.87
    })

    it('should handle rounding edge cases consistently', () => {
      // Test values that are exactly at rounding boundaries
      const testCases = [
        { og: 1.0038, fg: 1.0000, expected: 0.5 }, // 0.0038 * 131.25 = 0.49875 -> 0.5
        { og: 1.0040, fg: 1.0000, expected: 0.53 }, // 0.004 * 131.25 = 0.525 -> 0.53
        { og: 1.0015, fg: 1.0000, expected: 0.20 }, // 0.0015 * 131.25 = 0.196875 -> 0.20
      ]

      testCases.forEach(({ og, fg, expected }) => {
        expect(calculateAbv(og, fg)).toBe(expected)
      })
    })

    it('should demonstrate ABV calculation stability across temperature ranges', () => {
      // SG readings vary with temperature, but calculation should be consistent
      // when corrected readings are used
      const tempCorrectedReadings = [
        { og: 1.050, fg: 1.000 }, // 20°C baseline
        { og: 1.0515, fg: 1.0015 }, // Cold reading equivalent
        { og: 1.0485, fg: 0.9985 }  // Warm reading equivalent
      ]

      const abvResults = tempCorrectedReadings.map(({ og, fg }) => calculateAbv(og, fg))

      // All should be very close (within 0.5% ABV)
      const maxABV = Math.max(...abvResults)
      const minABV = Math.min(...abvResults)
      expect(maxABV - minABV).toBeLessThan(0.5)
    })
  })

  describe('Brix Conversion Precision Tests', () => {
    it('should maintain precision across full Brix range', () => {
      // Test conversion precision at various points
      const brixValues = [0, 1, 5, 10, 15, 20, 25, 30, 40, 50]

      brixValues.forEach(brix => {
        const sg = brixToSpecificGravity(brix)
        expect(sg).toBeGreaterThanOrEqual(1.000)
        expect(sg).toBeLessThan(1.300) // Reasonable upper bound

        // Higher Brix should always give higher SG (monotonic)
        if (brix > 0) {
          const lowerSG = brixToSpecificGravity(brix - 1)
          expect(sg).toBeGreaterThan(lowerSG)
        }
      })
    })

    it('should handle decimal Brix values precisely', () => {
      const decimalBrix = [12.5, 13.25, 14.75, 15.33, 20.66]

      decimalBrix.forEach(brix => {
        const sg = brixToSpecificGravity(brix)

        // Should be between integer values
        const lowerSG = brixToSpecificGravity(Math.floor(brix))
        const upperSG = brixToSpecificGravity(Math.ceil(brix))

        expect(sg).toBeGreaterThanOrEqual(lowerSG)
        expect(sg).toBeLessThanOrEqual(upperSG)
      })
    })

    it('should validate Brix-to-SG formula accuracy', () => {
      // Test known reference points (approximate industry standards)
      const referencePoints = [
        { brix: 0, expectedSG: 1.000 },
        { brix: 10, expectedSGRange: [1.038, 1.042] },
        { brix: 15, expectedSGRange: [1.058, 1.063] },
        { brix: 20, expectedSGRange: [1.078, 1.085] },
        { brix: 25, expectedSGRange: [1.100, 1.108] }
      ]

      referencePoints.forEach(({ brix, expectedSG, expectedSGRange }) => {
        const sg = brixToSpecificGravity(brix)

        if (expectedSG) {
          expect(sg).toBeCloseTo(expectedSG, 3)
        } else if (expectedSGRange) {
          expect(sg).toBeGreaterThanOrEqual(expectedSGRange[0])
          expect(sg).toBeLessThanOrEqual(expectedSGRange[1])
        }
      })
    })
  })

  describe('Attenuation Calculation Edge Cases', () => {
    it('should handle very high attenuation scenarios', () => {
      // Champagne-like fermentation (very dry)
      const highAttenuation = calculateAttenuation(1.050, 0.995)
      expect(highAttenuation).toBeGreaterThan(100) // Over-attenuated

      // Should handle gracefully without error
      expect(Number.isFinite(highAttenuation)).toBe(true)
    })

    it('should handle stuck fermentation scenarios', () => {
      // Various stuck fermentation points
      const stuckFermentations = [
        { og: 1.060, fg: 1.030, expectedRange: [50, 60] },
        { og: 1.045, fg: 1.025, expectedRange: [40, 50] },
        { og: 1.050, fg: 1.035, expectedRange: [25, 35] }
      ]

      stuckFermentations.forEach(({ og, fg, expectedRange }) => {
        const attenuation = calculateAttenuation(og, fg)
        expect(attenuation).toBeGreaterThanOrEqual(expectedRange[0])
        expect(attenuation).toBeLessThanOrEqual(expectedRange[1])
      })
    })

    it('should maintain mathematical consistency', () => {
      // Attenuation formula: ((OG - FG) / (OG - 1.000)) * 100
      const testCases = [
        { og: 1.050, fg: 1.010 },
        { og: 1.065, fg: 1.015 },
        { og: 1.040, fg: 1.005 }
      ]

      testCases.forEach(({ og, fg }) => {
        const calculatedAttenuation = calculateAttenuation(og, fg)
        const manualAttenuation = Math.round(((og - fg) / (og - 1.000)) * 100 * 100) / 100

        expect(calculatedAttenuation).toBe(manualAttenuation)
      })
    })
  })

  describe('ABV Category Classification Edge Cases', () => {
    it('should handle boundary values correctly', () => {
      // Test exact boundary values
      expect(getAbvCategory(0.5)).toBe('Low alcohol')    // Exactly at boundary
      expect(getAbvCategory(3.5)).toBe('Standard cider') // Exactly at boundary
      expect(getAbvCategory(7.0)).toBe('Strong cider')   // Exactly at boundary
      expect(getAbvCategory(12.0)).toBe('Very strong cider') // Exactly at boundary

      // Just below boundaries
      expect(getAbvCategory(0.49)).toBe('Non-alcoholic')
      expect(getAbvCategory(3.49)).toBe('Low alcohol')
      expect(getAbvCategory(6.99)).toBe('Standard cider')
      expect(getAbvCategory(11.99)).toBe('Strong cider')
    })

    it('should handle extreme ABV values', () => {
      expect(getAbvCategory(0)).toBe('Non-alcoholic')
      expect(getAbvCategory(25)).toBe('Very strong cider')  // Fortified levels
      expect(getAbvCategory(40)).toBe('Very strong cider')  // Spirit levels
      expect(getAbvCategory(0.1)).toBe('Non-alcoholic')    // Trace alcohol
    })

    it('should provide consistent categorization for realistic cider range', () => {
      // Most ciders fall in 4-12% ABV range
      const realisticRange = Array.from({ length: 51 }, (_, i) => 4 + (i * 0.1)) // 4.0 to 9.0 by 0.1

      realisticRange.forEach(abv => {
        const category = getAbvCategory(abv)
        expect(['Standard cider', 'Strong cider']).toContain(category)
      })

      // Test 9.1-12.0 range separately (Strong to Very Strong)
      const higherRange = Array.from({ length: 30 }, (_, i) => 9.1 + (i * 0.1)) // 9.1 to 12.0
      higherRange.forEach(abv => {
        const category = getAbvCategory(abv)
        expect(['Strong cider', 'Very strong cider']).toContain(category)
      })
    })
  })

  describe('Integration Tests - Real-World Scenarios', () => {
    it('should handle complete fermentation cycle', () => {
      // Start with apple juice Brix reading
      const initialBrix = 14.5
      const finalBrix = 0.5 // Slight residual sugar

      // Convert to SG
      const og = brixToSpecificGravity(initialBrix)
      const fg = brixToSpecificGravity(finalBrix)

      // Calculate final ABV and attenuation
      const abv = calculateAbv(og, fg)
      const attenuation = calculateAttenuation(og, fg)
      const category = getAbvCategory(abv)

      // Verify realistic results
      expect(abv).toBeGreaterThan(6)
      expect(abv).toBeLessThan(10)
      expect(attenuation).toBeGreaterThan(90)
      expect(attenuation).toBeLessThan(100)
      expect(['Standard cider', 'Strong cider']).toContain(category)
    })

    it('should demonstrate temperature correction workflow', () => {
      // Hydrometer reading at 25°C needs correction to 20°C standard
      const measuredSG = 1.050
      const tempCorrection = -0.001 // Approximate correction for 5°C difference
      const correctedOG = measuredSG + tempCorrection

      const finalSG = 1.005
      const correctedFG = finalSG + tempCorrection

      const abv = calculateAbv(correctedOG, correctedFG)

      // Should be close to uncorrected reading but slightly different
      const uncorrectedABV = calculateAbv(measuredSG, finalSG)
      expect(Math.abs(abv - uncorrectedABV)).toBeLessThan(0.5)
    })

    it('should validate commercial cider production ranges', () => {
      // Test against commercial cider specifications
      const commercialSpecs = [
        { style: 'Dry Cider', ogRange: [1.045, 1.055], fgRange: [0.995, 1.005], abvRange: [5.5, 7.5] },
        { style: 'Semi-Dry', ogRange: [1.045, 1.055], fgRange: [1.005, 1.015], abvRange: [4.5, 6.5] },
        { style: 'Ice Cider', ogRange: [1.100, 1.140], fgRange: [1.020, 1.040], abvRange: [9, 13] }
      ]

      commercialSpecs.forEach(({ style, ogRange, fgRange, abvRange }) => {
        // Test typical values for each style
        const midOG = (ogRange[0] + ogRange[1]) / 2
        const midFG = (fgRange[0] + fgRange[1]) / 2

        const abv = calculateAbv(midOG, midFG)

        expect(abv).toBeGreaterThanOrEqual(abvRange[0])
        expect(abv).toBeLessThanOrEqual(abvRange[1])
      })
    })
  })
})