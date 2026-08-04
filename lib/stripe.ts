import Stripe from "stripe";

// Instance Stripe côté serveur. Null si la clé n'est pas configurée
// (tolérance build : on ne crashe pas, les actions renvoient une erreur propre).
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
