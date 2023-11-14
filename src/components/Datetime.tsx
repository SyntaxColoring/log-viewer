export function Datetime({ date }: { date: Date }): JSX.Element {
  const isoString = date.toISOString();
  const displayString = date.toLocaleDateString();
  return <time dateTime={isoString}>{displayString}</time>;
}
