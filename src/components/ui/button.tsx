import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:pointer-events-none disabled:opacity-50 font-display uppercase tracking-wider",
  {
    variants: {
      variant: {
        default:
          "border border-cyan-400/30 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30 hover:shadow-[0_0_16px_rgba(34,211,238,0.15)]",
        destructive:
          "border border-red-500/40 bg-red-950/40 text-red-300 hover:bg-red-950/60",
        outline:
          "border border-cyan-500/30 bg-transparent text-cyan-300 hover:border-cyan-400/50 hover:bg-cyan-500/10",
        secondary:
          "border border-slate-600/30 bg-slate-900/50 text-slate-300 hover:bg-slate-800/50",
        ghost: "text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-300",
        link: "text-cyan-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
