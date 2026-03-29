import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { TextField } from "@radix-ui/themes";
import { useImperativeHandle, useRef, type JSX, type Ref } from "react";

export interface SearchBarHandle {
  focus: () => void;
  select: () => void;
  isFocused: () => boolean;
}

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

export interface SearchBarProps {
  query: string;
  status: Status;
  onQueryChange: (newQuery: string) => void;
  placeholder?: string;
  ref?: Ref<SearchBarHandle>;
}

export function SearchBar({
  query,
  status,
  onQueryChange,
  placeholder,
  ref,
}: SearchBarProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        inputRef.current?.focus();
      },
      select: () => {
        inputRef.current?.select();
      },
      isFocused: () => document.activeElement === inputRef.current,
    }),
    [],
  );

  return (
    <TextField.Root
      ref={inputRef}
      type="search"
      size="3"
      placeholder={placeholder}
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
