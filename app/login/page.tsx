import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  async function signIn(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const nextPath = (formData.get("next") as string) || "/";

    const supabase = await createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      redirect(`/login?error=${encodeURIComponent(authError.message)}`);
    }
    redirect(nextPath);
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
          <h1 className="font-display text-2xl text-ink mb-2">Connexion</h1>
          <p className="text-sm text-sand-700 mb-6">
            Accédez à votre espace de gestion.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action={signIn} className="space-y-4">
            <input type="hidden" name="next" value={next || "/"} />
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="vous@example.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" size="lg">
              Se connecter
            </Button>
          </form>

          <p className="text-sm text-sand-700 mt-6 text-center">
            Pas encore de compte ?{" "}
            <Link
              href="/signup"
              className="text-terracotta-600 hover:text-terracotta-700 font-medium"
            >
              Créez-en un
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
