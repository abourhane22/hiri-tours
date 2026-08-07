// Pictogrammes filaires portés depuis maquette-vitrine/assets/js/icons.js
// (trait 1.7, viewBox 24). Rendus via <VitrineIcon name="…" />.

const PATHS: Record<string, string> = {
  // activités
  surf: '<path d="M2.5 15.5c3-4.5 6.5-2 9.5-.5s6.5 3 9.5-1"/><path d="M4 20c2.5-3 5-1.5 8-.2s5.5 2 8-1.3"/><circle cx="18" cy="5.5" r="2.2"/>',
  desert: '<path d="M2.5 18c2.8-4.2 6-4.2 9-1.5"/><path d="M9.5 18c3-5.5 7.5-5.5 12 0"/><circle cx="7" cy="6.5" r="2.4"/><path d="M2.5 18h19"/>',
  quad: '<circle cx="6.5" cy="17" r="2.6"/><circle cx="17.5" cy="17" r="2.6"/><path d="M9.1 17h5.8"/><path d="M6.5 14.4 9 9.5h5l3.5 4.9"/><path d="M12 9.5V7h3"/>',
  hike: '<path d="M2.5 19 9 7l4 7"/><path d="M10.5 19 15.5 9.5 21.5 19"/><path d="M2.5 19h19"/>',
  souk: '<path d="M5.5 8.5h13l-1.2 11a1.6 1.6 0 0 1-1.6 1.5H8.3a1.6 1.6 0 0 1-1.6-1.5Z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
  van: '<rect x="2.5" y="7" width="14" height="9" rx="1.6"/><path d="M16.5 10h3.2l1.8 3v3h-5"/><circle cx="7" cy="17.8" r="1.9"/><circle cx="17" cy="17.8" r="1.9"/><path d="M2.5 11h6"/>',
  hotel: '<rect x="4" y="4.5" width="16" height="16" rx="1.5"/><path d="M8.5 9h1.6M13.9 9h1.6M8.5 13h1.6M13.9 13h1.6"/><path d="M10.5 20.5v-3.4h3v3.4"/>',
  car: '<path d="M3 15.5 4.5 10a2 2 0 0 1 1.9-1.5h9.8a2 2 0 0 1 1.9 1.3l1.9 5.7"/><path d="M2.5 15.5h19v2.6h-19Z"/><circle cx="7" cy="19.5" r="1.9"/><circle cx="17" cy="19.5" r="1.9"/><path d="M12 8.5v7"/>',
  // interface
  user: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c1.2-3.6 3.8-5.2 7-5.2s5.8 1.6 7 5.2"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="9.8" r="2.2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17"/><path d="M8 3v4M16 3v4"/>',
  phone: '<path d="M5 4h4l1.5 4.5L8 10.5a12 12 0 0 0 5.5 5.5l2-2.5L20 15v4a1.8 1.8 0 0 1-2 1.8C10 20 4 14 3.2 6A1.8 1.8 0 0 1 5 4Z"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="1.8"/><path d="m4 7 8 6 8-6"/>',
  wa: '<path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.4-1.1A8.5 8.5 0 1 0 12 3.5Z"/><path d="M9 8.8c-.4 2.3 3.6 6.4 6 6l.4-1.7-2-1-.8.7c-.8-.5-1.5-1.2-1.9-2l.7-.8-.9-2Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  // réseaux sociaux
  instagram: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><path d="M16.9 7.1v.01"/>',
  facebook: '<path d="M15.5 4.5h-2.7A3.3 3.3 0 0 0 9.5 7.8V11H7v3h2.5v6.5h3V14h2.6l.4-3h-3V8.2c0-.5.3-.7.8-.7h2.2Z"/>',
  tiktok: '<path d="M14 4v9.5a3.7 3.7 0 1 1-3-3.6"/><path d="M14 5.5c.6 2 2.1 3.3 4.2 3.6"/>',
};

export type VitrineIconName = keyof typeof PATHS;

export function VitrineIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg
      className={`icon${className ? " " + className : ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] ?? "" }}
    />
  );
}
