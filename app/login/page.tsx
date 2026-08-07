import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { SESSION_TIMEOUT_MINUTES, LAST_ACTIVITY_COOKIE } from "@/lib/auth-timeout";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reason?: string }>;
}) {
  const { next, error, reason } = await searchParams;

  async function signIn(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    // "/" est désormais la vitrine publique → l'accueil backoffice est /admin.
    const rawNext = (formData.get("next") as string) || "/admin";
    const nextPath = rawNext === "/" ? "/admin" : rawNext;

    const supabase = await createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      redirect(`/login?error=${encodeURIComponent(authError.message)}`);
    }

    // Réinitialise le compteur d'inactivité pour la nouvelle session.
    const jar = await cookies();
    jar.set(LAST_ACTIVITY_COOKIE, String(Date.now()), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TIMEOUT_MINUTES * 60,
    });

    redirect(nextPath);
  }

  return (
    <main className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel — visual */}
      <div className="relative h-48 lg:h-auto lg:w-1/2 shrink-0 overflow-hidden">
        <Image
          src="/login-bg.png"
          alt="Agadir"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Overlay: dark at top and bottom, lighter in centre */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A1F2E]/55 via-[#1A1F2E]/15 to-[#1A1F2E]/70" />

        {/* Content over image */}
        <div className="absolute inset-0 z-10 flex flex-col justify-between p-8 lg:p-10 text-white">
          {/* Logo — always visible */}
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl">Hiri Tours</span>
            <span className="text-[10px] tracking-[0.25em] uppercase text-[#FFB89A] font-medium">
              Plateforme
            </span>
          </div>

          {/* Tagline — desktop only (bandeau mobile too short) */}
          <div className="hidden lg:block">
            <h2 className="font-display text-4xl leading-tight mb-3">
              Pilotez l&apos;âme
              <br />
              d&apos;Agadir.
            </h2>
            <p className="text-[15px] opacity-90 max-w-sm">
              Réservations, opérations, finance — votre agence touristique sur
              une seule plateforme.
            </p>
            <p className="text-[11px] mt-3 text-[#8B92A5]">
              <span>by </span>
              <span className="text-[#C9CDD6] font-medium">Bright Strategy</span>
              <span> · Solution de Gestion</span>
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-[#FAF5F0] px-9 py-11">
        <LoginForm
          action={signIn}
          error={error}
          notice={reason === "timeout" ? "Vous avez été déconnecté après 30 minutes d'inactivité." : undefined}
          next={next || "/admin"}
        />
      </div>
    </main>
  );
}
