import * as React from "react";

import { cn } from "@/lib/utils";
import { badgeVariants, type BadgeVariantsProps } from "./badge-variants";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, BadgeVariantsProps {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, ...props }, ref) => {
  return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
});
Badge.displayName = "Badge";

export { Badge };
