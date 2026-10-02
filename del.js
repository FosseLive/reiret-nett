// «Del Reiret»: delingsarket på telefonen (Web Share), ellers kopieres lenken. Knappene står
// skjult i HTML-en og vises først her, så ingen ser en knapp som ikke virker uten skript.
const ADRESSE = 'https://reiret.fosselien.no/';
const DATA = {
  title: 'Reiret',
  text: 'Svangerskapsappen for kommende fedre og partnere.',
  url: ADRESSE,
};

function vis(knapp, tekst) {
  const etikett = knapp.querySelector('span');
  const for_ = knapp.dataset.tekst ?? etikett.textContent;
  knapp.dataset.tekst = for_;
  etikett.textContent = tekst;
  setTimeout(() => (etikett.textContent = for_), 2500);
}

for (const knapp of document.querySelectorAll('[data-del]')) {
  knapp.hidden = false;
  knapp.addEventListener('click', async () => {
    if (navigator.share) {
      // Lukker man arket, kaster share en feil. Da skjer ingenting.
      await navigator.share(DATA).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(ADRESSE);
      vis(knapp, 'Lenken er kopiert');
    } catch {
      vis(knapp, ADRESSE);
    }
  });
}
