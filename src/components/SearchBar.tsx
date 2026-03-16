import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { TextField } from "@radix-ui/themes";
import { type JSX } from "react";

export type Status =
  | {
      type: "noStatus";
    }
  | {
      type: "progress";
    }
  | {
      type: "noMatches";
    }
  | {
      type: "matches";
      matchCount: number;
    };

export interface Props {
  query: string;
  status: Status;
  onQueryChange: (newQuery: string) => void;
}

export function SearchBar({
  query,
  status,
  onQueryChange,
}: Props): JSX.Element {
  return (
    <TextField.Root
      size="3"
      placeholder="Search messages..."
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
    >
      <TextField.Slot side="left">
        <MagnifyingGlassIcon />
      </TextField.Slot>
      <TextField.Slot side="right">
        <StatusPart status={status} />
      </TextField.Slot>
    </TextField.Root>
  );
}

function StatusPart({ status }: { status: Status }): JSX.Element {
  switch (status.type) {
    case "noStatus":
      return <></>;
    case "progress":
      return <span>Searching...</span>;
    case "noMatches":
      return <>No results</>;
    case "matches":
      return (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {status.matchCount} results
        </span>
      );
  }
}
