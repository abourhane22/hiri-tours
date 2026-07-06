import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle } from "lucide-react";

type Props = {
  tone: "success" | "error";
  message: string;
  className?: string;
};

export function AlertBanner({ tone, message, className }: Props) {
  const styles =
    tone === "success"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : "bg-red-50 border-red-200 text-red-800";
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-4 py-3 text-sm",
        styles,
        className,
      )}
    >
      <Icon className="size-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}
