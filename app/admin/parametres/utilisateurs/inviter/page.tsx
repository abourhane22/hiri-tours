import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { ArrowLeft, Mail } from "lucide-react";
import { BACKOFFICE_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/permissions";
import { inviteUser } from "../actions";

export default function InviterPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link href="/admin/parametres/utilisateurs" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Utilisateurs
      </Link>
      <div className="mb-8">
        <p className="eyebrow mb-2">Paramètres</p>
        <h1 className="font-display text-3xl text-ink">Inviter un utilisateur</h1>
        <p className="text-sm text-sand-700 mt-1">Un email d&apos;invitation sera envoyé. L&apos;utilisateur définira son mot de passe lors de sa première connexion.</p>
      </div>

      <Card>
        <CardBody>
          <form action={inviteUser} className="space-y-5">
            <div>
              <Label htmlFor="email">Adresse email *</Label>
              <Input id="email" name="email" type="email" required placeholder="prenom.nom@hiritours.ma" />
            </div>

            <div>
              <Label htmlFor="role">Rôle *</Label>
              <Select id="role" name="role" defaultValue="commercial">
                {BACKOFFICE_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2 pt-1">
              {BACKOFFICE_ROLES.map((r) => (
                <div key={r} className="flex gap-3 p-3 rounded-md border border-sand-200 bg-sand-50">
                  <div className="w-24 shrink-0 font-medium text-xs text-ink pt-0.5">{ROLE_LABELS[r]}</div>
                  <p className="text-xs text-sand-700">{ROLE_DESCRIPTIONS[r]}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-sand-200">
              <Link href="/admin/parametres/utilisateurs">
                <Button variant="secondary" type="button">Annuler</Button>
              </Link>
              <Button type="submit">
                <Mail className="size-4" />
                Envoyer l&apos;invitation
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
