import type { ButtonHTMLAttributes } from "react";
import { cn } from "~/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
