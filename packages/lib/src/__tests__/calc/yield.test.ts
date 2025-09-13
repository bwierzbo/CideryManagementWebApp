import { describe, it, expect } from 'vitest'
import {
  calcActualLPerKg,
  calcVariancePct,
  calculateExtractionEfficiency,
  getVarietyYieldRange,
  calculatePotentialJuiceVolume,
  getYieldPerformanceCategory,
  calculateWeightedAverageYield
} from '../../calc/yield'

describe('Yield Calculations', () => {
  describe('calcActualLPerKg', () => {
    it('should calculate yield correctly with typical values', () => {
      // Typical cider apple yield: 300L from 500kg = 0.6 L/kg
      expect(calcActualLPerKg(300, 500)).toBe(0.6)
      
      // High yield: 350L from 500kg = 0.7 L/kg  
      expect(calcActualLPerKg(350, 500)).toBe(0.7)
      
      // Low yield: 250L from 500kg = 0.5 L/kg
      expect(calcActualLPerKg(250, 500)).toBe(0.5)
    })

    it('should handle edge cases', () => {
      // No juice extracted
      expect(calcActualLPerKg(0, 100)).toBe(0)
      
      // Very small amounts
      expect(calcActualLPerKg(0.5, 1)).toBe(0.5)
      
      // Large amounts
      expect(calcActualLPerKg(10000, 15000)).toBe(0.6667)
    })

    it('should round to 4 decimal places', () => {
      expect(calcActualLPerKg(100, 333)).toBe(0.3003)
      expect(calcActualLPerKg(1, 3)).toBe(0.3333)
    })

    it('should throw error for invalid inputs', () => {
      // Negative juice volume
      expect(() => calcActualLPerKg(-100, 500)).toThrow('Juice volume must be non-negative')
      
      // Zero or negative weight
      expect(() => calcActualLPerKg(300, 0)).toThrow('Input weight must be positive')
      expect(() => calcActualLPerKg(300, -500)).toThrow('Input weight must be positive')
      
      // Physically impossible yield (juice > 2x weight)
      expect(() => calcActualLPerKg(1100, 500)).toThrow('Juice volume cannot exceed twice the input weight')
    })
  })

  describe('calcVariancePct', () => {
    it('should calculate positive variance correctly', () => {
      // 15% over expected
      expect(calcVariancePct(0.69, 0.6)).toBe(15)
      
      // 25% over expected  
      expect(calcVariancePct(0.75, 0.6)).toBe(25)
      
      // Small positive variance
      expect(calcVariancePct(0.61, 0.6)).toBe(1.67)
    })

    it('should calculate negative variance correctly', () => {
      // 10% under expected
      expect(calcVariancePct(0.54, 0.6)).toBe(-10)
      
      // 20% under expected
      expect(calcVariancePct(0.48, 0.6)).toBe(-20)
      
      // Small negative variance
      expect(calcVariancePct(0.59, 0.6)).toBe(-1.67)
    })

    it('should handle edge cases', () => {
      // No variance
      expect(calcVariancePct(0.6, 0.6)).toBe(0)
      
      // Double the expected
      expect(calcVariancePct(1.2, 0.6)).toBe(100)
      
      // Zero actual (complete failure)
      expect(calcVariancePct(0, 0.6)).toBe(-100)
    })

    it('should round to 2 decimal places', () => {
      expect(calcVariancePct(0.6173, 0.6)).toBe(2.88)
    })

    it('should throw error for invalid inputs', () => {
      // Zero expected value
      expect(() => calcVariancePct(0.6, 0)).toThrow('Expected value cannot be zero for variance calculation')
      
      // Negative values
      expect(() => calcVariancePct(-0.1, 0.6)).toThrow('Values must be non-negative for variance calculation')
      expect(() => calcVariancePct(0.6, -0.1)).toThrow('Values must be non-negative for variance calculation')
    })
  })

  describe('calculateExtractionEfficiency', () => {
    it('should calculate efficiency correctly', () => {
      // Meeting expectations exactly
      expect(calculateExtractionEfficiency(0.6, 0.6)).toBe(100)
      
      // 110% efficiency
      expect(calculateExtractionEfficiency(0.66, 0.6)).toBe(110)
      
      // 90% efficiency
      expect(calculateExtractionEfficiency(0.54, 0.6)).toBe(90)
      
      // 75% efficiency
      expect(calculateExtractionEfficiency(0.45, 0.6)).toBe(75)
    })
  })

  describe('getVarietyYieldRange', () => {
    it('should return correct ranges for known varieties', () => {
      const honeycrisp = getVarietyYieldRange('Honeycrisp')
      expect(honeycrisp.typical).toBe(0.62)
      expect(honeycrisp.min).toBeLessThan(honeycrisp.typical)
      expect(honeycrisp.max).toBeGreaterThan(honeycrisp.typical)
      
      const grannySmith = getVarietyYieldRange('Granny Smith')
      expect(grannySmith.typical).toBe(0.65)
      
      const northernSpy = getVarietyYieldRange('Northern Spy')
      expect(northernSpy.typical).toBe(0.68)
    })

    it('should return default range for unknown varieties', () => {
      const unknown = getVarietyYieldRange('Unknown Variety')
      expect(unknown.typical).toBe(0.60)
      expect(unknown.min).toBe(0.50)
      expect(unknown.max).toBe(0.70)
    })

    it('should have consistent ranges (min < typical < max)', () => {
      const varieties = ['Honeycrisp', 'Gala', 'Fuji', 'Northern Spy', 'Unknown']
      
      varieties.forEach(variety => {
        const range = getVarietyYieldRange(variety)
        expect(range.min).toBeLessThan(range.typical)
        expect(range.typical).toBeLessThan(range.max)
        expect(range.min).toBeGreaterThan(0)
        expect(range.max).toBeLessThan(1)
      })
    })
  })

  describe('calculatePotentialJuiceVolume', () => {
    it('should calculate total potential correctly', () => {
      const inventory = [
        { weightKg: 500, variety: 'Honeycrisp' }, // 500 * 0.62 = 310L
        { weightKg: 300, variety: 'Granny Smith' }, // 300 * 0.65 = 195L
        { weightKg: 200, variety: 'Gala' } // 200 * 0.60 = 120L
      ]
      
      const expected = (500 * 0.62) + (300 * 0.65) + (200 * 0.60)
      expect(calculatePotentialJuiceVolume(inventory)).toBe(expected)
    })

    it('should handle single variety', () => {
      const inventory = [{ weightKg: 1000, variety: 'Northern Spy' }]
      const expected = 1000 * 0.68
      expect(calculatePotentialJuiceVolume(inventory)).toBe(expected)
    })

    it('should handle empty inventory', () => {
      expect(calculatePotentialJuiceVolume([])).toBe(0)
    })

    it('should use default yield for unknown varieties', () => {
      const inventory = [{ weightKg: 100, variety: 'Unknown Variety' }]
      const expected = 100 * 0.60 // Default typical yield
      expect(calculatePotentialJuiceVolume(inventory)).toBe(expected)
    })

    it('should throw error for invalid weights', () => {
      const invalidInventory = [{ weightKg: -100, variety: 'Honeycrisp' }]
      expect(() => calculatePotentialJuiceVolume(invalidInventory)).toThrow('Apple lot weight must be positive')
      
      const zeroWeightInventory = [{ weightKg: 0, variety: 'Gala' }]
      expect(() => calculatePotentialJuiceVolume(zeroWeightInventory)).toThrow('Apple lot weight must be positive')
    })
  })

  describe('getYieldPerformanceCategory', () => {
    it('should categorize performance correctly', () => {
      expect(getYieldPerformanceCategory(115)).toBe('Exceptional')
      expect(getYieldPerformanceCategory(105)).toBe('Excellent')
      expect(getYieldPerformanceCategory(95)).toBe('Good')
      expect(getYieldPerformanceCategory(85)).toBe('Fair')
      expect(getYieldPerformanceCategory(75)).toBe('Poor')
      expect(getYieldPerformanceCategory(65)).toBe('Very Poor')
    })

    it('should handle boundary values', () => {
      expect(getYieldPerformanceCategory(110)).toBe('Exceptional')
      expect(getYieldPerformanceCategory(100)).toBe('Excellent')
      expect(getYieldPerformanceCategory(90)).toBe('Good')
      expect(getYieldPerformanceCategory(80)).toBe('Fair')
      expect(getYieldPerformanceCategory(70)).toBe('Poor')
    })
  })

  describe('calculateWeightedAverageYield', () => {
    it('should calculate weighted average correctly', () => {
      const pressRuns = [
        { juiceVolumeL: 300, inputWeightKg: 500 }, // 0.6 L/kg
        { juiceVolumeL: 200, inputWeightKg: 400 }, // 0.5 L/kg  
        { juiceVolumeL: 150, inputWeightKg: 300 }  // 0.5 L/kg
      ]
      
      // Total: 650L from 1200kg = 0.5417 L/kg
      const expected = calcActualLPerKg(650, 1200)
      expect(calculateWeightedAverageYield(pressRuns)).toBe(expected)
    })

    it('should handle single press run', () => {
      const pressRuns = [{ juiceVolumeL: 300, inputWeightKg: 500 }]
      expect(calculateWeightedAverageYield(pressRuns)).toBe(0.6)
    })

    it('should weight larger runs more heavily', () => {
      const pressRuns = [
        { juiceVolumeL: 10, inputWeightKg: 20 },   // 0.5 L/kg, small run
        { juiceVolumeL: 700, inputWeightKg: 1000 } // 0.7 L/kg, large run
      ]
      
      const weightedAvg = calculateWeightedAverageYield(pressRuns)
      // Should be closer to 0.7 than 0.5 due to weighting
      expect(weightedAvg).toBeGreaterThan(0.65)
      expect(weightedAvg).toBeLessThan(0.7)
    })

    it('should throw error for empty array', () => {
      expect(() => calculateWeightedAverageYield([])).toThrow('Cannot calculate average yield from empty array')
    })

    it('should throw error for invalid data', () => {
      const invalidRuns = [{ juiceVolumeL: -100, inputWeightKg: 500 }]
      expect(() => calculateWeightedAverageYield(invalidRuns)).toThrow('All press runs must have positive weight and non-negative juice volume')
      
      const zeroWeightRuns = [{ juiceVolumeL: 100, inputWeightKg: 0 }]
      expect(() => calculateWeightedAverageYield(zeroWeightRuns)).toThrow('All press runs must have positive weight and non-negative juice volume')
    })
  })

  describe('Yield Curve Validation', () => {
    it('should show realistic yield ranges across varieties', () => {
      const varieties = [
        'Honeycrisp', 'Granny Smith', 'Gala', 'Fuji', 
        'Northern Spy', 'Rhode Island Greening', 'McIntosh'
      ]
      
      varieties.forEach(variety => {
        const range = getVarietyYieldRange(variety)
        
        // All yields should be realistic (between 0.4 and 0.8 L/kg)
        expect(range.min).toBeGreaterThan(0.4)
        expect(range.max).toBeLessThan(0.8)
        
        // Range should be reasonable (not more than 0.25 spread)
        expect(range.max - range.min).toBeLessThanOrEqual(0.25)
      })
    })

    it('should maintain efficiency calculation consistency', () => {
      const testCases = [
        { actual: 0.6, expected: 0.6, efficiency: 100 },
        { actual: 0.66, expected: 0.6, efficiency: 110 },
        { actual: 0.54, expected: 0.6, efficiency: 90 },
        { actual: 0.48, expected: 0.6, efficiency: 80 },
        { actual: 0.72, expected: 0.6, efficiency: 120 }
      ]
      
      testCases.forEach(({ actual, expected, efficiency }) => {
        expect(calculateExtractionEfficiency(actual, expected)).toBe(efficiency)
      })
    })

    it('should validate variance calculation accuracy', () => {
      const baseExpected = 0.6
      const testActuals = [0.48, 0.54, 0.6, 0.66, 0.72]
      const expectedVariances = [-20, -10, 0, 10, 20]
      
      testActuals.forEach((actual, index) => {
        const variance = calcVariancePct(actual, baseExpected)
        expect(variance).toBe(expectedVariances[index])
      })
    })

    it('should demonstrate realistic extraction scenarios', () => {
      // Poor extraction day
      const poorYield = calcActualLPerKg(400, 1000) // 0.4 L/kg
      expect(getYieldPerformanceCategory(calculateExtractionEfficiency(poorYield, 0.6))).toBe('Very Poor')
      
      // Good extraction day  
      const goodYield = calcActualLPerKg(650, 1000) // 0.65 L/kg
      expect(getYieldPerformanceCategory(calculateExtractionEfficiency(goodYield, 0.6))).toBe('Excellent')
      
      // Exceptional day
      const exceptionalYield = calcActualLPerKg(720, 1000) // 0.72 L/kg
      expect(getYieldPerformanceCategory(calculateExtractionEfficiency(exceptionalYield, 0.6))).toBe('Exceptional')
    })
  })
})