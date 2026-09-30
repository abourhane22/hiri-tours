"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CircleCheck, AlertCircle, X } from "lucide-react";
import { FLASH_COOKIE, type FlashMessage } from "@/lib/flash-shared";

// SYSTÈME UNIQUE de notifications éphémères du backoffice (toasts).
// Bas à droite, empilables, fermeture au clic ; succès : 4 s ; erreurs : restent
// jusqu'à fermeture. role="status" (succès) / role="alert" (erreurs).
// Sources : useToast() (composants client), useActionFeedback() (formulaires
// useActionState), flash serveur (lib/flash.ts) consommé à la navigation et à la
// fin d'un envoi (SubmitButton).

type ToastType = "success" | "error";
type Toast = { id: number; type: ToastType; message: string; action?: { label: string; onClick: () => void } };
type ToastInput = Omit<Toast, "id">;

type ToastApi = {
  show: (t: ToastInput) => number;
  success: (message: string) => number;
  error: (message: string, field?: string | null) => number;
  dismiss: (id: number) => void;
  /** Lit et efface le flash serveur, et l'affiche. */
  consumeFlash: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const SUCCESS_MS = 4000;

// Dernier formulaire soumis : la mise en évidence du champ en erreur s'y limite.
let lastForm: HTMLFormElement | null = null;

/** Met en évidence le champ `name` (aria-invalid, focus) ; l'état s'efface à la saisie. */
export function highlightField(name: string | null | undefined, scope?: ParentNode | null) {
  if (!name || typeof document === "undefined") return;
  const root: ParentNode = scope ?? (lastForm && document.contains(lastForm) ? lastForm : document);
  const sel = `[name="${typeof CSS !== "undefined" && CSS.escape ? CSS.escape(name) : name}"]`;
  const el = root.querySelector<HTMLElement>(sel) ?? document.querySelector<HTMLElement>(sel);
  if (!el) return;
  el.setAttribute("aria-invalid", "true");
  el.setAttribute("data-field-error", "true");
  const clear = () => {
    el.removeAttribute("aria-invalid");
    el.removeAttribute("data-field-error");
    el.removeEventListener("input", clear);
    el.removeEventListener("change", clear);
  };
  el.addEventListener("input", clear);
  el.addEventListener("change", clear);
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  (el as HTMLInputElement).focus?.({ preventScroll: true });
}

function readFlash(): FlashMessage[] {
  if (typeof document === "undefined") return [];
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${FLASH_COOKIE}=`));
  if (!hit) return [];
  document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/`;
  try {
    const raw = decodeURIComponent(hit.slice(FLASH_COOKIE.length + 1));
    // Le cookie est doublement encodé (encodeURIComponent côté serveur + encodage éventuel du framework).
    const json = raw.startsWith("%") ? decodeURIComponent(raw) : raw;
    const list = JSON.parse(json);
    return Array.isArray(list) ? (list as FlashMessage[]) : [];
  } catch {
    return [];
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((l) => l.filter((t) => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) clearTimeout(tm);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current;
      setToasts((l) => [...l.slice(-4), { ...t, id }]);
      if (t.type === "success") timers.current.set(id, setTimeout(() => dismiss(id), SUCCESS_MS));
      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message: string) => show({ type: "success", message }),
      error: (message: string, field?: string | null) => {
        highlightField(field);
        return show({ type: "error", message });
      },
      dismiss,
      consumeFlash: () => {
        for (const f of readFlash()) {
          if (f.type === "error") highlightField(f.field);
          show({ type: f.type, message: f.message });
        }
      },
    }),
    [show, dismiss],
  );

  useEffect(() => {
    const onSubmit = (e: Event) => {
      if (e.target instanceof HTMLFormElement) lastForm = e.target;
    };
    document.addEventListener("submit", onSubmit, true);
    const map = timers.current;
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      map.forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Suspense fallback={null}>
        <FlashListener consume={api.consumeFlash} />
      </Suspense>
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(400px,calc(100vw-2rem))] flex-col gap-2 print:hidden">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Flash serveur : consommé à chaque arrivée sur une page (redirection après enregistrement). */
function FlashListener({ consume }: { consume: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const key = `${pathname}?${search?.toString() ?? ""}`;
  useEffect(() => {
    consume();
  }, [key, consume]);
  return null;
}

function ToastView({ toast: t, onClose }: { toast: Toast; onClose: () => void }) {
  const isError = t.type === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className="pointer-events-auto flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px] shadow-lg"
      style={
        isError
          ? { backgroundColor: "#FCEBEB", border: "1px solid #F7C1C1", color: "#791F1F" }
          : { backgroundColor: "#1A1F2E", color: "#FFFFFF" }
      }
    >
      {isError ? <AlertCircle className="mt-px size-4 shrink-0" /> : <CircleCheck className="mt-px size-4 shrink-0 text-[#7FD1B3]" />}
      <button type="button" onClick={onClose} className="min-w-0 flex-1 text-left leading-snug" title="Fermer">
        {t.message}
      </button>
      {t.action && (
        <button
          type="button"
          onClick={() => {
            t.action?.onClick();
            onClose();
          }}
          className={`shrink-0 font-medium hover:underline ${isError ? "text-[#791F1F]" : "text-[#F4C38A]"}`}
        >
          {t.action.label}
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="Fermer la notification" className="-m-1 shrink-0 rounded p-1 opacity-70 hover:opacity-100">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  // Hors provider (pages publiques) : no-op, jamais d'exception.
  const noop = () => 0;
  return { show: noop, success: noop, error: noop, dismiss: () => {}, consumeFlash: () => {} };
}

/**
 * Retour d'un formulaire useActionState : toast de succès (libellé de l'écran, ou
 * `state.message`), toast d'erreur + champ en évidence (`state.field`). L'état
 * initial n'affiche rien. Consomme aussi un éventuel flash serveur.
 */
export function useActionFeedback(
  state: unknown,
  initial: unknown,
  opts: { success?: string | null } = {},
) {
  const toast = useToast();
  const prev = useRef(state);
  useEffect(() => {
    if (state === prev.current) return;
    prev.current = state;
    if (state === initial || !state || typeof state !== "object") return;
    const s = state as { ok?: boolean | null; error?: string; field?: string | null; message?: string };
    if (s.ok === false && s.error) toast.error(s.error, s.field);
    else if (s.ok === true) {
      const msg = s.message ?? opts.success;
      if (msg) toast.success(msg);
    }
    toast.consumeFlash();
  }, [state, initial, opts.success, toast]);
}
