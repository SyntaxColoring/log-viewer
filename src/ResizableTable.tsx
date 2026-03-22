import {
  type JSX,
  type PropsWithChildren,
  type ReactNode,
  type Ref,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useMove } from "react-aria";

import styles from "./ResizableTable.module.css";

export function Table(
  props: PropsWithChildren<{
    wrapLines: boolean;
    ref?: Ref<HTMLTableElement>;
  }>,
): JSX.Element {
  const { ref, wrapLines, children } = props;
  return (
    <table
      className={`${styles.table} ${
        wrapLines ? styles.wrapLines : styles.noWrapLines
      }`}
      ref={ref}
    >
      {children}
    </table>
  );
}

export function Header(props: {
  children: ReactNode;
  ref?: Ref<HTMLTableSectionElement>;
}): JSX.Element {
  const { ref, children } = props;
  return (
    <thead ref={ref} className={styles.thead}>
      <tr className={styles.tr}>{children}</tr>
    </thead>
  );
}

export function Body(props: {
  children: ReactNode;
  ref?: Ref<HTMLTableSectionElement>;
}): JSX.Element {
  const { ref, children } = props;
  return (
    <tbody ref={ref} className={styles.tbody}>
      {children}
    </tbody>
  );
}

export function Row(
  props: PropsWithChildren<{
    className: string;
    ref?: Ref<HTMLTableRowElement>;
  }>,
): JSX.Element {
  const { ref, className, children } = props;
  return (
    <tr ref={ref} className={`${styles.tr} ${className}`}>
      {children}
    </tr>
  );
}

export function HeaderGutterCell({
  text,
  defaultWidthCh,
  onResize,
}: {
  text: string;
  defaultWidthCh: number;
  onResize: (newWidth: number) => void;
}): JSX.Element {
  const ref = useRef<HTMLTableCellElement>(null);
  const [widthPx, setWidthPx] = useState<number | null>(null);

  const handleResizerDrag = (dragAmount: number) => {
    if (widthPx != null) {
      const newWidth = widthPx + dragAmount;
      setWidthPx(newWidth);
      onResize(newWidth);
    }
  };

  useLayoutEffect(() => {
    if (widthPx == null) {
      const measuredWidth = ref.current!.getBoundingClientRect().width;
      setWidthPx(measuredWidth);
      onResize(measuredWidth);
    }
  }, [
    widthPx,
    onResize,
  ]); /* TODO: The overlap between this layout effect and handleResizerDrag is confusing, especially since they both touch widthPx. */

  return (
    <th
      className={`${styles.th} ${styles.gutter}`}
      ref={ref}
      style={{
        width: widthPx == null ? `${defaultWidthCh}ch` : widthPx,
      }}
      title={text}
    >
      {text}
      <Resizer onDrag={handleResizerDrag} />
    </th>
  );
}

export function HeaderMainCell({ text }: { text: string }): JSX.Element {
  const ref = useRef<HTMLTableCellElement>(null);
  return (
    <th className={styles.th} title={text} ref={ref}>
      {text}
    </th>
  );
}

export function BodyGutterCell(
  props: PropsWithChildren<{
    title?: string;
    width: number;
  }>,
): JSX.Element {
  return (
    <td
      className={`${styles.td} ${styles.gutter}`}
      title={props.title}
      style={{ width: props.width }}
    >
      {props.children}
    </td>
  );
}

export function BodyMainCell(props: PropsWithChildren): JSX.Element {
  return <td className={`${styles.td} ${styles.main}`}>{props.children}</td>;
}

function Resizer({
  onDrag,
}: {
  onDrag: (dragAmount: number) => void;
}): JSX.Element {
  const moveResult = useMove({ onMove: (event) => onDrag(event.deltaX) });
  return (
    <div className={styles.resizer} tabIndex={0} {...moveResult.moveProps} />
  );
}
