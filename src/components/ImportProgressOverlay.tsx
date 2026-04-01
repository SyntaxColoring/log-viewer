import { type JSX } from "react";

import { Dialog, DialogContent } from "@/shadcn/components/ui/dialog";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/shadcn/components/ui/progress";

export function ImportProgressOverlay({
  fileName,
  progress,
}: {
  fileName: string;
  progress: number;
}): JSX.Element {
  const percent = Math.round(progress * 100);

  return (
    <Dialog
      open
      onOpenChange={() => {
        // Keep progress overlay non-dismissible.
      }}
    >
      <DialogContent showCloseButton={false} aria-label="Importing file">
        <Progress value={percent}>
          <ProgressLabel className="truncate">
            Importing {fileName}...
          </ProgressLabel>
          <ProgressValue>
            {(_formattedValue, value) => `${Math.round(value ?? 0)}%`}
          </ProgressValue>
        </Progress>
      </DialogContent>
    </Dialog>
  );
}
