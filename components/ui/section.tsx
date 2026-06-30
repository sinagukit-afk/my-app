import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
}

function Section({ className, as: Tag = "section", ...props }: SectionProps) {
  return (
    <Tag
      className={cn("py-8 sm:py-12", className)}
      {...props}
    />
  );
}

export { Section };
