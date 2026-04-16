/**
 * Cider Style Guide
 *
 * Based on:
 * - BJCP 2025 Cider Style Guidelines
 * - Northwest Cider Association categories (NW Cider Cup)
 * - USACM Cider Style Guidelines
 *
 * Sources:
 * - https://www.bjcp.org/style/2025/cider/
 * - https://www.nwcider.com/find-your-cider-style/
 * - https://ciderassociation.org/
 */

// ============================================
// SWEETNESS & CARBONATION
// ============================================

export type SweetnessLevel = "dry" | "semi_dry" | "medium" | "semi_sweet" | "sweet";
export type CarbonationLevel = "still" | "petillant" | "sparkling";

export const SWEETNESS_LEVELS: { value: SweetnessLevel; label: string; sgRange: string; description: string }[] = [
  { value: "dry", label: "Dry", sgRange: "< 1.002", description: "No residual sugar, crisp finish" },
  { value: "semi_dry", label: "Semi-Dry", sgRange: "1.002 – 1.008", description: "Slight sweetness, balanced" },
  { value: "medium", label: "Medium", sgRange: "1.008 – 1.015", description: "Noticeable sweetness" },
  { value: "semi_sweet", label: "Semi-Sweet", sgRange: "1.015 – 1.025", description: "Distinctly sweet" },
  { value: "sweet", label: "Sweet", sgRange: "> 1.025", description: "Dessert-level sweetness" },
];

export const CARBONATION_LEVELS: { value: CarbonationLevel; label: string; description: string }[] = [
  { value: "still", label: "Still", description: "No carbonation" },
  { value: "petillant", label: "Pétillant", description: "Lightly carbonated, gentle fizz" },
  { value: "sparkling", label: "Sparkling", description: "Fully carbonated, effervescent" },
];

// ============================================
// CIDER STYLE CATEGORIES
// ============================================

export interface CiderStyleDefinition {
  id: string;
  name: string;
  category: "traditional" | "specialty" | "fruit" | "botanical" | "strong" | "perry";
  description: string;
  /** BJCP category code if applicable */
  bjcpCode?: string;
  /** Typical ABV range */
  abvRange: { min: number; max: number };
  /** Allowed sweetness levels */
  sweetness: SweetnessLevel[];
  /** Allowed carbonation levels */
  carbonation: CarbonationLevel[];
  /** Suggested OG range */
  ogRange?: { min: number; max: number };
  /** Suggested FG range */
  fgRange?: { min: number; max: number };
  /** Tannin level expectation */
  tanninLevel: "low" | "medium" | "high" | "varies";
  /** Suggested apple categories */
  suggestedAppleTypes: string[];
  /** Suggested yeasts */
  suggestedYeasts: string[];
  /** Suggested additives with typical amounts */
  suggestedAdditives: { name: string; amount: string; timing: string }[];
  /** Typical fermentation days */
  fermentationDays: { min: number; max: number };
  /** Aging recommendation */
  agingNotes?: string;
  /** Production tips */
  tips: string[];
}

export const CIDER_STYLES: CiderStyleDefinition[] = [
  // ============================================
  // TRADITIONAL CIDERS (BJCP C1)
  // ============================================
  {
    id: "common_cider",
    name: "Common Cider",
    category: "traditional",
    bjcpCode: "C1A",
    description: "A clean, refreshing cider made primarily from culinary/table apples. The most accessible and widely produced style.",
    abvRange: { min: 5, max: 8 },
    sweetness: ["dry", "semi_dry", "medium", "semi_sweet"],
    carbonation: ["still", "petillant", "sparkling"],
    ogRange: { min: 1.045, max: 1.065 },
    fgRange: { min: 0.998, max: 1.015 },
    tanninLevel: "low",
    suggestedAppleTypes: ["Fuji", "Gala", "Golden Delicious", "Granny Smith", "Honeycrisp", "Jonathan", "McIntosh"],
    suggestedYeasts: ["AB-1 (SafCider)", "EC-1118 (Lalvin)", "D-47 (Lalvin)"],
    suggestedAdditives: [
      { name: "Potassium Metabisulfite", amount: "50 ppm", timing: "pre_fermentation" },
      { name: "Fermaid O", amount: "1 g/gal", timing: "during_fermentation" },
    ],
    fermentationDays: { min: 14, max: 28 },
    tips: [
      "Use a blend of 2-3 apple varieties for complexity",
      "Juice apples after a 1-2 day sweat for better extraction",
      "Ferment cool (60-65°F) for cleaner flavors",
    ],
  },
  {
    id: "heirloom_cider",
    name: "Heirloom / Heritage Cider",
    category: "traditional",
    bjcpCode: "C1B",
    description: "Made from heritage/cider-specific apple varieties with higher tannin and more complex flavors. The classic English or American heritage style.",
    abvRange: { min: 5, max: 9 },
    sweetness: ["dry", "semi_dry", "medium", "semi_sweet"],
    carbonation: ["still", "petillant", "sparkling"],
    ogRange: { min: 1.050, max: 1.075 },
    fgRange: { min: 0.998, max: 1.012 },
    tanninLevel: "medium",
    suggestedAppleTypes: ["Kingston Black", "Dabinett", "Yarlington Mill", "Golden Russet", "Ashmeads Kernel", "Northern Spy", "Stoke Red", "Brown Snout"],
    suggestedYeasts: ["D-47 (Lalvin)", "AB-1 (SafCider)", "Wild/spontaneous"],
    suggestedAdditives: [
      { name: "Potassium Metabisulfite", amount: "50 ppm", timing: "pre_fermentation" },
    ],
    fermentationDays: { min: 21, max: 60 },
    agingNotes: "Benefits from 3-6 months aging. Extended aging develops complexity.",
    tips: [
      "Blend bittersharp + bittersweet varieties for balance",
      "Target 60-70% bittersweet, 20-30% sharp, 10% sweet",
      "Minimal intervention — let the apples speak",
    ],
  },
  {
    id: "english_cider",
    name: "English Cider",
    category: "traditional",
    bjcpCode: "C1C",
    description: "A traditional English-style cider with noticeable tannin and body. Often still or lightly sparkling.",
    abvRange: { min: 5, max: 9 },
    sweetness: ["dry", "semi_dry", "medium", "semi_sweet", "sweet"],
    carbonation: ["still", "petillant"],
    ogRange: { min: 1.050, max: 1.075 },
    fgRange: { min: 0.998, max: 1.020 },
    tanninLevel: "high",
    suggestedAppleTypes: ["Dabinett", "Kingston Black", "Yarlington Mill", "Stoke Red", "Brown Snout", "Tremlett's Bitter"],
    suggestedYeasts: ["D-47 (Lalvin)", "Wild/spontaneous"],
    suggestedAdditives: [],
    fermentationDays: { min: 30, max: 90 },
    agingNotes: "Best with 6+ months aging. Keeving can produce naturally sweet cider.",
    tips: [
      "High-tannin bittersweet and bittersharp varieties essential",
      "Still or pétillant carbonation traditional",
      "Consider keeving for natural sweetness",
    ],
  },
  {
    id: "french_cider",
    name: "French Cider",
    category: "traditional",
    bjcpCode: "C1D",
    description: "A French-style cider (cidre) that is typically medium to sweet with moderate alcohol and gentle carbonation.",
    abvRange: { min: 3, max: 6 },
    sweetness: ["medium", "semi_sweet", "sweet"],
    carbonation: ["petillant", "sparkling"],
    ogRange: { min: 1.050, max: 1.065 },
    fgRange: { min: 1.010, max: 1.025 },
    tanninLevel: "medium",
    suggestedAppleTypes: ["Dabinett", "Yarlington Mill", "Bittersweet varieties"],
    suggestedYeasts: ["71B (Lalvin)", "D-47 (Lalvin)"],
    suggestedAdditives: [
      { name: "Potassium Metabisulfite", amount: "75 ppm", timing: "pre_fermentation" },
    ],
    fermentationDays: { min: 30, max: 90 },
    agingNotes: "Keeving is the traditional French technique for retaining sweetness naturally.",
    tips: [
      "Lower ABV achieved through keeving or arrested fermentation",
      "Bittersweet apple varieties preferred",
      "Pétillant naturel (pet-nat) method common",
    ],
  },
  {
    id: "single_variety",
    name: "Single Variety",
    category: "traditional",
    description: "Cider made from a single apple variety, showcasing its unique characteristics. NW Cider Cup category.",
    abvRange: { min: 4, max: 9 },
    sweetness: ["dry", "semi_dry", "medium", "semi_sweet"],
    carbonation: ["still", "petillant", "sparkling"],
    ogRange: { min: 1.045, max: 1.075 },
    fgRange: { min: 0.998, max: 1.015 },
    tanninLevel: "varies",
    suggestedAppleTypes: ["Kingston Black", "Golden Russet", "Ashmeads Kernel", "Dabinett", "Winesap"],
    suggestedYeasts: ["D-47 (Lalvin)", "AB-1 (SafCider)"],
    suggestedAdditives: [
      { name: "Potassium Metabisulfite", amount: "50 ppm", timing: "pre_fermentation" },
    ],
    fermentationDays: { min: 14, max: 45 },
    tips: [
      "Choose a variety with balanced acid, sugar, and tannin",
      "Kingston Black is the gold standard for single-variety cider",
      "Let the apple's character shine — minimal additions",
    ],
  },
  {
    id: "red_fleshed",
    name: "Red-Fleshed Cider",
    category: "traditional",
    description: "Cider with color from naturally red/pink-fleshed apples. May have berry or floral notes. NW Cider Cup category.",
    abvRange: { min: 4, max: 8 },
    sweetness: ["dry", "semi_dry", "medium", "semi_sweet"],
    carbonation: ["still", "petillant", "sparkling"],
    ogRange: { min: 1.045, max: 1.065 },
    fgRange: { min: 0.998, max: 1.015 },
    tanninLevel: "low",
    suggestedAppleTypes: ["Hidden Rose", "Mountain Rose", "Kissabel", "Red Love"],
    suggestedYeasts: ["D-47 (Lalvin)", "71B (Lalvin)"],
    suggestedAdditives: [
      { name: "Potassium Metabisulfite", amount: "30 ppm", timing: "pre_fermentation" },
    ],
    fermentationDays: { min: 14, max: 30 },
    tips: [
      "Minimize oxidation to preserve color",
      "Lower sulfite levels to protect anthocyanins",
      "Press quickly and cold to retain pink hue",
    ],
  },

  // ============================================
  // SPECIALTY CIDERS (BJCP C3)
  // ============================================
  {
    id: "fruit_cider",
    name: "Fruit Cider",
    category: "fruit",
    bjcpCode: "C3A",
    description: "Cider with other fruits added post-fermentation. Fruit character should complement the apple base. NW Cider Cup has both co-fermented and post-fermentation sub-categories.",
    abvRange: { min: 4, max: 9 },
    sweetness: ["dry", "semi_dry", "medium", "semi_sweet", "sweet"],
    carbonation: ["still", "petillant", "sparkling"],
    ogRange: { min: 1.045, max: 1.070 },
    fgRange: { min: 0.998, max: 1.020 },
    tanninLevel: "low",
    suggestedAppleTypes: ["Common/table apples for neutral base", "Golden Delicious", "Fuji"],
    suggestedYeasts: ["71B (Lalvin)", "EC-1118 (Lalvin)"],
    suggestedAdditives: [
      { name: "Potassium Metabisulfite", amount: "50 ppm", timing: "pre_fermentation" },
      { name: "Pectic Enzyme", amount: "0.5 g/gal", timing: "pre_fermentation" },
      { name: "Fruit (berries, stone fruit, etc.)", amount: "1-3 lbs/gal", timing: "post_fermentation" },
    ],
    fermentationDays: { min: 14, max: 28 },
    agingNotes: "Fruit additions typically macerate 1-4 weeks post-fermentation.",
    tips: [
      "Add fruit after primary fermentation for best flavor retention",
      "Freeze fruit first to break down cell walls",
      "Consider both co-fermented (fruit at pitch) and post-ferment additions",
      "TTB note: non-apple/pear fruit will reclassify as wine",
    ],
  },
  {
    id: "botanical_hopped",
    name: "Hopped Cider",
    category: "botanical",
    bjcpCode: "C3B",
    description: "Cider with hop additions for aroma, flavor, and/or bitterness. Popular NW style. Can be dry-hopped or hop-bursted.",
    abvRange: { min: 5, max: 8 },
    sweetness: ["dry", "semi_dry"],
    carbonation: ["petillant", "sparkling"],
    ogRange: { min: 1.045, max: 1.065 },
    fgRange: { min: 0.998, max: 1.005 },
    tanninLevel: "low",
    suggestedAppleTypes: ["Clean, neutral base apples", "Golden Delicious", "Fuji"],
    suggestedYeasts: ["EC-1118 (Lalvin)", "AB-1 (SafCider)"],
    suggestedAdditives: [
      { name: "Potassium Metabisulfite", amount: "50 ppm", timing: "pre_fermentation" },
      { name: "Hops (Citra, Mosaic, Cascade)", amount: "1-2 oz/gal", timing: "post_fermentation" },
    ],
    fermentationDays: { min: 14, max: 21 },
    agingNotes: "Dry-hop for 3-7 days. Drink fresh for best hop character.",
    tips: [
      "Dry-hop post-fermentation for aroma (3-7 days)",
      "Aromatic hop varieties work best (Citra, Mosaic, Cascade, Galaxy)",
      "Keep cider dry to let hop character shine",
      "Drink fresh — hop aroma fades with age",
    ],
  },
  {
    id: "botanical_spiced",
    name: "Botanical / Spiced Cider",
    category: "botanical",
    bjcpCode: "C3B",
    description: "Cider with herbs, spices, or other botanicals. Includes seasonal spiced ciders, herbal ciders, and lavender/rosemary/ginger varieties.",
    abvRange: { min: 4, max: 8 },
    sweetness: ["dry", "semi_dry", "medium", "semi_sweet"],
    carbonation: ["still", "petillant", "sparkling"],
    ogRange: { min: 1.045, max: 1.065 },
    fgRange: { min: 0.998, max: 1.015 },
    tanninLevel: "low",
    suggestedAppleTypes: ["Neutral base apples", "Heritage varieties for complexity"],
    suggestedYeasts: ["D-47 (Lalvin)", "AB-1 (SafCider)"],
    suggestedAdditives: [
      { name: "Potassium Metabisulfite", amount: "50 ppm", timing: "pre_fermentation" },
      { name: "Botanicals (lavender, ginger, cinnamon, etc.)", amount: "varies", timing: "post_fermentation" },
    ],
    fermentationDays: { min: 14, max: 28 },
    tips: [
      "Add botanicals post-fermentation — start with less, add more if needed",
      "Taste daily when macerating — spices can overpower quickly",
      "Lavender: 0.5-1 oz per 5 gal, steep 2-3 days",
      "Ginger: 1-2 oz per gal, steep 3-5 days",
    ],
  },

  // ============================================
  // BARREL-AGED
  // ============================================
  {
    id: "barrel_aged",
    name: "Barrel-Aged Cider",
    category: "specialty",
    description: "Cider aged in wooden barrels (bourbon, rye, wine, calvados, etc.). Wood character is a significant part of the flavor profile.",
    abvRange: { min: 5, max: 12 },
    sweetness: ["dry", "semi_dry", "medium"],
    carbonation: ["still", "petillant"],
    ogRange: { min: 1.050, max: 1.075 },
    fgRange: { min: 0.998, max: 1.010 },
    tanninLevel: "high",
    suggestedAppleTypes: ["High-tannin heritage varieties", "Kingston Black", "Dabinett", "Yarlington Mill"],
    suggestedYeasts: ["D-47 (Lalvin)", "Wild/spontaneous"],
    suggestedAdditives: [
      { name: "Potassium Metabisulfite", amount: "25-50 ppm", timing: "pre_fermentation" },
    ],
    fermentationDays: { min: 21, max: 60 },
    agingNotes: "Age 3-12+ months in barrel. Check monthly. Top off regularly to prevent oxidation. Angel's share: 2-5% per year.",
    tips: [
      "Use neutral barrels (2nd+ use) for subtler wood character",
      "Ex-bourbon, ex-rye, and ex-calvados barrels are popular",
      "Monitor for brett/VA — barrel-aged ciders walk a fine line",
      "Still or pétillant carbonation traditional for barrel-aged",
    ],
  },

  // ============================================
  // STRONG CIDER (BJCP C2)
  // ============================================
  {
    id: "ice_cider",
    name: "Ice Cider",
    category: "strong",
    bjcpCode: "C2B",
    description: "A concentrated, sweet cider made by freezing apple juice (cryo-concentration) before fermentation. Quebec specialty.",
    abvRange: { min: 7, max: 13 },
    sweetness: ["semi_sweet", "sweet"],
    carbonation: ["still"],
    ogRange: { min: 1.130, max: 1.180 },
    fgRange: { min: 1.040, max: 1.080 },
    tanninLevel: "low",
    suggestedAppleTypes: ["McIntosh", "Cortland", "High-sugar dessert apples"],
    suggestedYeasts: ["EC-1118 (Lalvin)", "K1-V1116 (Lalvin)"],
    suggestedAdditives: [
      { name: "Potassium Metabisulfite", amount: "75 ppm", timing: "pre_fermentation" },
    ],
    fermentationDays: { min: 60, max: 180 },
    agingNotes: "Fermentation is very slow due to high sugar. Ages well for years.",
    tips: [
      "Freeze juice to -15°C, then thaw slowly to collect concentrated must",
      "Target 30-40 Brix in concentrated must",
      "Very slow, cold fermentation (months, not weeks)",
      "Serve in small portions like dessert wine",
    ],
  },

  // ============================================
  // PERRY (BJCP C4)
  // ============================================
  {
    id: "perry",
    name: "Perry (Pear Cider)",
    category: "perry",
    bjcpCode: "C4",
    description: "Cider made from fermented pear juice. Can range from light and floral to rich and tannic depending on pear varieties.",
    abvRange: { min: 4, max: 8 },
    sweetness: ["dry", "semi_dry", "medium", "semi_sweet"],
    carbonation: ["still", "petillant", "sparkling"],
    ogRange: { min: 1.045, max: 1.070 },
    fgRange: { min: 0.998, max: 1.015 },
    tanninLevel: "varies",
    suggestedAppleTypes: ["Perry pears: Barnet, Blakeney Red, Hendre Huffcap", "Bartlett/Williams for table perry"],
    suggestedYeasts: ["D-47 (Lalvin)", "71B (Lalvin)"],
    suggestedAdditives: [
      { name: "Potassium Metabisulfite", amount: "50 ppm", timing: "pre_fermentation" },
      { name: "Pectic Enzyme", amount: "0.5 g/gal", timing: "pre_fermentation" },
    ],
    fermentationDays: { min: 14, max: 30 },
    tips: [
      "Perry pears are different from eating pears — higher tannin",
      "Pear juice is more susceptible to oxidation than apple",
      "Pectic enzyme is essential for clarity",
      "Perry can develop pear ester (ethyl decadienoate) — a desirable character",
    ],
  },

  // ============================================
  // FORTIFIED
  // ============================================
  {
    id: "pommeau",
    name: "Pommeau",
    category: "strong",
    description: "A blend of unfermented apple juice with apple brandy (calvados). A French-origin fortified cider aperitif.",
    abvRange: { min: 16, max: 20 },
    sweetness: ["semi_sweet", "sweet"],
    carbonation: ["still"],
    ogRange: { min: 1.070, max: 1.090 },
    fgRange: { min: 1.040, max: 1.070 },
    tanninLevel: "medium",
    suggestedAppleTypes: ["Heritage cider apples for juice", "Fresh-pressed, unfermented juice"],
    suggestedYeasts: ["None — brandy kills yeast and prevents fermentation"],
    suggestedAdditives: [
      { name: "Apple Brandy (calvados)", amount: "30-40% by volume", timing: "at_packaging" },
    ],
    fermentationDays: { min: 0, max: 0 },
    agingNotes: "Age 14-18 months in oak barrel. Some age 3+ years.",
    tips: [
      "Blend fresh juice (not fermented cider) with apple brandy",
      "Target 16-18% ABV in final blend",
      "Barrel aging is traditional and recommended",
      "The brandy stops fermentation, preserving natural sweetness",
    ],
  },
  {
    id: "cyser",
    name: "Cyser (Apple Mead)",
    category: "strong",
    description: "A melomel made with honey and apple juice. Combines mead and cider characteristics.",
    abvRange: { min: 8, max: 14 },
    sweetness: ["semi_dry", "medium", "semi_sweet", "sweet"],
    carbonation: ["still", "petillant"],
    ogRange: { min: 1.070, max: 1.120 },
    fgRange: { min: 1.000, max: 1.025 },
    tanninLevel: "low",
    suggestedAppleTypes: ["Any good cider apple", "Heritage varieties add complexity"],
    suggestedYeasts: ["D-47 (Lalvin)", "71B (Lalvin)", "K1-V1116 (Lalvin)"],
    suggestedAdditives: [
      { name: "Honey", amount: "2-4 lbs/gal", timing: "pre_fermentation" },
      { name: "Fermaid O", amount: "1 g/gal", timing: "during_fermentation" },
      { name: "Potassium Metabisulfite", amount: "50 ppm", timing: "pre_fermentation" },
    ],
    fermentationDays: { min: 30, max: 90 },
    agingNotes: "Benefits greatly from 6-12 months aging. Honey character mellows and integrates over time.",
    tips: [
      "Add honey to fresh juice before fermentation for best integration",
      "Honey fermentation requires extra nutrients (DAP or Fermaid O)",
      "TTB classifies cyser differently than standard cider",
      "Higher ABV versions need cold-tolerant yeasts",
    ],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getStyleById(id: string): CiderStyleDefinition | undefined {
  return CIDER_STYLES.find((s) => s.id === id);
}

export function getStylesByCategory(category: string): CiderStyleDefinition[] {
  return CIDER_STYLES.filter((s) => s.category === category);
}

export function getAllCategories(): string[] {
  return [...new Set(CIDER_STYLES.map((s) => s.category))];
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    traditional: "Traditional Cider",
    specialty: "Specialty",
    fruit: "Fruit Cider",
    botanical: "Botanical / Hopped",
    strong: "Strong / Fortified",
    perry: "Perry",
  };
  return labels[category] || category;
}
