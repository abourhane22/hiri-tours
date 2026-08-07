"use client";

import { useEffect, useRef, useState } from "react";
import { SESSION_TIMEOUT_MINUTES, SESSION_WARNING_MINUTES } from "@/lib/auth-timeout";

const TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60 * 1000;
const WARNING_MS = SESSION_WARNING_MINUTES * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 5_000; // ne pas traiter l'activité plus d'1×/5s
const PING_THROTTLE_MS = 5 * 60 * 1000; // rafraîchir le cookie serveur ≤ 1×/5min
const CHECK_INTERVAL_MS = 15_000;
const REMAINING_MIN = SESSION_TIMEOUT_MINUTES - SESSION_WARNING_MINUTES;

/**
 * Confort d'inactivité du backoffice (la source de vérité reste le cookie
 * serveur `last_activity` vérifié par le middleware). Avertit à
 * SESSION_WARNING_MINUTES et redirige vers /login?reason=timeout à
 * SESSION_TIMEOUT_MINUTES. Monté dans le layout /admin uniquement.
 */
export function IdleWarning() {
  const [warning, setWarning] = useState(false);
  const lastActivity = useRef(Date.now());
  const lastPing = useRef(Date.now());

  function keepServerAlive() {
    lastPing.current = Date.now();
    fetch("/admin/session", { cache: "no-store" }).catch(() => {});
  }

  function stayConnected() {
    lastActivity.current = Date.now();
    setWarning(false);
    keepServerAlive();
  }

  useEffect(() => {
    function onActivity() {
      const now = Date.now();
      if (now - lastActivity.current < ACTIVITY_THROTTLE_MS) return;
      lastActivity.current = now;
      if (warning) setWarning(false);
      // Garde le cookie serveur en phase avec l'activité réelle (throttlé).
      if (now - lastPing.current > PING_THROTTLE_MS) keepServerAlive();
    }

    const events = ["mousemove", "keydown", "click", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const interval = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= TIMEOUT_MS) {
        const next = encodeURIComponent(window.location.pathname);
        window.location.href = `/login?reason=timeout&next=${next}`;
      } else {
        setWarning(idle >= WARNING_MS);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warning]);

  if (!warning) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white border border-[#E5E0D7] shadow-xl p-6">
        <h2 className="font-display text-lg text-[#1A1F2E]">
          Votre session expire dans {REMAINING_MIN} minute{REMAINING_MIN > 1 ? "s" : ""}
        </h2>
        <p className="mt-2 text-sm text-[#6B6862]">
          Vous allez être déconnecté par sécurité après {SESSION_TIMEOUT_MINUTES} minutes
          d&apos;inactivité. Souhaitez-vous rester connecté ?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={stayConnected}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1A1F2E] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2A3142]"
          >
            Rester connecté
          </button>
        </div>
      </div>
    </div>
  );
}
