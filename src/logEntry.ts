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
