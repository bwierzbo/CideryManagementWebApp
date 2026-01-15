/**
 * US States and Territories for tax filing
 * Used in tax reporting preferences
 */

export const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  // Territories
  { code: "DC", name: "District of Columbia" },
  { code: "PR", name: "Puerto Rico" },
  { code: "VI", name: "U.S. Virgin Islands" },
  { code: "GU", name: "Guam" },
  { code: "AS", name: "American Samoa" },
  { code: "MP", name: "Northern Mariana Islands" },
] as const;

export type USStateCode = (typeof US_STATES)[number]["code"];
export type USStateName = (typeof US_STATES)[number]["name"];

/**
 * Get state name by code
 */
export function getStateName(code: string): string | undefined {
  return US_STATES.find((s) => s.code === code)?.name;
}

/**
 * Get state code by name
 */
export function getStateCode(name: string): string | undefined {
  return US_STATES.find((s) => s.name === name)?.code;
}

/**
 * TTB Reporting Frequency Guidelines
 * Based on annual tax liability
 */
export const TTB_FREQUENCY_THRESHOLDS = {
  annual: { maxLiability: 1000, label: "Annual" },
  quarterly: { maxLiability: 50000, label: "Quarterly" },
  monthly: { maxLiability: Infinity, label: "Monthly" },
} as const;

/**
 * Get recommended TTB reporting frequency based on estimated annual tax liability
 */
export function getRecommendedTtbFrequency(
  estimatedAnnualTax: number
): "annual" | "quarterly" | "monthly" {
  if (estimatedAnnualTax <= TTB_FREQUENCY_THRESHOLDS.annual.maxLiability) {
    return "annual";
  }
  if (estimatedAnnualTax <= TTB_FREQUENCY_THRESHOLDS.quarterly.maxLiability) {
    return "quarterly";
  }
  return "monthly";
}
