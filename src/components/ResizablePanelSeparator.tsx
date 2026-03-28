import clsx from "clsx";
import type React from "react";
import { Separator } from "react-resizable-panels";

import styles from "./ResizablePanelSeparator.module.css";

interface Props {
  orientation: "horizontal" | "vertical";
}

export function ResizablePanelSeparator(props: Props): React.JSX.Element {
  const { orientation } = props;
  return (
    <Separator
      className={clsx(
        styles.separator,
        orientation === "horizontal"
          ? styles.resizeHorizontally
          : styles.resizeVertically,
      )}
    />
  );
}
