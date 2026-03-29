import React from "react";

import { type LogEntry, type LogSearcher } from "./logAccess";

import clsx from "clsx";
import {
  useCallback,
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

import styles from "./LogView.module.css";
import { binarySearch } from "./util/binarySearch";
import { clamp } from "./util/clamp";

const GRID_TEMPLATE_COLUMNS_VAR = "--grid-template-columns";
const CONSUME_GRID_TEMPLATE_COLUMNS: CSSProperties = {
  gridTemplateColumns: `var(${GRID_TEMPLATE_COLUMNS_VAR})`,
};

const VIRTUOSO_OVERSCAN = 1000;

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
  field: keyof LogEntry;
  header: string;
  render?: (context: LogViewColumnRenderContext) => React.ReactNode;
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

  const selectedVirtualizedIndex = React.useMemo(
    () =>
      selectedEntryNumber !== null
        ? binarySearch(entryNumbers, selectedEntryNumber)
        : null,
    [entryNumbers, selectedEntryNumber],
  );

  const [itemsRendered, setItemsRendered] = useState<ListItem<unknown>[]>([]);

  const renderItemContent = useCallback(
    (virtualizedIndex: number) => {
      const entryNumber = entryNumbers[virtualizedIndex];
      return (
        <EntryRow
          rowIndex={virtualizedIndex}
          entryNumber={entryNumber}
          logSearcher={logSearcher}
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
      logSearcher,
      onSelectedEntryNumberChange,
      query,
      selectedVirtualizedIndex,
    ],
  );

  const handleKeyDown = useBodyKeyboardNavigation(
    entryNumbers,
    selectedVirtualizedIndex,
    itemsRendered,
    virtuosoRef,
    virtuosoScrollerRef,
    onSelectedEntryNumberChange,
  );

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
        overscan={{ main: VIRTUOSO_OVERSCAN, reverse: VIRTUOSO_OVERSCAN }}
        computeItemKey={(virtualizedIndex) => entryNumbers[virtualizedIndex]}
        itemContent={renderItemContent}
        itemsRendered={setItemsRendered}
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
  entryNumber: number;
  logSearcher: LogSearcher;
  columns: LogViewColumn[];
  query: string | null;
  isSelected: boolean;
  onClick?: () => void;
}

function EntryRow(props: EntryRowProps): JSX.Element {
  const {
    rowIndex,
    entryNumber,
    logSearcher,
    columns,
    query,
    isSelected,
    onClick,
  } = props;
  const entry = useLoadEntry(logSearcher, entryNumber);
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
  const priorityClass = getPriorityClass(data.priority);
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
        const value = data[column.field];
        // TODO: Even special fields like _SYSTEMD_UNIT are apparently not always present.
        // Our types and parsing code need to be updated to account for this, too.
        const valueString = value === undefined ? "" : value.toString();
        const renderContext = { entry: data, rowIndex, query };
        const renderedValue = column.render
          ? column.render(renderContext)
          : valueString;
        return <BodyCell key={column.field}>{renderedValue}</BodyCell>;
      })}
    </div>
  );
}

function getPriorityClass(priorityCode: number): string | undefined {
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

function useLoadEntry(
  logSearcher: LogSearcher,
  entryNumber: number,
): LogEntry | null {
  const [loadedEntry, setLoadedEntry] = React.useState<LogEntry | null>(null);

  React.useEffect(() => {
    let ignore = false;
    setLoadedEntry(null);
    const load = async () => {
      const entries = await logSearcher.getEntries([entryNumber]);
      if (!ignore) setLoadedEntry(entries[0]);
    };
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load();
    return () => {
      ignore = true;
    };
  }, [logSearcher, entryNumber]);

  return loadedEntry;
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

function useBodyKeyboardNavigation(
  entryNumbers: number[],
  selectedVirtualizedIndex: number | null,
  itemsRendered: ListItem<unknown>[],
  virtuosoRef: React.RefObject<VirtuosoHandle | null>,
  virtuosoScrollerRef: React.RefObject<HTMLElement | Window | null>,
  onSelectedEntryNumberChange?: (newSelectedEntryNumber: number) => void,
): (event: React.KeyboardEvent<HTMLDivElement>) => void {
  return useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!onSelectedEntryNumberChange || entryNumbers.length === 0) return;

      const first = 0;
      const last = entryNumbers.length - 1;

      let nextVirtualizedIndex: number | null = null;
      switch (event.key) {
        case "ArrowUp": {
          nextVirtualizedIndex =
            selectedVirtualizedIndex === null
              ? last
              : Math.max(first, selectedVirtualizedIndex - 1);
          break;
        }
        case "ArrowDown": {
          nextVirtualizedIndex =
            selectedVirtualizedIndex === null
              ? first
              : Math.min(last, selectedVirtualizedIndex + 1);
          break;
        }
        case "Home": {
          nextVirtualizedIndex = first;
          break;
        }
        case "End": {
          nextVirtualizedIndex = last;
          break;
        }
        case "PageUp": {
          const viewedRowsInfo = getItemsFullyInView(
            itemsRendered,
            virtuosoScrollerRef,
          );
          const { pageUpVirtualizedIndex } = getPageUpDownTargets(
            viewedRowsInfo,
            selectedVirtualizedIndex,
            entryNumbers.length,
          );
          nextVirtualizedIndex = pageUpVirtualizedIndex;
          break;
        }
        case "PageDown": {
          const viewedRowsInfo = getItemsFullyInView(
            itemsRendered,
            virtuosoScrollerRef,
          );
          const { pageDownVirtualizedIndex } = getPageUpDownTargets(
            viewedRowsInfo,
            selectedVirtualizedIndex,
            entryNumbers.length,
          );
          nextVirtualizedIndex = pageDownVirtualizedIndex;
          break;
        }
      }

      if (nextVirtualizedIndex === null) return;

      event.preventDefault();
      virtuosoRef.current?.scrollIntoView({
        index: nextVirtualizedIndex,
      });
      onSelectedEntryNumberChange(entryNumbers[nextVirtualizedIndex]);
    },
    [
      entryNumbers,
      itemsRendered,
      onSelectedEntryNumberChange,
      selectedVirtualizedIndex,
      virtuosoRef,
      virtuosoScrollerRef,
    ],
  );
}

type ViewedRowsInfo = {
  firstFullyInView: number;
  lastFullyInView: number;
} | null;

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

function getItemsFullyInView(
  itemsRendered: ListItem<unknown>[],
  virtuosoScrollerRef: React.RefObject<HTMLElement | Window | null>,
): ViewedRowsInfo {
  const scroller = virtuosoScrollerRef.current;
  if (scroller === null) return null;
  const scrollerTop =
    scroller instanceof Window ? scroller.scrollY : scroller.scrollTop;
  const scrollerHeight =
    scroller instanceof Window ? scroller.innerHeight : scroller.clientHeight;
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
