import {
  type ForwardedRef,
  type JSX,
  type PropsWithChildren,
  type ReactNode,
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useMove } from "react-aria";

import "./ResizableTable.css";

export const Table = forwardRef(function Table(
  props: PropsWithChildren<{
    wrapLines: boolean;
  }>,
  ref: ForwardedRef<HTMLTableElement>,
): JSX.Element {
  return (
    <table className={props.wrapLines ? "wrapLines" : "noWrapLines"} ref={ref}>
      {props.children}
    </table>
  );
});

export const Header = forwardRef(function Header(
  { children }: { children: ReactNode },
  ref: ForwardedRef<HTMLTableSectionElement>,
): JSX.Element {
  return (
    <thead ref={ref}>
      <tr>{children}</tr>
    </thead>
  );
});

export const Body = forwardRef(function Body(
  { children }: { children: ReactNode },
  ref: ForwardedRef<HTMLTableSectionElement>,
): JSX.Element {
  return <tbody ref={ref}>{children}</tbody>;
});

export const Row = forwardRef(function Row(
  props: PropsWithChildren<{ className: string }>,
  ref: ForwardedRef<HTMLTableRowElement>,
): JSX.Element {
  return (
    <tr ref={ref} className={props.className}>
      {props.children}
    </tr>
  );
});

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
      className="gutter"
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
    <th title={text} ref={ref}>
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
    <td className="gutter" title={props.title} style={{ width: props.width }}>
      {props.children}
    </td>
  );
}

export function BodyMainCell(props: PropsWithChildren): JSX.Element {
  return <td className="main">{props.children}</td>;
}

function Resizer({
  onDrag,
}: {
  onDrag: (dragAmount: number) => void;
}): JSX.Element {
  const moveResult = useMove({ onMove: (event) => onDrag(event.deltaX) });
  return <div className="resizer" tabIndex={0} {...moveResult.moveProps} />;
}
