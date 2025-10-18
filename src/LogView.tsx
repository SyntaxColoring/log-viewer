import React from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import { type IndexState } from "./App";
import * as ResizableTable from "./ResizableTable";
import { Datetime } from "./components/Datetime";
import MarkedText from "./components/MarkedText";
import { type LogIndex } from "./logAccess";

import "./LogView.css";

const VIRTUOSO_OVERSCAN = 1000;

export const LogView = React.forwardRef(
  (
    {
      file,
      indexState,
      query,
      selectedRow,
      wrapLines,
    }: {
      file: File | null;
      indexState: IndexState;
      query: string;
      selectedRow: number | null;
      wrapLines: boolean;
    },
    ref: React.ForwardedRef<VirtuosoHandle>,
  ): React.JSX.Element => {
    const [numberWidth, setNumberWidth] = React.useState(0);
    const [timestampWidth, setTimestampWidth] = React.useState(0);
    const [unitWidth, setUnitWidth] = React.useState(0);
    const [syslogIDWidth, setSyslogIDWidth] = React.useState(0);

    // TODO: These probably need to set the ref?
    // Can a React ref be present sometimes but not other times?
    if (!file) return <></>;
    else if (indexState.status !== "indexed") {
      return (
        <>
          <p>Loading...</p>
          <meter value={indexState.progress}></meter>
        </>
      );
    } else {
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
            <Virtuoso
              ref={ref}
              totalCount={indexState.index.entryCount}
              overscan={{ main: VIRTUOSO_OVERSCAN, reverse: VIRTUOSO_OVERSCAN }}
              itemContent={(entryNumber) => {
                return (
                  <RowContents
                    index={entryNumber}
                    logIndex={indexState.index}
                    query={query}
                    numberWidth={numberWidth}
                    timestampWidth={timestampWidth}
                    unitWidth={unitWidth}
                    syslogIDWidth={syslogIDWidth}
                    isSelected={entryNumber === selectedRow}
                  />
                );
              }}
            />
          </ResizableTable.Body>
        </ResizableTable.Table>
      );
    }
  },
);

function RowContents({
  index,
  logIndex,
  query,
  numberWidth,
  timestampWidth,
  unitWidth,
  syslogIDWidth,
  isSelected,
}: {
  index: number;
  logIndex: LogIndex;
  query: string;
  numberWidth: number;
  timestampWidth: number;
  unitWidth: number;
  syslogIDWidth: number;
  isSelected: boolean;
}): React.JSX.Element {
  // Ideally, this call to get entry data would be async, and we would initially show a loading
  // placeholder. That would let logIndex avoid having to buffer all the data in memory up-front.
  // Unfortunately, React Virtuoso has a lot of trouble with elements changing height as you
  // scroll upward. So this needs to be instant to avoid things jumping around.
  const rowData = logIndex.getEntry(index);

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
        title={(index + 1).toString()}
        width={numberWidth}
      >
        {(index + 1).toString()}
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
        <MarkedText
          text={rowData.message}
          query={query}
          isActive={isSelected}
        />
      </ResizableTable.BodyMainCell>
    </ResizableTable.Row>
  );
}
