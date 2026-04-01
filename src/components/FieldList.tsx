import { type JSX } from "react";

export interface FieldListProps {
  data: Record<string, string>;
}

export function FieldList({ data }: FieldListProps): JSX.Element {
  const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <dl className="columns-[40ch_auto] gap-[3ch] [column-fill:balance] [column-rule:1px_solid_#ddd]">
      {entries.map(([key, value]) => (
        <div className="mbe-[2ch] break-inside-avoid" key={key}>
          <dt className="font-semibold">{key}</dt>
          <dd className="ml-4 line-clamp-3">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
