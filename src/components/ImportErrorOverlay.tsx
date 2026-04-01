import { type JSX } from "react";

import { Button } from "@/shadcn/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/components/ui/dialog";

export function ImportErrorOverlay({
  fileName,
  message,
  onDismiss,
}: {
  fileName: string;
  message: string;
  onDismiss: () => void;
}): JSX.Element {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <DialogContent showCloseButton={false} aria-label="Import failed">
        <DialogHeader>
          <DialogTitle>Import failed</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Couldn&apos;t import <strong>{fileName}</strong>.
        </DialogDescription>
        <DialogDescription>{message}</DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={onDismiss}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
