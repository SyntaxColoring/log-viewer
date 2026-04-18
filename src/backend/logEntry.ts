export const BINARY_DATA_PLACEHOLDER = "<binary data>";

export interface LogEntry {
  /** The entry number in the original log file (before any filters), 0 being the oldest. */
  entryNumber: number;
  rawFields: Map<string, string>;
  validatedFields: ValidatedFields;
}

export interface ValidatedFields {
  timestamp: Date | null;
  priority: SyslogPriority | null;
  unit: string | null;
  syslogIdentifier: string | null;
  message: string;
}

export const UNDERLYING_RAW_FIELDS: Record<keyof ValidatedFields, string> = {
  timestamp: "__REALTIME_TIMESTAMP",
  priority: "PRIORITY",
  unit: "_SYSTEMD_UNIT",
  syslogIdentifier: "SYSLOG_IDENTIFIER",
  message: "MESSAGE",
};

export type SyslogPriority = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function getValidatedFields(
  rawFields: Map<string, string>,
): ValidatedFields {
  return {
    timestamp: getTimestamp(rawFields),
    priority: getPriority(rawFields),
    unit: getUnit(rawFields),
    syslogIdentifier: getSyslogIdentifier(rawFields),
    message: getMessage(rawFields),
  };
}

function getTimestamp(rawFields: Map<string, string>): Date | null {
  const rawValue = rawFields.get(UNDERLYING_RAW_FIELDS.timestamp);
  if (rawValue === undefined) return null;
  const epochMicroseconds = Number.parseInt(rawValue, 10);
  const date = new Date(epochMicroseconds / 1000);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function getPriority(rawFields: Map<string, string>): SyslogPriority | null {
  const rawValue = rawFields.get(UNDERLYING_RAW_FIELDS.priority);
  if (rawValue === undefined) return null;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 7) return null;
  return parsed as SyslogPriority;
}

function getUnit(rawFields: Map<string, string>): string | null {
  return rawFields.get(UNDERLYING_RAW_FIELDS.unit) ?? null;
}

function getSyslogIdentifier(rawFields: Map<string, string>): string | null {
  return rawFields.get(UNDERLYING_RAW_FIELDS.syslogIdentifier) ?? null;
}

function getMessage(rawFields: Map<string, string>): string {
  // Missing messages fall back to "" instead of null like the other fields do,
  // to make sure it's handled the same way across n-gram indexing, substring search, etc.
  return rawFields.get(UNDERLYING_RAW_FIELDS.message) ?? "";
}

if (import.meta.vitest) {
  const { describe, expect, test } = import.meta.vitest;

  describe("logEntry field validation", () => {
    test("returns validated fields for fully valid raw fields", () => {
      const rawFields = new Map<string, string>([
        ["__REALTIME_TIMESTAMP", "1700000000000000"],
        ["PRIORITY", "6"],
        ["_SYSTEMD_UNIT", "ssh.service"],
        ["SYSLOG_IDENTIFIER", "sshd"],
        ["MESSAGE", BINARY_DATA_PLACEHOLDER],
      ]);

      expect(getValidatedFields(rawFields)).toStrictEqual({
        timestamp: new Date(1700000000000000 / 1000),
        priority: 6,
        unit: "ssh.service",
        syslogIdentifier: "sshd",
        message: BINARY_DATA_PLACEHOLDER,
      });
    });

    test("uses null for missing fields and empty string for message", () => {
      const rawFields = new Map<string, string>();

      expect(getValidatedFields(rawFields)).toStrictEqual({
        timestamp: null,
        priority: null,
        unit: null,
        syslogIdentifier: null,
        message: "",
      });
    });

    test("uses null for invalid timestamp", () => {
      const rawFields = new Map<string, string>([
        ["__REALTIME_TIMESTAMP", "not-a-timestamp"],
      ]);

      expect(getValidatedFields(rawFields).timestamp).toStrictEqual(null);
    });

    describe("priority validation", () => {
      test.each([
        ["0", 0],
        ["7", 7],
        ["-1", null],
        ["8", null],
        ["invalid", null],
      ] as const)("parses PRIORITY=%s as %s", (priority, expected) => {
        const rawFields = new Map<string, string>([
          [UNDERLYING_RAW_FIELDS.priority, priority],
        ]);
        expect(getValidatedFields(rawFields).priority).toStrictEqual(expected);
      });
    });
  });
}
