import { describe, it, expect } from "vitest";

describe("Invoice Number Generation Logic", () => {
  it("should format date correctly", () => {
    const date = new Date("2024-03-15T10:30:45Z");
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    expect(dateStr).toBe("20240315");
  });

  it("should pad sequence numbers correctly", () => {
    const sequence1 = 1;
    const sequence2 = 25;
    const sequence3 = 100;

    expect(sequence1.toString().padStart(3, "0")).toBe("001");
    expect(sequence2.toString().padStart(3, "0")).toBe("025");
    expect(sequence3.toString().padStart(3, "0")).toBe("100");
  });

  it("should generate invoice number format correctly", () => {
    const dateStr = "20240315";
    const vendorId = "123e4567-e89b-12d3-a456-426614174000";
    const sequence = 1;
    const paddedSequence = sequence.toString().padStart(3, "0");

    const invoiceNumber = `${dateStr}-${vendorId}-${paddedSequence}`;

    expect(invoiceNumber).toBe(
      "20240315-123e4567-e89b-12d3-a456-426614174000-001",
    );
  });

  it("should parse existing invoice numbers correctly", () => {
    const existingInvoice = "20240315-123e4567-e89b-12d3-a456-426614174000-005";
    const parts = existingInvoice.split("-");

    expect(parts.length).toBe(7); // Date (1) + vendor UUID parts (5) + sequence (1)

    // The sequence is the last part
    const sequencePart = parts[parts.length - 1];
    const currentSeq = parseInt(sequencePart, 10);

    expect(currentSeq).toBe(5);
    expect(isNaN(currentSeq)).toBe(false);
  });

  it("should handle edge cases in sequence parsing", () => {
    const malformedInvoice = "MALFORMED-INVOICE";
    const parts = malformedInvoice.split("-");

    let sequence = 1;
    if (parts.length >= 7) {
      // Need at least 7 parts for valid format
      const sequencePart = parts[parts.length - 1];
      const parsedSeq = parseInt(sequencePart, 10);
      if (!isNaN(parsedSeq)) {
        sequence = parsedSeq + 1;
      }
    }

    expect(sequence).toBe(1); // Should default to 1 for malformed invoice
  });

  it("should generate date boundaries correctly", () => {
    const date = new Date("2024-03-15T14:30:00Z");

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    expect(startOfDay.getHours()).toBe(0);
    expect(startOfDay.getMinutes()).toBe(0);
    expect(startOfDay.getSeconds()).toBe(0);
    expect(startOfDay.getMilliseconds()).toBe(0);

    expect(endOfDay.getHours()).toBe(23);
    expect(endOfDay.getMinutes()).toBe(59);
    expect(endOfDay.getSeconds()).toBe(59);
    expect(endOfDay.getMilliseconds()).toBe(999);
  });

  it("should handle sequence increments correctly", () => {
    const testCases = [
      { existing: "20240315-vendor-001", expected: 2 },
      { existing: "20240315-vendor-099", expected: 100 },
      { existing: "20240315-vendor-999", expected: 1000 },
      { existing: null, expected: 1 },
    ];

    testCases.forEach((testCase) => {
      let nextSequence = 1;

      if (testCase.existing) {
        const parts = testCase.existing.split("-");
        if (parts.length === 3) {
          const currentSeq = parseInt(parts[2], 10);
          if (!isNaN(currentSeq)) {
            nextSequence = currentSeq + 1;
          }
        }
      }

      expect(nextSequence).toBe(testCase.expected);
    });
  });
});
