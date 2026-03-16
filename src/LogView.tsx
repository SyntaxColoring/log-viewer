import React, { type Ref } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import { type SearcherState } from "./App";
import * as ResizableTable from "./ResizableTable";
import { Datetime } from "./components/Datetime";
import MarkedText from "./components/MarkedText";
import { type LogEntry, type ResultSet } from "./logAccess";

import "./LogView.css";

const VIRTUOSO_OVERSCAN = 1000;

export type LogViewProps = {
  file: File | null;
  searcherState: SearcherState;
  resultSet: ResultSet | null;
  query: string;
  wrapLines: boolean;
  ref?: Ref<VirtuosoHandle>;
};

export function LogView({
  file,
  searcherState,
  resultSet,
  query,
  ref,
  wrapLines,
}: LogViewProps): React.JSX.Element {
  const [numberWidth, setNumberWidth] = React.useState(0);
  const [timestampWidth, setTimestampWidth] = React.useState(0);
  const [unitWidth, setUnitWidth] = React.useState(0);
  const [syslogIDWidth, setSyslogIDWidth] = React.useState(0);

  if (!file) return <></>;
  if (searcherState.status === "indexing") {
    return (
      <>
        <p>Loading...</p>
        <meter value={searcherState.progress}></meter>
      </>
    );
  }
  return (
    <ResizableTable.Table wrapLines={wrapLines}>
      <ResizableTable.Header>
        <ResizableTable.HeaderGutterCell
          text="#"
          defaultWidthCh={5}
          onResize={setNumberWidth}
        />
        <ResizableTable.HeaderGutterCell
          text="Timestamp"
          defaultWidthCh={16}
          onResize={setTimestampWidth}
        />
        <ResizableTable.HeaderGutterCell
          text="Unit"
          defaultWidthCh={16}
          onResize={setUnitWidth}
        />
        <ResizableTable.HeaderGutterCell
          text="Syslog ID"
          defaultWidthCh={16}
          onResize={setSyslogIDWidth}
        />
        <ResizableTable.HeaderMainCell text="Message" />
      </ResizableTable.Header>
      <ResizableTable.Body>
        {resultSet && (
          <Virtuoso
            ref={ref}
            totalCount={resultSet.entryCount}
            overscan={{ main: VIRTUOSO_OVERSCAN, reverse: VIRTUOSO_OVERSCAN }}
            itemContent={(entryIndex) => {
              return (
                <RowContents
                  index={entryIndex}
                  resultSet={resultSet}
                  query={query}
                  numberWidth={numberWidth}
                  timestampWidth={timestampWidth}
                  unitWidth={unitWidth}
                  syslogIDWidth={syslogIDWidth}
                />
              );
            }}
          />
        )}
      </ResizableTable.Body>
    </ResizableTable.Table>
  );
}

function RowContents({
  index,
  resultSet,
  query,
  numberWidth,
  timestampWidth,
  unitWidth,
  syslogIDWidth,
}: {
  index: number;
  resultSet: ResultSet;
  query: string;
  numberWidth: number;
  timestampWidth: number;
  unitWidth: number;
  syslogIDWidth: number;
}): React.JSX.Element {
  const [rowData, setRowData] = React.useState<LogEntry | null>(null);

  React.useEffect(() => {
    let ignore = false;
    setRowData(null);
    const load = async () => {
      const entries = await resultSet.getEntries(index, index + 1);
      if (!ignore) setRowData(entries[0] ?? null);
    };
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load();
    return () => {
      ignore = true;
    };
  }, [resultSet, index]);

  if (rowData === null) {
    return (
      <ResizableTable.Row className="">
        <ResizableTable.BodyGutterCell width={numberWidth} />
        <ResizableTable.BodyGutterCell width={timestampWidth} />
        <ResizableTable.BodyGutterCell title="" width={unitWidth} />
        <ResizableTable.BodyGutterCell title="" width={syslogIDWidth} />
        <ResizableTable.BodyMainCell>loading...</ResizableTable.BodyMainCell>
      </ResizableTable.Row>
    );
  }

  const priorityClass = [
    "log-emerg",
    "log-alert",
    "log-crit",
    "log-err",
    "log-warning",
    "log-notice",
    "log-info",
    "log-debug",
  ][rowData.priority];
  return (
    <ResizableTable.Row className={priorityClass}>
      {/*TODO: align-right somehow.*/}
      <ResizableTable.BodyGutterCell
        title={(rowData.entryNumber + 1).toString()}
        width={numberWidth}
      >
        {(rowData.entryNumber + 1).toString()}
      </ResizableTable.BodyGutterCell>
      <ResizableTable.BodyGutterCell width={timestampWidth}>
        <Datetime date={rowData.timestamp} />
      </ResizableTable.BodyGutterCell>
      <ResizableTable.BodyGutterCell title={rowData.unit} width={unitWidth}>
        {rowData.unit}
      </ResizableTable.BodyGutterCell>
      <ResizableTable.BodyGutterCell
        title={rowData.syslogIdentifier}
        width={syslogIDWidth}
      >
        {rowData.syslogIdentifier}
      </ResizableTable.BodyGutterCell>
      {/*TODO: Investigate whether it would be more semantic for this to have a <pre> tag.*/}
      <ResizableTable.BodyMainCell>
        <MarkedText text={rowData.message} query={query} />
      </ResizableTable.BodyMainCell>
    </ResizableTable.Row>
  );
}
