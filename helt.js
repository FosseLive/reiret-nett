// Heroen på forsiden: gouache-maleriet tegnes i WebGL, så fjorden lever. Rolig glitring hele
// tiden, ringer der musa eller fingeren treffer vannet, og en dråpe når siden åpnes. Når du
// ruller, dykker bildet inn i redet og toner over i papiret, så ukene tar over.
//
// Uten WebGL2 zoomer vi bildet med CSS i stedet. Med redusert bevegelse skjer ingenting av
// dette: bildet står stille og siden ruller som vanlig.

/** Punktene i bildet, som andel av bredde og høyde. Målt i de ferdige WebP-filene. */
const MOTIV = {
  mellom: { egg: [0.855, 0.52], dråpe: [0.4, 0.74], vann: [0.0, 0.69, 0.8, 0.86], zoom: 3.4 },
  bred: { egg: [0.858, 0.641], dråpe: [0.39, 0.575], vann: [0.08, 0.53, 0.66, 0.8], zoom: 3.4 },
  hoy: { egg: [0.738, 0.525], dråpe: [0.37, 0.725], vann: [0.0, 0.68, 0.9, 0.8], zoom: 2.5 },
};
const BOLGER = 8;

const klem = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const glatt = (a, b, x) => {
  const t = klem((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const innUt = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const ut = (t) => 1 - (1 - t) ** 3;
/** Hvor fort dykket tar igjen rullingen, per sekund. Lavere er roligere. */
const FART = matchMedia('(hover: hover) and (pointer: fine)').matches ? 4.5 : 9;

function start(helt) {
  document.documentElement.classList.add('levende');
  const scene = helt.querySelector('.scene');
  const bilde = helt.querySelector('.maleri');
  const tekster = helt.querySelectorAll('.tekst, .hent');
  const dis = helt.querySelector('.dis');
  const lerret = helt.querySelector('canvas');
  const soek = new URLSearchParams(location.search);
  const tempo = Number(soek.get('tempo')) || 1;
  // ?opptak gjør heroen søkbar: tid og fremdrift settes utenfra, bilde for bilde, og ingen
  // tilfeldige dråper. Brukes bare til forhåndsvisningen som video (storyboardet).
  const opptak = soek.has('opptak');
  let fastTid = 0;

  const maler = lagMaler(lerret);
  let motiv = MOTIV.mellom;
  let posisjon = [1, 0.6];
  let bildeForhold = 1;
  let maske = null;
  const bolger = new Float32Array(BOLGER * 4);
  let nesteBolge = 0;
  let sisteSpor = { x: -1, y: -1, t: 0 };
  let nesteDråpe = Infinity;

  const t0 = performance.now();
  const tid = () => (opptak ? fastTid : ((performance.now() - t0) / 1000) * tempo);

  // Utsnittet av bildet som vises: sentrum og størrelse, som andel av bildet.
  let utsnitt = { sentrum: [0.5, 0.5], storrelse: [1, 1] };

  function lesPosisjon() {
    const deler = getComputedStyle(bilde).objectPosition.split(' ').map((d) => parseFloat(d) / 100);
    posisjon = [Number.isFinite(deler[0]) ? deler[0] : 0.5, Number.isFinite(deler[1]) ? deler[1] : 0.5];
  }

  /** Regner ut utsnittet for fremdriften e (0 til 1): fra hele bildet til tett på egget. */
  function regnUtsnitt(e) {
    const b = scene.clientWidth;
    const h = scene.clientHeight;
    const skjerm = b / h;
    const v0 = skjerm > bildeForhold ? [1, bildeForhold / skjerm] : [skjerm / bildeForhold, 1];
    const c0 = [0, 1].map((i) => posisjon[i] * (1 - v0[i]) + v0[i] / 2);
    const z = motiv.zoom ** e;
    const v = [v0[0] / z, v0[1] / z];
    const egg = motiv.egg;
    // Der egget står på skjermen i starten, og så glir det mot midten mens vi nærmer oss.
    const fra = [0, 1].map((i) => 0.5 + (egg[i] - c0[i]) / v0[i]);
    const p = fra.map((f) => f + (0.5 - f) * e);
    const sentrum = [0, 1].map((i) => klem(egg[i] - (p[i] - 0.5) * v[i], v[i] / 2, 1 - v[i] / 2));
    utsnitt = { sentrum, storrelse: v };
    return { z, v0, c0 };
  }

  function tilBilde(klientX, klientY) {
    const r = scene.getBoundingClientRect();
    const s = [(klientX - r.left) / r.width, (klientY - r.top) / r.height];
    return [0, 1].map((i) => utsnitt.sentrum[i] + (s[i] - 0.5) * utsnitt.storrelse[i]);
  }

  function vannVed([x, y]) {
    if (!maske) return 0;
    const i = Math.floor(klem(y) * (maske.h - 1)) * maske.b + Math.floor(klem(x) * (maske.b - 1));
    return maske.data[i];
  }

  function dråpe(punkt, styrke) {
    const i = nesteBolge++ % BOLGER;
    bolger.set([punkt[0], punkt[1], tid(), styrke], i * 4);
  }

  function tilfeldigDråpe() {
    if (maske?.punkter.length) {
      const p = maske.punkter[Math.floor(Math.random() * maske.punkter.length)];
      dråpe(p, 0.35 + Math.random() * 0.25);
    }
    nesteDråpe = tid() + 4 + Math.random() * 5;
  }

  // Musa lager ringer når den går over vannet. Et trykk eller klikk slipper en større dråpe.
  scene.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !maler) return;
    const p = tilBilde(e.clientX, e.clientY);
    const nå = tid();
    const flytt = Math.hypot(p[0] - sisteSpor.x, (p[1] - sisteSpor.y) * 0.4);
    if (vannVed(p) > 0.5 && flytt > 0.018 && nå - sisteSpor.t > 0.09) {
      dråpe(p, 0.45);
      sisteSpor = { x: p[0], y: p[1], t: nå };
    }
  });
  scene.addEventListener('pointerdown', (e) => {
    if (!maler) return;
    const p = tilBilde(e.clientX, e.clientY);
    if (vannVed(p) > 0.4) dråpe(p, 0.9);
  });

  async function lastBilde() {
    const kilde = bilde.currentSrc || bilde.src;
    motiv = kilde.includes('helt-hoy') ? MOTIV.hoy : kilde.includes('helt-bred') ? MOTIV.bred : MOTIV.mellom;
    lesPosisjon();
    const b = new Image();
    b.src = kilde;
    await b.decode();
    bildeForhold = b.naturalWidth / b.naturalHeight;
    maske = lagMaske(b, motiv.vann);
    if (maler && maler.lastInn(b)) {
      maler.vann(motiv.vann, bildeForhold);
      tegn();
      lerret.classList.add('klar');
      if (!opptak) {
        // Første dråpe, like under sola.
        const start = tid();
        setTimeout(() => dråpe(motiv.dråpe, 1), 500 / tempo);
        nesteDråpe = start + 5;
      }
      window.dispatchEvent(new Event('helt-klar'));
    }
  }

  if (bilde.complete && bilde.naturalWidth) lastBilde();
  bilde.addEventListener('load', lastBilde);

  function tilpass() {
    const r = window.devicePixelRatio || 1;
    const b = scene.clientWidth;
    const h = scene.clientHeight;
    // Maks 2x: et malt bilde trenger ikke mer, og på telefon gir 3x et lerret på over 3 megapiksler.
    const tetthet = Math.min(r, 2);
    lerret.width = Math.round(b * tetthet);
    lerret.height = Math.round(h * tetthet);
    lesPosisjon();
    // Ny størrelse tømmer lerretet. Tegn med en gang, så det aldri står tomt til neste bilde.
    if (lerret.classList.contains('klar')) tegn();
  }
  new ResizeObserver(tilpass).observe(scene);
  tilpass();

  function fremdrift() {
    const r = helt.getBoundingClientRect();
    const lengde = r.height - window.innerHeight;
    return lengde > 0 ? klem(-r.top / lengde) : 0;
  }

  let myk = fremdrift();
  let sist = performance.now();

  function oppdater(p) {
    const t = ut(klem(p / 0.3));
    for (const el of tekster) {
      el.style.opacity = String(1 - t);
      el.style.transform = `translate3d(0, ${(-t * 7).toFixed(2)}vh, 0)`;
    }
    dis.style.opacity = String(glatt(0.6, 0.97, p));
    const { z, v0, c0 } = regnUtsnitt(innUt(klem(p / 0.95)));
    if (!maler) {
      // Samme dykk med CSS: flytt og skaler bildet så utsnittet fyller scenen.
      const b = scene.clientWidth;
      const h = scene.clientHeight;
      const x = ((utsnitt.sentrum[0] - utsnitt.storrelse[0] / 2 - (c0[0] - v0[0] / 2)) / v0[0]) * b * z;
      const y = ((utsnitt.sentrum[1] - utsnitt.storrelse[1] / 2 - (c0[1] - v0[1] / 2)) / v0[1]) * h * z;
      bilde.style.transform = `translate3d(${-x}px, ${-y}px, 0) scale(${z})`;
    }
  }

  function tegn() {
    if (maler) maler.tegn(utsnitt, tid(), bolger);
  }

  let kjører = false;
  function ramme(nå) {
    // Maks 100 ms per steg, så etterfølgingen ikke henger etter på trege telefoner.
    const dt = Math.min(0.1, (nå - sist) / 1000);
    sist = nå;
    const p = fremdrift();
    // Myk etterfølging, så dykket glir selv om rullingen hakker. Roligere med mus og styreflate,
    // der ett sveip kan flytte siden en hel skjermhøyde på et øyeblikk (Jonathan 04.10).
    myk += (p - myk) * (1 - Math.exp(-dt * FART));
    if (Math.abs(p - myk) < 0.0004) myk = p;
    oppdater(myk);
    if (myk < 0.5 && tid() > nesteDråpe) tilfeldigDråpe();
    tegn();
    if (kjører) requestAnimationFrame(ramme);
  }
  function settKjøring(på) {
    if (på === kjører) return;
    kjører = på;
    if (på) {
      sist = performance.now();
      requestAnimationFrame(ramme);
    }
  }
  let iBilde = true;
  new IntersectionObserver(([o]) => {
    iBilde = o.isIntersecting;
    settKjøring(iBilde && !document.hidden);
  }).observe(helt);
  document.addEventListener('visibilitychange', () => settKjøring(iBilde && !document.hidden));
  oppdater(myk);
  if (opptak) {
    window.__helt = {
      vis(p, t) {
        fastTid = t;
        oppdater(p);
        tegn();
      },
      dråpe: (x, y, t, styrke) => {
        const i = nesteBolge++ % BOLGER;
        bolger.set([x, y, t, styrke], i * 4);
      },
      tilBilde,
      vannVed,
      motiv: () => motiv,
      klar: () => lerret.classList.contains('klar'),
    };
  } else {
    settKjøring(true);
  }
}

/**
 * Hvor vannet er, lest fra fargene i et lite eksemplar av bildet: blått mer enn rødt, innenfor
 * rammen rundt fjorden. Brukes til å vite om musa er over vannet, og hvor tilfeldige dråper faller.
 */
function lagMaske(b, [x0, y0, x1, y1]) {
  const bredde = 192;
  const hoyde = Math.round((bredde * b.naturalHeight) / b.naturalWidth);
  const c = document.createElement('canvas');
  c.width = bredde;
  c.height = hoyde;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(b, 0, 0, bredde, hoyde);
  const px = g.getImageData(0, 0, bredde, hoyde).data;
  const data = new Float32Array(bredde * hoyde);
  const punkter = [];
  for (let y = 0; y < hoyde; y++) {
    for (let x = 0; x < bredde; x++) {
      const u = x / bredde;
      const v = y / hoyde;
      if (u < x0 || u > x1 || v < y0 || v > y1) continue;
      const i = (y * bredde + x) * 4;
      const r = px[i] / 255;
      const bl = px[i + 2] / 255;
      const m = klem((bl - r - 0.012) / 0.024);
      data[y * bredde + x] = m;
      if (m > 0.8 && x % 3 === 0 && y % 2 === 0) punkter.push([u, v]);
    }
  }
  return { data, b: bredde, h: hoyde, punkter };
}

const TOPP = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Vannet: fargene sier hvor fjorden er (blått mer enn rødt, i en uskarp mip-utgave av bildet).
// Der legger vi en rolig glitring og ringene fra dråpene. Ringene er flattrykte ellipser,
// fordi vi ser vannflaten skrått. Lyset på toppene er papirkrem, så det ser malt ut.
const PIKSEL = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 utFarge;
uniform sampler2D uBilde;
uniform vec2 uSentrum;
uniform vec2 uStorrelse;
uniform float uTid;
uniform float uForhold;
uniform vec4 uVann;
uniform vec4 uBolger[${BOLGER}];

float ramme(vec2 uv) {
  vec2 a = smoothstep(uVann.xy, uVann.xy + 0.015, uv);
  vec2 b = 1.0 - smoothstep(uVann.zw - 0.015, uVann.zw, uv);
  return a.x * a.y * b.x * b.y;
}

float vannmaske(vec2 uv) {
  // Vannet er det eneste i maleriet der blått er sterkere enn rødt (fjorden rundt 0,08,
  // solrefleksen rundt 0,04). Åser, himmel og hus ligger under null.
  vec3 c = textureLod(uBilde, uv, 3.5).rgb;
  return smoothstep(0.012, 0.036, c.b - c.r) * ramme(uv);
}

void main() {
  vec2 uv = uSentrum + (vUv - 0.5) * uStorrelse;
  float m = vannmaske(uv);
  vec2 forskyv = vec2(0.0);
  float lys = 0.0;
  if (m > 0.002) {
    vec2 p = uv * vec2(uForhold, 1.0);
    float s = sin(p.y * 700.0 + sin(p.x * 9.0 + uTid * 0.35) * 4.0 - uTid * 0.9);
    forskyv.x += s * 0.0006 / uForhold;
    lys += smoothstep(0.86, 1.0, s) * (0.5 + 0.5 * sin(p.x * 23.0 - uTid * 0.7)) * 0.07;
    for (int i = 0; i < ${BOLGER}; i++) {
      vec4 b = uBolger[i];
      float alder = uTid - b.z;
      if (b.w <= 0.0 || alder < 0.0 || alder > 6.0) continue;
      vec2 d = (p - vec2(b.x * uForhold, b.y)) * vec2(1.0, 3.2);
      float r = length(d);
      float w = r - alder * 0.07;
      float kappe = exp(-w * w * 1300.0) * exp(-alder * 0.8) * b.w * smoothstep(0.0, 0.12, alder);
      float fase = w * 230.0;
      vec2 retning = d / max(r, 1e-4);
      forskyv += retning * cos(fase) * kappe * vec2(0.006 / uForhold, 0.006 / 3.2);
      lys += sin(fase) * kappe * 0.45;
    }
  }
  vec3 c = texture(uBilde, uv + forskyv * m).rgb;
  c = mix(c, vec3(0.99, 0.97, 0.9), clamp(lys, 0.0, 1.0) * m);
  c *= 1.0 - clamp(-lys, 0.0, 1.0) * 0.3 * m;
  utFarge = vec4(c, 1.0);
}`;

function lagMaler(lerret) {
  // alpha og preserveDrawingBuffer: Safari på iPhone kan vise en tom buffer mens siden ruller. Med
  // alpha viser den da maleriet bak lerretet i stedet for svart, og den forrige tegningen blir
  // stående til den neste er klar (sett som svarte blink på iPhone 02.10, ikke på PC).
  const gl = lerret.getContext('webgl2', {
    alpha: true,
    preserveDrawingBuffer: true,
    antialias: false,
    powerPreference: 'low-power',
  });
  if (!gl) return null;
  const skygge = (type, kilde) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, kilde);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const topp = skygge(gl.VERTEX_SHADER, TOPP);
  const piksel = skygge(gl.FRAGMENT_SHADER, PIKSEL);
  if (!topp || !piksel) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, topp);
  gl.attachShader(prog, piksel);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = (navn) => gl.getUniformLocation(prog, navn);
  const plass = {
    sentrum: u('uSentrum'),
    storrelse: u('uStorrelse'),
    tid: u('uTid'),
    forhold: u('uForhold'),
    vann: u('uVann'),
    bolger: u('uBolger'),
  };
  const tekstur = gl.createTexture();
  const maks = gl.getParameter(gl.MAX_TEXTURE_SIZE);

  return {
    lastInn(b) {
      if (b.naturalWidth > maks || b.naturalHeight > maks) return false;
      gl.bindTexture(gl.TEXTURE_2D, tekstur);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, b);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return true;
    },
    vann(boks, forhold) {
      gl.uniform4fv(plass.vann, boks);
      gl.uniform1f(plass.forhold, forhold);
    },
    tegn(utsnitt, tid, bolger) {
      gl.viewport(0, 0, lerret.width, lerret.height);
      gl.uniform2fv(plass.sentrum, utsnitt.sentrum);
      gl.uniform2fv(plass.storrelse, utsnitt.storrelse);
      gl.uniform1f(plass.tid, tid);
      gl.uniform4fv(plass.bolger, bolger);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

/** Resten av siden toner inn én gang, når hver del kommer til syne. */
function tonInn() {
  const deler = document.querySelectorAll('.ton');
  if (!('IntersectionObserver' in window)) return deler.forEach((d) => d.classList.add('synlig'));
  // Ukestripa ruller sidelengs, så figurene utenfor skjermen ville aldri blitt «synlige».
  // Stripa vises derfor samlet, med stagger fra --n.
  const stripe = document.querySelector('.stripe');
  const vakt = new IntersectionObserver(
    (treff) => {
      for (const t of treff) {
        if (!t.isIntersecting) continue;
        if (t.target === stripe) stripe.querySelectorAll('.ton').forEach((f) => f.classList.add('synlig'));
        t.target.classList.add('synlig');
        vakt.unobserve(t.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px' },
  );
  deler.forEach((d) => !stripe?.contains(d) && vakt.observe(d));
  if (stripe) vakt.observe(stripe);
}

const helt = document.querySelector('.helt');
const redusert = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (helt && !redusert) {
  start(helt);
  tonInn();
}
