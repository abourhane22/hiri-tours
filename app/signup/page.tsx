import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;

  async function signUp(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("full_name") as string;

    const supabase = await createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (authError) {
      redirect(`/signup?error=${encodeURIComponent(authError.message)}`);
    }
    redirect("/signup?success=1");
  }

  return (
    <main className="min-h-screen bg-sand-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/login" className="inline-flex items-baseline gap-2">
            <span className="font-display text-3xl text-navy-700">Hiri Tours</span>
            <span className="text-xs uppercase tracking-[0.2em] text-terracotta-600 font-medium">
              Backoffice
            </span>
          </Link>
        </div>

        <div className="bg-white border border-sand-200 rounded-lg p-8">
          <h1 className="font-display text-2xl text-ink mb-2">Créer un compte</h1>
          <p className="text-sm text-sand-700 mb-4">
            Inscrivez-vous puis demandez à un administrateur d&apos;activer votre accès.
          </p>
          <div className="mb-6 p-3 rounded-md bg-atlantic-50 border border-atlantic-200 text-xs text-atlantic-800">
            ℹ️ L&apos;accès au backoffice est réservé au personnel autorisé. Après inscription,
            vous n&apos;aurez pas accès aux outils tant qu&apos;un administrateur n&apos;aura pas validé
            votre compte.
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
              {decodeURIComponent(error)}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
              Compte créé. Vérifiez votre boîte mail pour confirmer.
            </div>
          )}

          <form action={signUp} className="space-y-4">
            <div>
              <Label htmlFor="full_name">Nom complet</Label>
              <Input
                id="full_name"
                name="full_name"
                type="text"
                required
                autoComplete="name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-sand-600 mt-1">8 caractères minimum.</p>
            </div>
            <Button type="submit" className="w-full" size="lg">
              Créer mon compte
            </Button>
          </form>

          <p className="text-sm text-sand-700 mt-6 text-center">
            Déjà inscrit ?{" "}
            <Link
              href="/login"
              className="text-terracotta-600 hover:text-terracotta-700 font-medium"
            >
              Connectez-vous
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
