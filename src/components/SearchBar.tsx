import {
  ArrowDownIcon,
  ArrowUpIcon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import { IconButton, Separator, TextField } from "@radix-ui/themes";

export type Status =
  | null
  | {
      /** Search progress from 0 to 1. */
      progress: number;
    }
  | {
      /** 0-based index of the currently selected match (< matchCount). */
      currentMatchIndex: number;
      matchCount: number;
    };

export interface Props {
  query: string;
  enableButtons: boolean;
  status: Status;
  onQueryChange: (newQuery: string) => void;
  onUp: () => void;
  onDown: () => void;
}

export function SearchBar({
  query,
  enableButtons,
  status,
  onQueryChange,
  onUp,
  onDown,
}: Props): JSX.Element {
  return (
    <TextField.Root size="3">
      <TextField.Slot>
        <MagnifyingGlassIcon />
      </TextField.Slot>
      <TextField.Input
        placeholder="Search messages..."
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <TextField.Slot>
        <StatusPart status={status} />
        <Separator orientation="vertical" />
        <IconButton
          title="Previous"
          disabled={!enableButtons}
          variant="ghost"
          onClick={onUp}
        >
          <ArrowUpIcon />
        </IconButton>
        <IconButton
          title="Next"
          disabled={!enableButtons}
          variant="ghost"
          onClick={onDown}
        >
          <ArrowDownIcon />
        </IconButton>
      </TextField.Slot>
    </TextField.Root>
  );
}

function StatusPart({ status }: { status: Status }): JSX.Element {
  if (status === null) {
    return <></>;
  } else if ("progress" in status) {
    return (
      <span>
        Searching...
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatPercent(status.progress)}
        </span>
      </span>
    );
  } else {
    return (
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {status.currentMatchIndex + 1}/{status.matchCount}
      </span>
    );
  }
}

function formatPercent(zeroToOne: number): string {
  return `${Math.round(zeroToOne * 100)}%`;
}
