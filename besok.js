// Teller besøk og klikk uten informasjonskapsler. Side, kilde og hendelse sendes til Supabase, som
// summerer per dag (supabase/migrations/20261003150000_nettbesok.sql). Ingenting lagres i
// nettleseren, og serveren lagrer verken IP-adresse eller nettleserstreng. Adressen og den
// offentlige nøkkelen settes inn når nettsiden bygges (scripts/nett/bygg.mjs).
const ADRESSE = 'https://sfxxnisneospalfijczz.supabase.co';
const NOKKEL = 'sb_publishable_x19xpK5Y3-HL_TLCGDghLw_jA-5PGIW';

const parametre = new URLSearchParams(location.search);

/** Hvor besøket kom fra: ?kilde= i lenken (for eksempel fra TikTok-bioen), ellers forrige side. */
function finnKilde() {
  const fraLenke = parametre.get('kilde') ?? parametre.get('utm_source');
  if (fraLenke) return fraLenke;
  try {
    const vert = new URL(document.referrer).hostname.replace(/^www\./, '');
    return vert && vert !== location.hostname ? vert : '';
  } catch {
    return '';
  }
}
const kilde = finnKilde();

function tell(hendelse) {
  // Playwright og andre automatiserte nettlesere telles ikke.
  if (!ADRESSE.startsWith('https://') || navigator.webdriver) return;
  fetch(`${ADRESSE}/rest/v1/rpc/tell_besok`, {
    method: 'POST',
    keepalive: true,
    headers: { apikey: NOKKEL, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_sti: location.pathname, p_kilde: kilde, p_hendelse: hendelse }),
  }).catch(() => {});
}

tell('side');

// ?kilde= fjernes fra adresselinja, så en lenke som deles videre, ikke telles som TikTok igjen.
if (parametre.has('kilde')) {
  parametre.delete('kilde');
  const resten = parametre.toString();
  history.replaceState(
    null,
    '',
    `${location.pathname}${resten ? `?${resten}` : ''}${location.hash}`,
  );
}

document.addEventListener('click', (e) => {
  const mal = e.target instanceof Element ? e.target : null;
  if (mal?.closest('[data-del]')) tell('del');
  const lenke = mal?.closest('a[href]')?.getAttribute('href') ?? '';
  if (lenke.includes('tiktok.com')) tell('tiktok');
  if (lenke.includes('apps.apple.com')) tell('app-store');
});
