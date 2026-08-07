import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      // h-11: barmoq uchun qulay. globals.css da font-size:16px — iOS zoom qilmaydi.
      "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 md:h-9",
      "placeholder:text-muted-foreground",
      "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2",
      "placeholder:text-muted-foreground",
      "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("text-sm font-medium leading-none", className)}
    {...props}
  />
));
Label.displayName = "Label";
