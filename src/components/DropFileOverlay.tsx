import { FileUp } from "lucide-react";
import { type JSX } from "react";
import { cn } from "../shadcn/lib/utils";

interface DropFileOverlayProps {
  isVisible: boolean;
}

export function DropFileOverlay(props: DropFileOverlayProps): JSX.Element {
  const { isVisible } = props;
  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-black/65 transition-[opacity,visibility] duration-150 ease-out",
        isVisible ? "visible opacity-100" : "invisible opacity-0",
      )}
      aria-hidden={!isVisible}
    >
      <div className="absolute inset-6 flex flex-col items-center justify-center gap-3 border-4 border-dashed border-white px-4 text-white">
        <FileUp className="size-12" />
        <p className="text-center text-2xl font-semibold">Drop to import</p>
      </div>
    </div>
  );
}
