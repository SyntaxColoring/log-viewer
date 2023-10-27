import {
  ArrowDownIcon,
  ArrowUpIcon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import { IconButton, Separator, TextField } from "@radix-ui/themes";

// TODO: These are application-level concerns. This component shouldn't care about them.
export type SearchBarState =
  | {
      status: "noSearch";
    }
  | {
      status: "searching";
    }
  | {
      status: "searchComplete";
      matchEntryNumbers: number[];
      currentMatchNumber: number;
    };

export type SearchBarProps = SearchBarState & {
  onChange: (newSearch: string) => void;
  onUp: () => void;
  onDown: () => void;
};

export function SearchBar(props: SearchBarProps): JSX.Element {
  const enableButtons =
    props.status === "searchComplete" && props.matchEntryNumbers.length > 0;
  return (
    <TextField.Root size="3">
      <TextField.Slot>
        <MagnifyingGlassIcon />
      </TextField.Slot>
      <TextField.Input
        placeholder="Search messages..."
        onChange={(event) => props.onChange(event.target.value)}
      />
      <TextField.Slot>
        {props.status === "searchComplete" ? (
          props.matchEntryNumbers.length > 0 ? (
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {props.currentMatchNumber + 1}/{props.matchEntryNumbers.length}
            </span>
          ) : (
            <span>No matches</span>
          )
        ) : props.status === "searching" ? (
          <span>...</span>
        ) : null}
        <Separator orientation="vertical" />
        <IconButton
          onClick={props.onUp}
          disabled={!enableButtons}
          variant="ghost"
        >
          <ArrowUpIcon />
        </IconButton>
        <IconButton
          onClick={props.onDown}
          disabled={!enableButtons}
          variant="ghost"
        >
          <ArrowDownIcon />
        </IconButton>
      </TextField.Slot>
    </TextField.Root>
  );
}
