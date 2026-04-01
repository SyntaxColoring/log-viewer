import clsx from "clsx";
import type React from "react";
import { Separator } from "react-resizable-panels";

interface Props {
  orientation: "horizontal" | "vertical";
}

export function ResizablePanelSeparator(props: Props): React.JSX.Element {
  const { orientation } = props;
  return (
    <Separator
      className={clsx(
        "rounded bg-[#ddd]",
        orientation === "horizontal" ? "w-2" : "h-2",
      )}
    />
  );
}
