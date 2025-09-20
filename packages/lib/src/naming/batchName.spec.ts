import { describe, it, expect } from 'vitest'
import {
  generateBatchName,
  generateVarietyCode,
  selectPrimaryVariety,
  generateBatchNameFromComposition,
  type BatchComposition,
  type GenerateBatchNameOptions,
  type BatchCompositionInput
} from './batchName'

describe('batchName', () => {
  describe('generateBatchName', () => {
    it('should generate batch name with primary variety', () => {
      const opts: GenerateBatchNameOptions = {
        date: new Date('2025-09-19'),
        vesselCode: 'TK03',
        primaryVariety: 'Gravenstein'
      }

      const result = generateBatchName(opts)
      expect(result).toBe('2025-09-19_TK03_GRAV_A')
    })

    it('should generate batch name with custom sequence', () => {
      const opts: GenerateBatchNameOptions = {
        date: new Date('2025-09-19'),
        vesselCode: 'TK03',
        primaryVariety: 'Gravenstein',
        sequence: 'B'
      }

      const result = generateBatchName(opts)
      expect(result).toBe('2025-09-19_TK03_GRAV_B')
    })

    it('should use BLEND when no primary variety provided', () => {
      const opts: GenerateBatchNameOptions = {
        date: new Date('2025-09-19'),
        vesselCode: 'TK03'
      }

      const result = generateBatchName(opts)
      expect(result).toBe('2025-09-19_TK03_BLEND_A')
    })

    it('should handle different vessel codes', () => {
      const opts: GenerateBatchNameOptions = {
        date: new Date('2025-09-19'),
        vesselCode: 'FV01',
        primaryVariety: 'Northern Spy'
      }

      const result = generateBatchName(opts)
      expect(result).toBe('2025-09-19_FV01_NOSP_A')
    })

    it('should format date correctly', () => {
      const opts: GenerateBatchNameOptions = {
        date: new Date('2025-12-01T15:30:00.000Z'),
        vesselCode: 'TK03',
        primaryVariety: 'Gravenstein'
      }

      const result = generateBatchName(opts)
      expect(result).toBe('2025-12-01_TK03_GRAV_A')
    })

    it('should be deterministic - same inputs produce same output', () => {
      const opts: GenerateBatchNameOptions = {
        date: new Date('2025-09-19'),
        vesselCode: 'TK03',
        primaryVariety: 'Gravenstein'
      }

      const result1 = generateBatchName(opts)
      const result2 = generateBatchName(opts)
      expect(result1).toBe(result2)
      expect(result1).toBe('2025-09-19_TK03_GRAV_A')
    })
  })

  describe('generateVarietyCode', () => {
    it('should generate 4-char code for single word varieties', () => {
      expect(generateVarietyCode('Gravenstein')).toBe('GRAV')
      expect(generateVarietyCode('Honeycrisp')).toBe('HONE')
      expect(generateVarietyCode('Gala')).toBe('GALA')
    })

    it('should generate code for two-word varieties', () => {
      expect(generateVarietyCode('Northern Spy')).toBe('NOSP')
      expect(generateVarietyCode('Golden Delicious')).toBe('GODE')
      expect(generateVarietyCode('Red Delicious')).toBe('REDE')
      expect(generateVarietyCode('Granny Smith')).toBe('GRSM')
    })

    it('should handle multi-word varieties', () => {
      expect(generateVarietyCode('Rhode Island Greening')).toBe('RIGR')
      expect(generateVarietyCode('Cox Orange Pippin')).toBe('COPI')
      expect(generateVarietyCode('Esopus Spitzenburg Apple')).toBe('ESAP')
    })

    it('should handle short varieties', () => {
      expect(generateVarietyCode('Ida')).toBe('IDA')
      expect(generateVarietyCode('Cox')).toBe('COX')
    })

    it('should handle edge cases', () => {
      expect(generateVarietyCode('')).toBe('UNKN')
      expect(generateVarietyCode('   ')).toBe('UNKN')
      expect(generateVarietyCode('A')).toBe('A')
    })

    it('should handle invalid inputs gracefully', () => {
      expect(generateVarietyCode(null as any)).toBe('UNKN')
      expect(generateVarietyCode(undefined as any)).toBe('UNKN')
      expect(generateVarietyCode(123 as any)).toBe('UNKN')
    })

    it('should normalize case and whitespace', () => {
      expect(generateVarietyCode('  gravenstein  ')).toBe('GRAV')
      expect(generateVarietyCode('northern   spy')).toBe('NOSP')
      expect(generateVarietyCode('GOLDEN DELICIOUS')).toBe('GODE')
    })

    it('should be deterministic', () => {
      const varietyName = 'Gravenstein'
      const result1 = generateVarietyCode(varietyName)
      const result2 = generateVarietyCode(varietyName)
      expect(result1).toBe(result2)
      expect(result1).toBe('GRAV')
    })
  })

  describe('selectPrimaryVariety', () => {
    it('should return single variety when only one composition', () => {
      const input: BatchCompositionInput = {
        batchCompositions: [
          { varietyName: 'Gravenstein', fractionOfBatch: 1.0 }
        ]
      }

      const result = selectPrimaryVariety(input)
      expect(result).toBe('Gravenstein')
    })

    it('should return variety with highest fraction when dominant (>= 60%)', () => {
      const input: BatchCompositionInput = {
        batchCompositions: [
          { varietyName: 'Gravenstein', fractionOfBatch: 0.7 },
          { varietyName: 'Northern Spy', fractionOfBatch: 0.3 }
        ]
      }

      const result = selectPrimaryVariety(input)
      expect(result).toBe('Gravenstein')
    })

    it('should return undefined when no variety is dominant (< 60%)', () => {
      const input: BatchCompositionInput = {
        batchCompositions: [
          { varietyName: 'Gravenstein', fractionOfBatch: 0.4 },
          { varietyName: 'Northern Spy', fractionOfBatch: 0.35 },
          { varietyName: 'Gala', fractionOfBatch: 0.25 }
        ]
      }

      const result = selectPrimaryVariety(input)
      expect(result).toBeUndefined()
    })

    it('should return undefined when compositions are empty', () => {
      const input: BatchCompositionInput = {
        batchCompositions: []
      }

      const result = selectPrimaryVariety(input)
      expect(result).toBeUndefined()
    })

    it('should handle edge case where top variety is exactly 60%', () => {
      const input: BatchCompositionInput = {
        batchCompositions: [
          { varietyName: 'Gravenstein', fractionOfBatch: 0.6 },
          { varietyName: 'Northern Spy', fractionOfBatch: 0.4 }
        ]
      }

      const result = selectPrimaryVariety(input)
      expect(result).toBe('Gravenstein')
    })

    it('should handle edge case where top variety is just under 60%', () => {
      const input: BatchCompositionInput = {
        batchCompositions: [
          { varietyName: 'Gravenstein', fractionOfBatch: 0.59 },
          { varietyName: 'Northern Spy', fractionOfBatch: 0.41 }
        ]
      }

      const result = selectPrimaryVariety(input)
      expect(result).toBeUndefined()
    })

    it('should select correct variety when fractions are close but one is dominant', () => {
      const input: BatchCompositionInput = {
        batchCompositions: [
          { varietyName: 'Northern Spy', fractionOfBatch: 0.35 },
          { varietyName: 'Gravenstein', fractionOfBatch: 0.65 }
        ]
      }

      const result = selectPrimaryVariety(input)
      expect(result).toBe('Gravenstein')
    })
  })

  describe('generateBatchNameFromComposition', () => {
    it('should generate name with primary variety when dominant', () => {
      const opts = {
        date: new Date('2025-09-19'),
        vesselCode: 'TK03',
        batchCompositions: [
          { varietyName: 'Gravenstein', fractionOfBatch: 0.7 },
          { varietyName: 'Northern Spy', fractionOfBatch: 0.3 }
        ] as BatchComposition[]
      }

      const result = generateBatchNameFromComposition(opts)
      expect(result).toBe('2025-09-19_TK03_GRAV_A')
    })

    it('should generate BLEND name when no variety is dominant', () => {
      const opts = {
        date: new Date('2025-09-19'),
        vesselCode: 'TK03',
        batchCompositions: [
          { varietyName: 'Gravenstein', fractionOfBatch: 0.4 },
          { varietyName: 'Northern Spy', fractionOfBatch: 0.35 },
          { varietyName: 'Gala', fractionOfBatch: 0.25 }
        ] as BatchComposition[]
      }

      const result = generateBatchNameFromComposition(opts)
      expect(result).toBe('2025-09-19_TK03_BLEND_A')
    })

    it('should work with custom sequence', () => {
      const opts = {
        date: new Date('2025-09-19'),
        vesselCode: 'TK03',
        sequence: 'B',
        batchCompositions: [
          { varietyName: 'Gravenstein', fractionOfBatch: 1.0 }
        ] as BatchComposition[]
      }

      const result = generateBatchNameFromComposition(opts)
      expect(result).toBe('2025-09-19_TK03_GRAV_B')
    })

    it('should handle empty compositions gracefully', () => {
      const opts = {
        date: new Date('2025-09-19'),
        vesselCode: 'TK03',
        batchCompositions: [] as BatchComposition[]
      }

      const result = generateBatchNameFromComposition(opts)
      expect(result).toBe('2025-09-19_TK03_BLEND_A')
    })
  })

  describe('integration tests', () => {
    it('should produce consistent results across all functions for the same data', () => {
      const compositions: BatchComposition[] = [
        { varietyName: 'Gravenstein', fractionOfBatch: 0.7 },
        { varietyName: 'Northern Spy', fractionOfBatch: 0.3 }
      ]

      const primaryVariety = selectPrimaryVariety({ batchCompositions: compositions })
      expect(primaryVariety).toBe('Gravenstein')

      const varietyCode = generateVarietyCode(primaryVariety!)
      expect(varietyCode).toBe('GRAV')

      const batchName = generateBatchName({
        date: new Date('2025-09-19'),
        vesselCode: 'TK03',
        primaryVariety
      })
      expect(batchName).toBe('2025-09-19_TK03_GRAV_A')

      const compositionName = generateBatchNameFromComposition({
        date: new Date('2025-09-19'),
        vesselCode: 'TK03',
        batchCompositions: compositions
      })
      expect(compositionName).toBe(batchName)
    })

    it('should handle real-world variety names correctly', () => {
      const realVarieties = [
        'Dabinett',
        'Kingston Black',
        'Yarlington Mill',
        'Somerset Redstreak',
        'Foxwhelp',
        'Ashmead\'s Kernel'
      ]

      realVarieties.forEach(variety => {
        const code = generateVarietyCode(variety)
        expect(code).toBeTruthy()
        expect(code.length).toBeGreaterThan(0)
        expect(code.length).toBeLessThanOrEqual(4)
        expect(code).toMatch(/^[A-Z]+$/)

        const batchName = generateBatchName({
          date: new Date('2025-09-19'),
          vesselCode: 'TK03',
          primaryVariety: variety
        })
        expect(batchName).toMatch(/^2025-09-19_TK03_[A-Z]+_A$/)
      })
    })

    it('should be immutable - repeated calls should not affect each other', () => {
      const opts: GenerateBatchNameOptions = {
        date: new Date('2025-09-19'),
        vesselCode: 'TK03',
        primaryVariety: 'Gravenstein'
      }

      const results = Array.from({ length: 10 }, () => generateBatchName(opts))
      const uniqueResults = new Set(results)
      expect(uniqueResults.size).toBe(1)
      expect(results[0]).toBe('2025-09-19_TK03_GRAV_A')
    })
  })
})