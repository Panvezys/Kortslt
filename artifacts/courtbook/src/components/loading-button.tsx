import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LoadingButtonProps = ButtonProps & {
  loading?: boolean;
  loadingText?: string;
};

/**
 * Drop-in replacement for <Button> that:
 *   - shows a spinner + (optional) loading text while `loading` is true
 *   - is automatically disabled while loading (prevents double-clicks)
 * Use it on any button that triggers an API call so users get consistent feedback.
 */
export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading = false, loadingText, disabled, children, className, ...rest }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={disabled || loading}
        className={cn(className)}
        {...rest}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            {loadingText ?? children}
          </>
        ) : (
          children
        )}
      </Button>
    );
  }
);
LoadingButton.displayName = "LoadingButton";
