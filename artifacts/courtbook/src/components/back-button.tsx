import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BackButtonProps = {
  to: string;
  label: string;
  className?: string;
};

export function BackButton({ to, label, className }: BackButtonProps) {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={cn("mb-4 -ml-2 text-muted-foreground hover:text-foreground", className)}
    >
      <Link href={to}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
