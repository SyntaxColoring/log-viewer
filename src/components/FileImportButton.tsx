import { Button } from "@/shadcn/components/ui/button";
import { FileUp } from "lucide-react";
import { useRef, type ChangeEventHandler } from "react";

/** A file input styled as a button. */
export default function FileImportButton({
  className,
  label = "Import File",
  onFileSelect,
}: {
  className?: string;
  label?: string;
  onFileSelect?: (file: File | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    onFileSelect?.(event.target.files?.[0] ?? null);
  };

  return (
    <>
      <Button
        variant="default"
        size="lg"
        className={className}
        onClick={() => fileInputRef.current?.click()}
      >
        <FileUp className="size-4" data-icon="inline-start" />
        {label}
      </Button>
      <input ref={fileInputRef} type="file" hidden onChange={handleChange} />
    </>
  );
}
