"use client";

import { useState } from "react";

/**
 * Newsletter : confirmation inline (pas d'alert, pas d'écriture en base).
 * On branchera Resend plus tard.
 */
export function NewsletterForm({ variant = "footer" }: { variant?: "footer" | "strip" }) {
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p style={{ fontSize: ".9rem", marginTop: "12px", color: variant === "strip" ? "#fff" : "#cdd8da" }}>
        ✓ Merci ! Vous êtes bien inscrit·e à notre newsletter.
      </p>
    );
  }

  if (variant === "strip") {
    return (
      <form
        style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
        onSubmit={(e) => {
          e.preventDefault();
          setDone(true);
        }}
      >
        <input
          type="email"
          placeholder="Votre email"
          required
          style={{ padding: "14px 20px", borderRadius: "40px", border: "none", minWidth: "240px", outline: "none" }}
        />
        <button className="btn btn-ghost btn-lg" type="submit">
          S&apos;inscrire
        </button>
      </form>
    );
  }

  return (
    <form
      className="news-form"
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
    >
      <input type="email" placeholder="Votre email" required />
      <button className="btn btn-primary" type="submit">
        OK
      </button>
    </form>
  );
}
