"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { ShieldCheck, AlertCircle } from "lucide-react";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        router.push("/auth/login?error=session_expired");
      } else {
        setUserEmail(data.user.email ?? null);
        setCheckingSession(false);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push("/admin");
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-50">
        <p className="text-sand-700">Vérification de votre session…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand-50 p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-ink">Hiri Tours</h1>
          <p className="text-sm text-sand-700 mt-1">Backoffice</p>
        </div>

        <Card>
          <div className="px-6 py-5 border-b border-sand-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-terracotta-600" />
              <h2 className="font-display text-xl text-ink">Définir votre mot de passe</h2>
            </div>
            {userEmail && (
              <p className="text-xs text-sand-700 mt-2">Compte : <span className="font-medium">{userEmail}</span></p>
            )}
            <p className="text-sm text-sand-700 mt-2">Bienvenue ! Choisissez un mot de passe pour finaliser votre compte et accéder au backoffice.</p>
          </div>

          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Au moins 8 caractères"
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded bg-red-50 border border-red-200 text-sm text-red-900">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Enregistrement…" : "Définir le mot de passe et continuer"}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
