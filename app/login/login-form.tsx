"use client";

import { useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

interface LoginFormProps {
  action: (formData: FormData) => Promise<void>;
  error?: string;
  next: string;
}

export function LoginForm({ action, error, next }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="w-full max-w-[380px]">
      <input type="hidden" name="next" value={next} />

      <h1 className="font-display text-[28px] text-[#1A1F2E] leading-tight mb-1">
        Bon retour
      </h1>
      <p className="text-sm text-[#6B6862] mb-6">
        Accédez à votre espace de gestion.
      </p>

      {error && (
        <p className="mb-5 text-sm text-red-600">{decodeURIComponent(error)}</p>
      )}

      {/* Email */}
      <div className="mb-4">
        <label
          htmlFor="email"
          className="block text-xs font-medium text-[#58524A] mb-1.5"
        >
          Email
        </label>
        <div className="relative">
          <Mail
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6862] pointer-events-none"
            size={16}
            aria-hidden
          />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="vous@example.com"
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-[#E5E0D7] rounded-lg bg-white text-[#1A1F2E] placeholder:text-[#B0ABA4] focus:outline-none focus:border-[#1A1F2E] focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors"
          />
        </div>
      </div>

      {/* Password */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="password"
            className="text-xs font-medium text-[#58524A]"
          >
            Mot de passe
          </label>
          <a
            href="#"
            className="text-xs text-[#C84B31] hover:underline"
          >
            Mot de passe oublié&nbsp;?
          </a>
        </div>
        <div className="relative">
          <Lock
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6862] pointer-events-none"
            size={16}
            aria-hidden
          />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            className="w-full pl-10 pr-10 py-2.5 text-sm border border-[#E5E0D7] rounded-lg bg-white text-[#1A1F2E] focus:outline-none focus:border-[#1A1F2E] focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label="Afficher ou masquer le mot de passe"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#6B6862] hover:text-[#1A1F2E] transition-colors rounded"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-[#1A1F2E] hover:bg-[#2A3142] text-white rounded-lg py-3 text-sm font-medium transition-colors"
      >
        Se connecter
      </button>
    </form>
  );
}
