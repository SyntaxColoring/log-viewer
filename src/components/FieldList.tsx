import { type JSX } from "react";
import styles from "./FieldList.module.css";

export interface FieldListProps {
  data: Record<string, string>;
}

export function FieldList({ data }: FieldListProps): JSX.Element {
  const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <dl className={styles.list}>
      {entries.map(([key, value]) => (
        <div className={styles.listItem} key={key}>
          <dt className={styles.term}>{key}</dt>
          <dd className={styles.definition}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
