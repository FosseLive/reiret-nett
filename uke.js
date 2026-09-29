// «Hvor langt har dere kommet?» på forsiden. Terminen regnes om til uke i nettleseren, på samme
// måte som i appen (src/domain/svangerskap.ts: 283 dager, fullgåtte uker). Datoen sendes ingen
// steder og lagres ikke. Ukedataene (uker.json) lages av scripts/nett/bygg.mjs fra innholdet.

const SVANGERSKAP_DAGER = 283;
const FORSTE = 4;
const SISTE = 42;
const DAG = 86400000;

const seksjon = document.querySelector('.prov');
if (seksjon) start(seksjon);

function start(seksjon) {
  const felt = seksjon.querySelector('#termin');
  const feil = seksjon.querySelector('.feil');
  const kort = seksjon.querySelector('.ukekort');
  const knapper = [...kort.querySelectorAll('.velger button')];
  let uker = null;
  let valgt = null;
  let rolle = 'partner';

  const idag = midnatt(new Date());
  felt.min = iso(new Date(idag.getTime() - 14 * DAG));
  felt.max = iso(new Date(idag.getTime() + SVANGERSKAP_DAGER * DAG));

  async function hentUker() {
    if (!uker) uker = await fetch('/uker.json').then((r) => r.json());
    return uker;
  }
  // Hent dataene først når noen er i nærheten av å bruke dem.
  felt.addEventListener('focus', hentUker, { once: true });

  function visRolle() {
    for (const k of knapper) k.setAttribute('aria-pressed', String(k.dataset.rolle === rolle));
    if (!valgt) return;
    kort.querySelector('.rolletekst').textContent = valgt[rolle];
    kort.querySelector('.oppgave span').textContent =
      rolle === 'gravid' ? valgt.oppgaveGravid : valgt.oppgavePartner;
  }
  for (const k of knapper) {
    k.addEventListener('click', async () => {
      rolle = k.dataset.rolle;
      if (!valgt) valgt = (await hentUker()).find((u) => u.uke === 20);
      visRolle();
    });
  }

  felt.addEventListener('change', async () => {
    feil.hidden = true;
    if (!felt.value) return;
    const termin = midnatt(new Date(`${felt.value}T00:00:00`));
    const dagerIgjen = Math.round((termin - idag) / DAG);
    const gaatt = SVANGERSKAP_DAGER - dagerIgjen;
    if (dagerIgjen > SVANGERSKAP_DAGER || dagerIgjen < -14) {
      feil.textContent = 'Skriv inn en termin innen de neste 40 ukene, eller høyst to uker tilbake.';
      feil.hidden = false;
      return;
    }
    const uke = Math.floor(gaatt / 7);
    const dag = gaatt - uke * 7;
    const liste = await hentUker();
    valgt = liste.find((u) => u.uke === Math.min(SISTE, Math.max(FORSTE, uke)));
    const bilde = kort.querySelector('img');
    bilde.src = valgt.bilde;
    bilde.alt = valgt.alt;
    kort.querySelector('.uketall').textContent =
      uke < FORSTE ? `Uke ${uke}+${dag}. Ukene i appen starter i uke 4.` : `Dere er i uke ${uke}+${dag}`;
    kort.querySelector('h3').textContent = `Omtrent som ${valgt.storrelse}`;
    kort.querySelector('.kort').textContent = valgt.kort;
    visRolle();
  });
}

function midnatt(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function iso(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}
