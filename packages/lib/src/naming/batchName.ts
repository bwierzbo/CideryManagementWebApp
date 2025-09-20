/**
 * Batch naming utility for deterministic, human-readable batch names
 */

export interface BatchComposition {
  varietyName: string
  fractionOfBatch: number
}

export interface GenerateBatchNameOptions {
  date: Date
  vesselCode: string
  primaryVariety?: string
  sequence?: string
}

export interface BatchCompositionInput {
  batchCompositions: BatchComposition[]
}

/**
 * Generates a deterministic batch name following the format:
 * YYYY-MM-DD_<VESSEL>_<VARIETY_OR_BLEND>_<SEQ>
 *
 * @param opts - Batch naming options
 * @returns Formatted batch name
 *
 * @example
 * generateBatchName({
 *   date: new Date('2025-09-19'),
 *   vesselCode: 'TK03',
 *   primaryVariety: 'Gravenstein'
 * })
 * // Returns: "2025-09-19_TK03_GRAV_A"
 */
export function generateBatchName(opts: GenerateBatchNameOptions): string {
  const { date, vesselCode, primaryVariety, sequence = 'A' } = opts

  // Format date as YYYY-MM-DD
  const dateStr = date.toISOString().split('T')[0]

  // Determine variety component
  const varietyCode = primaryVariety ? generateVarietyCode(primaryVariety) : 'BLEND'

  return `${dateStr}_${vesselCode}_${varietyCode}_${sequence}`
}

/**
 * Generates a short variety code from a variety name
 * Truncates to 4-5 uppercase characters for readability
 *
 * @param varietyName - Full variety name
 * @returns Short uppercase variety code
 *
 * @example
 * generateVarietyCode('Gravenstein') // Returns: "GRAV"
 * generateVarietyCode('Northern Spy') // Returns: "NOSP"
 * generateVarietyCode('Golden Delicious') // Returns: "GODE"
 */
export function generateVarietyCode(varietyName: string): string {
  if (!varietyName || typeof varietyName !== 'string') {
    return 'UNKN'
  }

  const cleaned = varietyName.trim().toUpperCase()

  if (cleaned === '') {
    return 'UNKN'
  }

  // Handle multi-word varieties by taking first letter of each word
  const words = cleaned.split(/\s+/).filter(word => word.length > 0)

  if (words.length === 0) {
    return 'UNKN'
  } else if (words.length === 1) {
    // Single word: take first 4 characters
    return words[0].substring(0, 4)
  } else if (words.length === 2) {
    // Two words: take first 2 chars from each word
    return words[0].substring(0, 2) + words[1].substring(0, 2)
  } else if (words.length === 3) {
    // Three words: Take first char from first two words, then first 2 chars from third
    return words[0].charAt(0) + words[1].charAt(0) + words[2].substring(0, 2)
  } else {
    // Four or more words: take first char from first 4 words
    return words.slice(0, 4).map(word => word.charAt(0)).join('')
  }
}

/**
 * Determines the primary variety from batch composition
 * Selects the variety with the highest fraction of the batch
 *
 * @param input - Batch composition data
 * @returns Primary variety name or undefined if no compositions or blend
 *
 * @example
 * selectPrimaryVariety({
 *   batchCompositions: [
 *     { varietyName: 'Gravenstein', fractionOfBatch: 0.6 },
 *     { varietyName: 'Northern Spy', fractionOfBatch: 0.4 }
 *   ]
 * })
 * // Returns: "Gravenstein"
 */
export function selectPrimaryVariety(input: BatchCompositionInput): string | undefined {
  const { batchCompositions } = input

  if (!batchCompositions || batchCompositions.length === 0) {
    return undefined
  }

  if (batchCompositions.length === 1) {
    return batchCompositions[0].varietyName
  }

  // Find variety with highest fraction
  let maxFraction = 0
  let primaryVariety: string | undefined

  for (const composition of batchCompositions) {
    if (composition.fractionOfBatch > maxFraction) {
      maxFraction = composition.fractionOfBatch
      primaryVariety = composition.varietyName
    }
  }

  // If the primary variety doesn't dominate significantly (less than 60%), consider it a blend
  if (maxFraction < 0.6) {
    return undefined
  }

  return primaryVariety
}

/**
 * Helper function to generate batch name from composition data
 * Combines primary variety selection with name generation
 *
 * @param opts - Batch naming options with composition data
 * @returns Formatted batch name
 */
export function generateBatchNameFromComposition(
  opts: Omit<GenerateBatchNameOptions, 'primaryVariety'> & BatchCompositionInput
): string {
  const primaryVariety = selectPrimaryVariety(opts)

  return generateBatchName({
    ...opts,
    primaryVariety
  })
}