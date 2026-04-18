/**
 * Allows efficiently filtering log entries by the value of a single field.
 */
export class FieldValueIndex {
  entryNumbersByFieldValue: Map<string, Set<number>>;

  constructor() {
    this.entryNumbersByFieldValue = new Map();
  }

  addEntry(entryNumber: number, fieldValue: string) {
    const existingSet = this.entryNumbersByFieldValue.get(fieldValue);
    if (existingSet === undefined) {
      this.entryNumbersByFieldValue.set(fieldValue, new Set([entryNumber]));
    } else {
      existingSet.add(entryNumber);
    }
  }

  getEntryNumbersForValue(value: string): Set<number> {
    return this.entryNumbersByFieldValue.get(value) ?? new Set();
  }

  getSeenValues(): Set<string> {
    return new Set(this.entryNumbersByFieldValue.keys());
  }
}

if (import.meta.vitest) {
  const { expect, test } = import.meta.vitest;

  test("addEntry groups entry numbers by field value", () => {
    const index = new FieldValueIndex();
    index.addEntry(1, "a");
    index.addEntry(2, "a");
    index.addEntry(3, "b");

    expect(index.getEntryNumbersForValue("a")).toStrictEqual(new Set([1, 2]));
    expect(index.getEntryNumbersForValue("b")).toStrictEqual(new Set([3]));
    expect(index.getEntryNumbersForValue("missing")).toStrictEqual(new Set());
  });

  test("getSeenValues returns distinct field values", () => {
    const index = new FieldValueIndex();
    index.addEntry(1, "foo");
    index.addEntry(2, "bar");
    index.addEntry(3, "foo");

    expect(index.getSeenValues()).toStrictEqual(new Set(["foo", "bar"]));
  });
}
