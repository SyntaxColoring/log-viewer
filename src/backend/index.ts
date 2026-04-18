/**
 * Public exports for the backend.
 *
 * The backend is responsible for efficiently parsing and searching log files.
 */

export { buildLogSearcher } from "./logAccess";
export type { LogSearcher } from "./logAccess";

export { UNDERLYING_RAW_FIELDS } from "./logEntry";
export type { LogEntry, SyslogPriority } from "./logEntry";

export { findAllMatches } from "./textSearch/query";
