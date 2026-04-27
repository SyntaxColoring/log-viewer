import React from "react";

import {
  type LogEntry,
  type LogSearcher,
  type SyslogPriority,
} from "@/backend";

import clsx from "clsx";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type PropsWithChildren,
  type Ref,
} from "react";
import { useMove } from "react-aria";

import { Virtuoso, type ListItem, type VirtuosoHandle } from "react-virtuoso";

import { binarySearch } from "../util/binarySearch";
import { clamp } from "../util/clamp";
import styles from "./LogView.module.css";

const GRID_TEMPLATE_COLUMNS_VAR = "--grid-template-columns";
const CONSUME_GRID_TEMPLATE_COLUMNS: CSSProperties = {
  gridTemplateColumns: `var(${GRID_TEMPLATE_COLUMNS_VAR})`,
};

/**
 * How many rows beyond the currently-visible range we eagerly load and keep cached.
 */
const PRELOAD_DISTANCE = 200;

/**
 * When the visible range comes within this many rows of either edge of the
 * currently-cached range, trigger a new load to extend the cache.
 */
const TRIGGER_DISTANCE = 50;

const DEFAULT_COLUMN_WIDTH = 100;
const MIN_COLUMN_WIDTH = 20;

export type LogViewProps = {
  /**
   * All the log entries to display.
   * Only a subset of these will actually be rendered at any given time.
   */
  entryNumbers: number[];
  selectedEntryNumber: number | null;
  onSelectedEntryNumberChange?: (newSelectedEntryNumber: number) => void;
  logSearcher: LogSearcher;
  /** The currently searched-for text, for highlighting matches. */
  query: string | null;
  /** Which columns to display (in display order). */
  columns: LogViewColumn[];
  ref?: Ref<LogViewHandle>;
};

export interface LogViewHandle {
  focus: () => void;
  isFocused: () => boolean;
}

export interface LogViewColumn {
  field: string;
  header: string;
  render: (context: LogViewColumnRenderContext) => JSX.Element;
}

export interface LogViewColumnRenderContext {
  entry: LogEntry;
  rowIndex: number;
  query: string | null;
}

export function LogView({
  entryNumbers,
  selectedEntryNumber,
  query,
  columns,
  logSearcher,
  onSelectedEntryNumberChange,
  ref,
}: LogViewProps): React.JSX.Element {
  const tableBodyRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        tableBodyRef.current?.focus();
      },
      isFocused: () => document.activeElement === tableBodyRef.current,
    }),
    [],
  );

  const { getColumnWidth, setColumnWidth } = useColumnWidths();

  const style = {
    [GRID_TEMPLATE_COLUMNS_VAR]: getGridTemplateColumns(
      columns,
      getColumnWidth,
    ),
  } as CSSProperties;

  return (
    <div className={styles.logView} style={style}>
      <Header columns={columns} setColumnWidth={setColumnWidth} />
      <Body
        tableBodyRef={tableBodyRef}
        entryNumbers={entryNumbers}
        selectedEntryNumber={selectedEntryNumber}
        logSearcher={logSearcher}
        columns={columns}
        query={query}
        onSelectedEntryNumberChange={onSelectedEntryNumberChange}
      />
    </div>
  );
}

interface HeaderProps {
  columns: LogViewColumn[];
  setColumnWidth: UseColumnWidthsResult["setColumnWidth"];
}

function Header(props: HeaderProps): JSX.Element {
  const { columns, setColumnWidth } = props;
  return (
    <div className={styles.thead}>
      <div className={styles.tr} style={CONSUME_GRID_TEMPLATE_COLUMNS}>
        {columns.map((column, index) => (
          <HeaderCell
            key={column.field}
            text={column.header}
            isResizable={index < columns.length - 1}
            onResizeDrag={(dragAmount) =>
              setColumnWidth(
                column.field,
                (currentWidth) => currentWidth + dragAmount,
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

interface HeaderCellProps {
  text: string;
  isResizable: boolean;
  onResizeDrag: (dragAmount: number) => void;
}

function HeaderCell(props: HeaderCellProps): JSX.Element {
  const { text, isResizable, onResizeDrag } = props;

  return (
    <div
      className={clsx(
        styles.th,
        styles.ellipsize,
        isResizable && styles.resizable,
      )}
      title={text}
    >
      {text}
      {isResizable && <Resizer onDrag={onResizeDrag} />}
    </div>
  );
}

function Resizer({
  onDrag,
}: {
  onDrag?: (dragAmount: number) => void;
}): JSX.Element {
  const moveResult = useMove({ onMove: (event) => onDrag?.(event.deltaX) });
  return (
    <div className={styles.resizer} tabIndex={0} {...moveResult.moveProps} />
  );
}

interface BodyProps {
  tableBodyRef: React.RefObject<HTMLDivElement | null>;
  entryNumbers: number[];
  selectedEntryNumber: number | null;
  logSearcher: LogSearcher;
  columns: LogViewColumn[];
  query: string | null;
  /** Called when the selection changes for any reason (keyboard or pointer). */
  onSelectedEntryNumberChange?: (newSelectedEntryNumber: number) => void;
}

function Body(props: BodyProps): JSX.Element {
  const {
    tableBodyRef,
    entryNumbers,
    selectedEntryNumber,
    logSearcher,
    columns,
    query,
    onSelectedEntryNumberChange,
  } = props;
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const virtuosoScrollerRef = useRef<HTMLElement | Window | null>(null);
  const itemsRenderedRef = useRef<ListItem<unknown>[]>([]);

  const selectedVirtualizedIndex = React.useMemo(
    () =>
      selectedEntryNumber !== null
        ? binarySearch(entryNumbers, selectedEntryNumber)
        : null,
    [entryNumbers, selectedEntryNumber],
  );

  const { getEntry, setVisibleVirtualizedRange } = useBatchedEntryLoader(
    logSearcher,
    entryNumbers,
  );

  const renderItemContent = useCallback(
    (virtualizedIndex: number) => {
      const entryNumber = entryNumbers[virtualizedIndex];
      return (
        <EntryRow
          rowIndex={virtualizedIndex}
          entry={getEntry(virtualizedIndex)}
          columns={columns}
          query={query}
          isSelected={selectedVirtualizedIndex === virtualizedIndex}
          onClick={() => onSelectedEntryNumberChange?.(entryNumber)}
        />
      );
    },
    [
      columns,
      entryNumbers,
      getEntry,
      onSelectedEntryNumberChange,
      query,
      selectedVirtualizedIndex,
    ],
  );

  const handleItemsRendered = useCallback(
    (items: ListItem<unknown>[]) => {
      itemsRenderedRef.current = items;
      if (items.length === 0) {
        setVisibleVirtualizedRange(null);
      } else {
        setVisibleVirtualizedRange({
          firstVirtualizedIndex: items[0].index,
          lastVirtualizedIndex: items[items.length - 1].index,
        });
      }
    },
    [setVisibleVirtualizedRange],
  );

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (
      !isNavigationKey(event.key) ||
      virtuosoScrollerRef.current === null ||
      // For type checker appeasement only. It should never be instanceof Window.
      virtuosoScrollerRef.current instanceof Window
    ) {
      return;
    }

    event.preventDefault();

    const newSelectedRowIndex = getKeyboardNavigationTarget(
      entryNumbers.length,
      selectedVirtualizedIndex,
      getViewedRowsInfo(itemsRenderedRef.current, virtuosoScrollerRef.current),
      event.key,
    );
    if (newSelectedRowIndex !== null) {
      virtuosoRef.current?.scrollIntoView({ index: newSelectedRowIndex });
      onSelectedEntryNumberChange?.(entryNumbers[newSelectedRowIndex]);
    }
  }

  return (
    <div
      ref={tableBodyRef}
      className={styles.tbody}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <Virtuoso
        ref={virtuosoRef}
        scrollerRef={(scroller) => {
          virtuosoScrollerRef.current = scroller;
        }}
        totalCount={entryNumbers.length}
        computeItemKey={(virtualizedIndex) => entryNumbers[virtualizedIndex]}
        itemContent={renderItemContent}
        itemsRendered={handleItemsRendered}
        /* Virtuoso adds a tab-stop by default ({0}). Disable that, since we add our own. */
        tabIndex={-1}
      />
    </div>
  );
}

interface LoadedEntryProps {
  data: LogEntry;
  columns: LogViewColumn[];
  isSelected: boolean;
  query: string | null;
  rowIndex: number;
  onClick?: () => void;
}

interface EntryRowProps {
  rowIndex: number;
  entry: LogEntry | null;
  columns: LogViewColumn[];
  query: string | null;
  isSelected: boolean;
  onClick?: () => void;
}

function EntryRow(props: EntryRowProps): JSX.Element {
  const { rowIndex, entry, columns, query, isSelected, onClick } = props;
  if (entry === null) {
    return <UnloadedEntry isSelected={isSelected} onClick={onClick} />;
  }
  return (
    <LoadedEntry
      data={entry}
      columns={columns}
      query={query}
      rowIndex={rowIndex}
      isSelected={isSelected}
      onClick={onClick}
    />
  );
}

function LoadedEntry(props: LoadedEntryProps): JSX.Element {
  const { isSelected, query, data, columns, rowIndex, onClick } = props;
  const priorityClass = getPriorityClass(data.validatedFields.priority);
  return (
    // We're setting the column widths by CSS variable here instead of via CSS subgrid
    // because react-virtuoso makes it difficult to propagate subgrids all the way down
    // through its intermediate components.
    <div
      className={clsx(styles.tr, priorityClass, isSelected && styles.selected)}
      style={CONSUME_GRID_TEMPLATE_COLUMNS}
      onClick={onClick}
    >
      {columns.map((column) => {
        const renderContext = { entry: data, rowIndex, query };
        return (
          <BodyCell key={column.field}>{column.render(renderContext)}</BodyCell>
        );
      })}
    </div>
  );
}

function getPriorityClass(priorityCode: SyslogPriority | null): string {
  if (priorityCode === null) return styles.priorityInfo;
  return [
    styles.priorityEmerg,
    styles.priorityAlert,
    styles.priorityCrit,
    styles.priorityErr,
    styles.priorityWarning,
    styles.priorityNotice,
    styles.priorityInfo,
    styles.priorityDebug,
  ][priorityCode];
}

interface UnloadedEntryProps {
  isSelected: boolean;
  onClick?: () => void;
}

function UnloadedEntry(props: UnloadedEntryProps): JSX.Element {
  const { isSelected, onClick } = props;
  return (
    <div
      className={clsx(styles.tr, isSelected && styles.selected)}
      style={CONSUME_GRID_TEMPLATE_COLUMNS}
      onClick={onClick}
    >
      <div className={clsx(styles.td, styles.spanAllColumns)}>loading...</div>
    </div>
  );
}

interface VirtualizedRange {
  firstVirtualizedIndex: number;
  lastVirtualizedIndex: number;
}

interface UseBatchedEntryLoaderResult {
  /** Returns the loaded `LogEntry` for the given virtualized index, or `null` if not yet loaded. */
  getEntry: (virtualizedIndex: number) => LogEntry | null;
  /**
   * Should be called whenever the set of currently-rendered rows changes.
   * Drives both eager preloading and cache trimming.
   */
  setVisibleVirtualizedRange: (range: VirtualizedRange | null) => void;
}

/**
 * Loads `LogEntry`s in batches around the currently-visible row range.
 *
 * Batching: when the visible range comes within {@link TRIGGER_DISTANCE} rows
 * of the cached range's edge, we issue a single batched request that covers
 * the visible range plus {@link PRELOAD_DISTANCE} rows on each side. Anything
 * outside that window is discarded from the cache.
 *
 * Throttling: at most one request is in flight at a time. If the visible
 * range moves while a request is in flight, we remember the latest desired
 * range and issue a follow-up request as soon as the in-flight one settles.
 * This guarantees the cache eventually catches up to the current position
 * even after fast scrolling. Later queries clobber earlier ones (when an
 * in-flight load returns and its data is no longer near the visible range,
 * we keep none of it and immediately dispatch a fresh load).
 *
 * Race-safety: when the inputs (`logSearcher` or `entryNumbers`) change, the
 * cache is cleared synchronously during render so that stale data from a
 * previous filter set is never displayed. In-flight results from before the
 * change are discarded by comparing against the latest tracked inputs.
 */
function useBatchedEntryLoader(
  logSearcher: LogSearcher,
  entryNumbers: number[],
): UseBatchedEntryLoaderResult {
  const [cache, setCache] = useState<Map<number, LogEntry>>(() => new Map());

  // The loader is held in React state (rather than a ref) so we can detect
  // input changes during render and synchronously swap it out. This is
  // critical for race-safety: it ensures that an in-flight load from the
  // previous inputs cannot commit stale data into `cache` after the inputs
  // change. We dispose the old loader inline (just toggling a boolean flag,
  // no side effects) so that any pending async resolution becomes a no-op.
  const [loader, setLoader] = useState<BatchedEntryLoader>(
    () => new BatchedEntryLoader(logSearcher, entryNumbers, setCache),
  );
  if (
    loader.logSearcher !== logSearcher ||
    loader.entryNumbers !== entryNumbers
  ) {
    loader.dispose();
    setLoader(new BatchedEntryLoader(logSearcher, entryNumbers, setCache));
    setCache(new Map());
  }

  // Dispose the loader on unmount so any pending async won't try to setState
  // after the component is gone. (Disposal on input change is handled above.)
  useEffect(() => {
    return () => {
      loader.dispose();
    };
  }, [loader]);

  const setVisibleVirtualizedRange = useCallback(
    (range: VirtualizedRange | null) => {
      loader.setVisibleRange(range);
    },
    [loader],
  );

  const getEntry = useCallback(
    (virtualizedIndex: number) => cache.get(virtualizedIndex) ?? null,
    [cache],
  );

  return { getEntry, setVisibleVirtualizedRange };
}

/**
 * Imperative state machine for batched, throttled, race-safe entry loading.
 * Owned by {@link useBatchedEntryLoader}; instantiated fresh whenever the
 * `LogSearcher` or `entryNumbers` change so that earlier loads are
 * effectively canceled.
 */
class BatchedEntryLoader {
  readonly logSearcher: LogSearcher;
  readonly entryNumbers: number[];
  private readonly setCache: (cache: Map<number, LogEntry>) => void;
  private visibleRange: VirtualizedRange | null = null;
  private cachedRange: VirtualizedRange | null = null;
  private inFlight = false;
  private disposed = false;

  constructor(
    logSearcher: LogSearcher,
    entryNumbers: number[],
    setCache: (cache: Map<number, LogEntry>) => void,
  ) {
    this.logSearcher = logSearcher;
    this.entryNumbers = entryNumbers;
    this.setCache = setCache;
  }

  dispose(): void {
    this.disposed = true;
  }

  setVisibleRange(range: VirtualizedRange | null): void {
    this.visibleRange = range;
    this.maybeStartLoad();
  }

  private maybeStartLoad(): void {
    if (this.disposed) return;
    if (this.inFlight) return;
    const visible = this.visibleRange;
    if (visible === null) return;
    if (this.entryNumbers.length === 0) return;

    const cached = this.cachedRange;
    const needsLoad =
      cached === null ||
      visible.firstVirtualizedIndex - cached.firstVirtualizedIndex <
        TRIGGER_DISTANCE ||
      cached.lastVirtualizedIndex - visible.lastVirtualizedIndex <
        TRIGGER_DISTANCE ||
      // The visible range escaped the cache entirely (e.g. fast scroll).
      visible.lastVirtualizedIndex < cached.firstVirtualizedIndex ||
      visible.firstVirtualizedIndex > cached.lastVirtualizedIndex;
    if (!needsLoad) return;

    const desired = clampRange(
      {
        firstVirtualizedIndex: visible.firstVirtualizedIndex - PRELOAD_DISTANCE,
        lastVirtualizedIndex: visible.lastVirtualizedIndex + PRELOAD_DISTANCE,
      },
      0,
      this.entryNumbers.length - 1,
    );

    const indicesToLoad: number[] = [];
    const entryNumbersToLoad: number[] = [];
    for (
      let i = desired.firstVirtualizedIndex;
      i <= desired.lastVirtualizedIndex;
      i++
    ) {
      indicesToLoad.push(i);
      entryNumbersToLoad.push(this.entryNumbers[i]);
    }

    this.inFlight = true;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      let loadedEntries: LogEntry[] | null = null;
      try {
        loadedEntries = await this.logSearcher.getEntries(entryNumbersToLoad);
      } finally {
        this.inFlight = false;
      }

      if (this.disposed || loadedEntries === null) {
        return;
      }

      // The visible range may have shifted while we were loading. Trim the
      // accepted entries to {@link PRELOAD_DISTANCE} of the *current* visible
      // range so we don't retain far-away stale data. If the visible range
      // moved entirely outside `desired` (a fast scroll), we keep none of
      // these entries; the recursive `maybeStartLoad()` below will then fire
      // a fresh request for the new position. This is what implements
      // "later queries clobber earlier ones".
      const currentVisible = this.visibleRange;
      const trimRange =
        currentVisible === null
          ? null
          : clampRange(
              {
                firstVirtualizedIndex:
                  currentVisible.firstVirtualizedIndex - PRELOAD_DISTANCE,
                lastVirtualizedIndex:
                  currentVisible.lastVirtualizedIndex + PRELOAD_DISTANCE,
              },
              0,
              this.entryNumbers.length - 1,
            );

      const newCache = new Map<number, LogEntry>();
      let firstAccepted = Infinity;
      let lastAccepted = -Infinity;
      if (trimRange !== null) {
        for (let i = 0; i < indicesToLoad.length; i++) {
          const virtualizedIndex = indicesToLoad[i];
          if (
            virtualizedIndex >= trimRange.firstVirtualizedIndex &&
            virtualizedIndex <= trimRange.lastVirtualizedIndex
          ) {
            newCache.set(virtualizedIndex, loadedEntries[i]);
            if (virtualizedIndex < firstAccepted)
              firstAccepted = virtualizedIndex;
            if (virtualizedIndex > lastAccepted)
              lastAccepted = virtualizedIndex;
          }
        }
      }

      this.cachedRange =
        newCache.size === 0
          ? null
          : {
              firstVirtualizedIndex: firstAccepted,
              lastVirtualizedIndex: lastAccepted,
            };
      this.setCache(newCache);

      // Always re-evaluate after a load settles. Even if we kept nothing,
      // this gets the next request started so the cache catches up to the
      // current scroll position.
      this.maybeStartLoad();
    })();
  }
}

function clampRange(
  range: VirtualizedRange,
  min: number,
  max: number,
): VirtualizedRange {
  return {
    firstVirtualizedIndex: clamp(range.firstVirtualizedIndex, min, max),
    lastVirtualizedIndex: clamp(range.lastVirtualizedIndex, min, max),
  };
}

function BodyCell(
  props: PropsWithChildren<{
    mono?: boolean;
    span?: number;
  }>,
): JSX.Element {
  const { mono, span = 1, children } = props;
  return (
    <div
      className={clsx(styles.td, mono && styles.mono, styles.ellipsize)}
      style={{ gridColumn: `span ${span}` }}
    >
      {children}
    </div>
  );
}

interface UseColumnWidthsResult {
  getColumnWidth: (column: LogViewColumn["field"]) => number;
  setColumnWidth: (
    column: LogViewColumn["field"],
    setWidth: (previousWidth: number) => number,
  ) => void;
}

function useColumnWidths(): UseColumnWidthsResult {
  const [columnWidths, setColumnWidths] = useState<
    Map<LogViewColumn["field"], number>
  >(new Map());

  const getColumnWidth = useCallback(
    (column: LogViewColumn["field"]) => {
      return columnWidths.get(column) ?? DEFAULT_COLUMN_WIDTH;
    },
    [columnWidths],
  );

  const setColumnWidth = useCallback(
    (
      column: LogViewColumn["field"],
      getNewWidth: (currentWidth: number) => number,
    ) => {
      setColumnWidths((current) => {
        const currentWidthForColumn =
          current.get(column) ?? DEFAULT_COLUMN_WIDTH;
        const newWidthForColumn = Math.max(
          getNewWidth(currentWidthForColumn),
          MIN_COLUMN_WIDTH,
        );
        const newWidths = new Map(current);
        newWidths.set(column, newWidthForColumn);
        return newWidths;
      });
    },
    [setColumnWidths],
  );

  return { getColumnWidth, setColumnWidth };
}

function getGridTemplateColumns(
  columns: LogViewColumn[],
  getColumnWidth: (column: LogViewColumn["field"]) => number,
): string {
  return (
    columns
      .slice(0, -1)
      .map((column) => `${getColumnWidth(column.field)}px`)
      .join(" ") + ` minmax(${MIN_COLUMN_WIDTH}px, 1fr)`
  );
}

const NAVIGATION_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
] as const;
type NavigationKey = (typeof NAVIGATION_KEYS)[number];

function isNavigationKey(key: string): key is NavigationKey {
  return NAVIGATION_KEYS.includes(key as NavigationKey);
}

/**
 * Returns the row index that should be selected in response to a keyboard event,
 * or null if the event should not cause a selection change.
 */
function getKeyboardNavigationTarget(
  rowCount: number,
  selectedRowIndex: number | null,
  viewedRowsInfo: ViewedRowsInfo,
  key: NavigationKey,
): number | null {
  if (rowCount === 0) return null;

  const first = 0;
  const last = rowCount - 1;

  switch (key) {
    case "ArrowUp": {
      return selectedRowIndex === null
        ? last
        : Math.max(first, selectedRowIndex - 1);
    }
    case "ArrowDown": {
      return selectedRowIndex === null
        ? first
        : Math.min(last, selectedRowIndex + 1);
    }
    case "Home": {
      return first;
    }
    case "End": {
      return last;
    }
    case "PageUp": {
      return getPageUpDownTargets(viewedRowsInfo, selectedRowIndex, rowCount)
        .pageUpVirtualizedIndex;
    }
    case "PageDown": {
      return getPageUpDownTargets(viewedRowsInfo, selectedRowIndex, rowCount)
        .pageDownVirtualizedIndex;
    }
    default: {
      key satisfies never;
      return null;
    }
  }
}

function getPageUpDownTargets(
  viewedRowsInfo: ViewedRowsInfo,
  currentSelectedVirtualizedIndex: number | null,
  totalVirtualizedRowCount: number,
): {
  pageUpVirtualizedIndex: number | null;
  pageDownVirtualizedIndex: number | null;
} {
  if (viewedRowsInfo === null) {
    return { pageUpVirtualizedIndex: null, pageDownVirtualizedIndex: null };
  }

  const { firstFullyInView, lastFullyInView } = viewedRowsInfo;
  const pageSize = lastFullyInView - firstFullyInView + 1;

  if (currentSelectedVirtualizedIndex === null) {
    return {
      pageUpVirtualizedIndex: firstFullyInView,
      pageDownVirtualizedIndex: lastFullyInView,
    };
  }

  const pageUpVirtualizedIndex =
    currentSelectedVirtualizedIndex > firstFullyInView
      ? firstFullyInView
      : currentSelectedVirtualizedIndex - pageSize;
  const pageDownVirtualizedIndex =
    currentSelectedVirtualizedIndex < lastFullyInView
      ? lastFullyInView
      : currentSelectedVirtualizedIndex + pageSize;

  return {
    pageUpVirtualizedIndex: clamp(
      pageUpVirtualizedIndex,
      0,
      totalVirtualizedRowCount - 1,
    ),
    pageDownVirtualizedIndex: clamp(
      pageDownVirtualizedIndex,
      0,
      totalVirtualizedRowCount - 1,
    ),
  };
}

type ViewedRowsInfo = {
  firstFullyInView: number;
  lastFullyInView: number;
} | null;

function getViewedRowsInfo(
  itemsRendered: ListItem<unknown>[],
  virtuosoScroller: HTMLElement,
): ViewedRowsInfo {
  const scrollerTop = virtuosoScroller.scrollTop;
  const scrollerHeight = virtuosoScroller.clientHeight;
  const scrollerBottom = scrollerTop + scrollerHeight;
  const fullyInViewRows = itemsRendered.filter(
    (item) =>
      item.offset >= scrollerTop && item.offset + item.size <= scrollerBottom,
  );
  if (fullyInViewRows.length === 0) return null;
  return {
    firstFullyInView: fullyInViewRows[0].index,
    lastFullyInView: fullyInViewRows[fullyInViewRows.length - 1].index,
  };
}
