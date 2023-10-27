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
    <div>
      <input
        type="text"
        onChange={(event) => props.onChange(event.target.value)}
      />
      {props.status === "searchComplete" ? (
        props.matchEntryNumbers.length > 0 ? (
          <span>
            {props.currentMatchNumber + 1}/{props.matchEntryNumbers.length}
          </span>
        ) : (
          <span>No matches</span>
        )
      ) : props.status === "searching" ? (
        <span>...</span>
      ) : null}
      <button onClick={props.onUp} disabled={!enableButtons}>
        ⬆️
      </button>
      <button onClick={props.onDown} disabled={!enableButtons}>
        ⬇️
      </button>
    </div>
  );
}
