export default function CompteDesactivePage() {
  return (
    <div className="min-h-screen bg-sand-50 flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="size-16 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">🔒</span>
        </div>
        <h1 className="font-display text-2xl text-ink mb-2">Compte désactivé</h1>
        <p className="text-sand-700 text-sm mb-6">
          Votre accès à la plateforme Hiri Tours a été désactivé. Contactez un administrateur pour rétablir votre accès.
        </p>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm text-terracotta-600 hover:underline">
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}
