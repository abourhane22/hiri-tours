"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteUser } from "./actions";

export function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`⚠️ Supprimer définitivement ${userName} ?\n\nCette action est irréversible. Le compte sera retiré et l'utilisateur ne pourra plus se connecter.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteUser(userId);
      if (!result.ok) {
        alert(`Erreur : ${result.error}`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title="Supprimer l'utilisateur"
      className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-sand-200 bg-white text-red-700 hover:bg-red-50 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
