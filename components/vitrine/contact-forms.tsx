"use client";

import { useState } from "react";

/**
 * Formulaires contact & devis : confirmation inline (pas d'alert, pas
 * d'écriture en base). On branchera Resend plus tard.
 */

export function ContactForm() {
  const [done, setDone] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
        (e.target as HTMLFormElement).reset();
      }}
    >
      <div className="form-row">
        <div className="field">
          <label>Nom complet *</label>
          <input type="text" required placeholder="Votre nom" />
        </div>
        <div className="field">
          <label>Email *</label>
          <input type="email" required placeholder="vous@email.com" />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>Téléphone / WhatsApp</label>
          <input type="tel" placeholder="+212 …" />
        </div>
        <div className="field">
          <label>Objet *</label>
          <select required defaultValue="">
            <option value="">Choisir un objet…</option>
            <option>Information sur un circuit</option>
            <option>Réservation / modification</option>
            <option>Devis groupe / entreprise</option>
            <option>Partenariat (hôtel, activité…)</option>
            <option>Réclamation</option>
            <option>Autre</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Votre message *</label>
        <textarea rows={5} required placeholder="Décrivez votre demande…" />
      </div>
      <label className="check" style={{ fontSize: ".82rem", color: "var(--muted)" }}>
        <input type="checkbox" required />
        J&apos;accepte que mes données soient utilisées pour traiter ma demande, conformément à la
        loi 09-08 (CNDP). *
      </label>
      <button className="btn btn-primary btn-lg" type="submit" style={{ marginTop: "16px" }}>
        Envoyer le message
      </button>
      {done && (
        <div className="alert ok">
          ✓ Message envoyé ! Notre équipe vous répond sous 24h (souvent bien plus vite).
        </div>
      )}
    </form>
  );
}

export function DevisForm() {
  const [done, setDone] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
        (e.target as HTMLFormElement).reset();
      }}
    >
      <div className="form-row">
        <div className="field">
          <label>Organisation / société</label>
          <input type="text" placeholder="Nom de votre structure" />
        </div>
        <div className="field">
          <label>Type d&apos;événement *</label>
          <select required defaultValue="">
            <option value="">Choisir…</option>
            <option>Incentive / team-building</option>
            <option>Séminaire / congrès (MICE)</option>
            <option>Voyage scolaire</option>
            <option>Famille / amis (groupe privé)</option>
            <option>EVJF / EVG</option>
            <option>Autre</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>Nombre de participants *</label>
          <input type="number" min={2} required placeholder="Ex. : 25" />
        </div>
        <div className="field">
          <label>Dates souhaitées *</label>
          <input type="text" required placeholder="Ex. : du 12 au 15 octobre 2026" />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>Budget indicatif / personne</label>
          <select defaultValue="">
            <option value="">À définir</option>
            <option>Moins de 500 DH</option>
            <option>500 – 1 500 DH</option>
            <option>1 500 – 3 000 DH</option>
            <option>Plus de 3 000 DH</option>
          </select>
        </div>
        <div className="field">
          <label>Contact (email ou téléphone) *</label>
          <input type="text" required placeholder="vous@email.com / +212…" />
        </div>
      </div>
      <div className="field">
        <label>Décrivez votre projet *</label>
        <textarea rows={4} required placeholder="Activités souhaitées, hébergement, transport, contraintes…" />
      </div>
      <button className="btn btn-ocean btn-lg" type="submit">
        Recevoir mon devis gratuit
      </button>
      {done && (
        <div className="alert ok">
          ✓ Demande reçue ! Un conseiller dédié vous enverra une proposition détaillée sous 24h
          ouvrées.
        </div>
      )}
    </form>
  );
}
