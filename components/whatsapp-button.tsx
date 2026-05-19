"use client";

import { MessageCircle } from "lucide-react";

type Props = {
  phone: string | null;
  message?: string;
  label?: string;
  variant?: "default" | "compact";
};

export function WhatsAppButton({ phone, message, label = "WhatsApp", variant = "default" }: Props) {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  if (clean.length < 8) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  const href = `https://wa.me/${clean}${text}`;

  if (variant === "compact") {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-[#25D366] text-white hover:bg-[#1ea855] transition-colors">
        <MessageCircle className="size-3" /> {label}
      </a>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm bg-[#25D366] text-white hover:bg-[#1ea855] transition-colors">
      <MessageCircle className="size-3.5" /> {label}
    </a>
  );
}
