import { open } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";

import type { NativeParseEvent } from "./parseNative";
import parseNativeFile from "./parseNative";

const testCases: { filename: string; expectedEvents: NativeParseEvent[] }[] = [
  {
    filename: "totallyEmpty.log",
    expectedEvents: [],
  },
  {
    filename: "emptyWithOneNewline.log",
    expectedEvents: [{ type: "entryComplete" }],
  },
  {
    filename: "textOnly.log",
    expectedEvents: [
      {
        type: "field",
        name: "__CURSOR",
        value:
          "s=739ad463348b4ceca5a9e69c95a3c93f;i=4ece7;b=6c7c6013a26343b29e964691ff25d04c;m=4fc72436e;t=4c508a72423d9;x=d3e5610681098c10;p=system.journal",
      },
      {
        type: "field",
        name: "__REALTIME_TIMESTAMP",
        value: "1342540861416409",
      },
      { type: "field", name: "__MONOTONIC_TIMESTAMP", value: "21415215982" },
      {
        type: "field",
        name: "_BOOT_ID",
        value: "6c7c6013a26343b29e964691ff25d04c",
      },
      { type: "field", name: "_TRANSPORT", value: "syslog" },
      { type: "field", name: "PRIORITY", value: "4" },
      { type: "field", name: "SYSLOG_FACILITY", value: "3" },
      { type: "field", name: "SYSLOG_IDENTIFIER", value: "gdm-password]" },
      { type: "field", name: "SYSLOG_PID", value: "587" },
      {
        type: "field",
        name: "MESSAGE",
        value:
          "AccountsService-DEBUG(+): ActUserManager: ignoring unspecified session '8' since it's not graphical: Success",
      },
      { type: "field", name: "_PID", value: "587" },
      { type: "field", name: "_UID", value: "0" },
      { type: "field", name: "_GID", value: "500" },
      { type: "field", name: "_COMM", value: "gdm-session-wor" },
      { type: "field", name: "_EXE", value: "/usr/libexec/gdm-session-worker" },
      {
        type: "field",
        name: "_CMDLINE",
        value: "gdm-session-worker [pam/gdm-password]",
      },
      { type: "field", name: "_AUDIT_SESSION", value: "2" },
      { type: "field", name: "_AUDIT_LOGINUID", value: "500" },
      { type: "field", name: "_SYSTEMD_CGROUP", value: "/user/lennart/2" },
      { type: "field", name: "_SYSTEMD_SESSION", value: "2" },
      {
        type: "field",
        name: "_SELINUX_CONTEXT",
        value: "system_u:system_r:xdm_t:s0-s0:c0.c1023",
      },
      {
        type: "field",
        name: "_SOURCE_REALTIME_TIMESTAMP",
        value: "1342540861413961",
      },
      {
        type: "field",
        name: "_MACHINE_ID",
        value: "a91663387a90b89f185d4e860000001a",
      },
      { type: "field", name: "_HOSTNAME", value: "epsilon" },

      { type: "entryComplete" },

      {
        type: "field",
        name: "__CURSOR",
        value:
          "s=739ad463348b4ceca5a9e69c95a3c93f;i=4ece8;b=6c7c6013a26343b29e964691ff25d04c;m=4fc72572f;t=4c508a7243799;x=68597058a89b7246;p=system.journal",
      },
      {
        type: "field",
        name: "__REALTIME_TIMESTAMP",
        value: "1342540861421465",
      },
      { type: "field", name: "__MONOTONIC_TIMESTAMP", value: "21415221039" },
      {
        type: "field",
        name: "_BOOT_ID",
        value: "6c7c6013a26343b29e964691ff25d04c",
      },
      { type: "field", name: "_TRANSPORT", value: "syslog" },
      { type: "field", name: "PRIORITY", value: "6" },
      { type: "field", name: "SYSLOG_FACILITY", value: "9" },
      { type: "field", name: "SYSLOG_IDENTIFIER", value: "/USR/SBIN/CROND" },
      { type: "field", name: "SYSLOG_PID", value: "8278" },
      {
        type: "field",
        name: "MESSAGE",
        value: "(root) CMD (run-parts /etc/cron.hourly)",
      },
      { type: "field", name: "_PID", value: "8278" },
      { type: "field", name: "_UID", value: "0" },
      { type: "field", name: "_GID", value: "0" },
      { type: "field", name: "_COMM", value: "run-parts" },
      { type: "field", name: "_EXE", value: "/usr/bin/bash" },
      {
        type: "field",
        name: "_CMDLINE",
        value: "/bin/bash /bin/run-parts /etc/cron.hourly",
      },
      { type: "field", name: "_AUDIT_SESSION", value: "8" },
      { type: "field", name: "_AUDIT_LOGINUID", value: "0" },
      { type: "field", name: "_SYSTEMD_CGROUP", value: "/user/root/8" },
      { type: "field", name: "_SYSTEMD_SESSION", value: "8" },
      {
        type: "field",
        name: "_SELINUX_CONTEXT",
        value: "system_u:system_r:crond_t:s0-s0:c0.c1023",
      },
      {
        type: "field",
        name: "_SOURCE_REALTIME_TIMESTAMP",
        value: "1342540861416351",
      },
      {
        type: "field",
        name: "_MACHINE_ID",
        value: "a91663387a90b89f185d4e860000001a",
      },
      { type: "field", name: "_HOSTNAME", value: "epsilon" },
    ],
  },

  {
    filename: "fieldWithNewline.log",
    expectedEvents: [
      {
        type: "field",
        name: "__CURSOR",
        value:
          "s=bcce4fb8ffcb40e9a6e05eee8b7831bf;i=5ef603;b=ec25d6795f0645619ddac9afdef453ee;m=545242e7049;t=50f1202",
      },
      {
        type: "field",
        name: "__REALTIME_TIMESTAMP",
        value: "1423944916375353",
      },
      { type: "field", name: "__MONOTONIC_TIMESTAMP", value: "5794517905481" },
      {
        type: "field",
        name: "_BOOT_ID",
        value: "ec25d6795f0645619ddac9afdef453ee",
      },
      { type: "field", name: "_TRANSPORT", value: "journal" },
      { type: "field", name: "_UID", value: "1001" },
      { type: "field", name: "_GID", value: "1001" },
      { type: "field", name: "_CAP_EFFECTIVE", value: "0" },
      { type: "field", name: "_SYSTEMD_OWNER_UID", value: "1001" },
      { type: "field", name: "_SYSTEMD_SLICE", value: "user-1001.slice" },
      {
        type: "field",
        name: "_MACHINE_ID",
        value: "5833158886a8445e801d437313d25eff",
      },
      { type: "field", name: "_HOSTNAME", value: "bupkis" },
      { type: "field", name: "_AUDIT_LOGINUID", value: "1001" },
      {
        type: "field",
        name: "_SELINUX_CONTEXT",
        value: "unconfined_u:unconfined_r:unconfined_t:s0-s0:c0.c1023",
      },
      { type: "field", name: "CODE_LINE", value: "1" },
      { type: "field", name: "CODE_FUNC", value: "<module>" },
      { type: "field", name: "SYSLOG_IDENTIFIER", value: "python3" },
      { type: "field", name: "_COMM", value: "python3" },
      { type: "field", name: "_EXE", value: "/usr/bin/python3.4" },
      { type: "field", name: "_AUDIT_SESSION", value: "35898" },
      {
        type: "field",
        name: "_SYSTEMD_CGROUP",
        value: "/user.slice/user-1001.slice/session-35898.scope",
      },
      { type: "field", name: "_SYSTEMD_SESSION", value: "35898" },
      { type: "field", name: "_SYSTEMD_UNIT", value: "session-35898.scope" },
      { type: "field", name: "MESSAGE", value: "foo\nbar" },
      { type: "field", name: "CODE_FILE", value: "<string>" },
      { type: "field", name: "_PID", value: "16853" },
      {
        type: "field",
        name: "_CMDLINE",
        value:
          'python3 -c from systemd import journal; journal.send("foo\\nbar")',
      },
      {
        type: "field",
        name: "_SOURCE_REALTIME_TIMESTAMP",
        value: "1423944916372858",
      },
    ],
  },

  {
    filename: "unicode.log",
    expectedEvents: [
      { type: "field", name: "DUMPLING_ON_ONE_LINE", value: "🥟" },
      { type: "field", name: "DUMPLINGS_ON_THREE_LINES", value: "🥟\n🥟\n🥟" },
    ],
  },
];

test.each(testCases)(
  "parse $filename",
  async ({ filename, expectedEvents }) => {
    const fixturePath = path.join(__dirname, "testFixtures", filename);
    const file = await open(fixturePath);
    try {
      // @ts-expect-error: file.readableWebStream() is experimental in our Node version
      // and TypeScript doesn't seem to recognize its existence.
      const stream: ReadableStream<Uint8Array> = file.readableWebStream({
        type: "bytes",
      });
      const events: NativeParseEvent[] = [];
      for await (const event of parseNativeFile(stream)) {
        events.push(event);
      }
      expect(events).toStrictEqual(expectedEvents);
    } finally {
      file.close();
    }
  },
);
