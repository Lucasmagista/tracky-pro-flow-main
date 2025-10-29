import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps } from "class-variance-authority";
import { motion, HTMLMotionProps } from "framer-motion";

import { cn } from "@/lib/utils";
import { buttonHover, buttonTap, defaultTransition } from "@/components/animations";
import { buttonVariants } from "./button-variants";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, disabled, type, onClick, onMouseDown, onMouseUp, onFocus, onBlur, ...props }, ref) => {
    if (asChild) {
      const Comp = Slot;
      return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...{ children, disabled, type, onClick, onMouseDown, onMouseUp, onFocus, onBlur, ...props }} />;
    }

    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        whileHover={buttonHover}
        whileTap={buttonTap}
        transition={defaultTransition}
        disabled={disabled}
        type={type}
        onClick={onClick}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onFocus={onFocus}
        onBlur={onBlur}
        {...(props as HTMLMotionProps<"button">)}
      >
        {children}
      </motion.button>
    );
  },
);
Button.displayName = "Button";

export { Button };
