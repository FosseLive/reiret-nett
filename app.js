// reiretapp.no/app, lenken i TikTok-bioen (15.10.2026). Sender videre til riktig butikk: iPhone og
// iPad til App Store, Android til Google Play når appen er ute der, og resten til forsiden.
// Lenkene står i siden (data-ios, data-android, data-annet), så den virker også uten skript.
const ua = navigator.userAgent;
const ios =
  /iPhone|iPad|iPod/.test(ua) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const android = /Android/.test(ua);
const lenke = (navn) => document.querySelector(`a[data-${navn}]`)?.getAttribute('href');
const mal = (ios && lenke('ios')) || (android && lenke('android')) || lenke('annet');
if (mal) location.replace(mal);
