// Déconnexion automatique du backoffice après inactivité.
// Source de vérité : le cookie httpOnly `last_activity` vérifié dans le
// middleware. Le composant client IdleWarning n'est qu'un confort.

/** Durée d'inactivité avant expiration de la session backoffice (minutes). */
export const SESSION_TIMEOUT_MINUTES = 30;

/** Seuil d'avertissement client avant expiration (minutes). */
export const SESSION_WARNING_MINUTES = 28;

/** Nom du cookie httpOnly de dernière activité. */
export const LAST_ACTIVITY_COOKIE = "last_activity";
