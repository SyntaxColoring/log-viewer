import { describe, expect, test } from "vitest";

import {
  BINARY_DATA_PLACEHOLDER,
  getValidatedFields,
  UNDERLYING_RAW_FIELDS,
} from "./logEntry";

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
