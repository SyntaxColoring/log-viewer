import { type ComponentPropsWithoutRef } from "react";

import { cn } from "@/shadcn/lib/utils";

/** A styled link. */
export function A({ className, ...props }: ComponentPropsWithoutRef<"a">) {
  return (
    <a className={cn("text-primary hover:underline", className)} {...props} />
  );
}
