// Ciel ce soir : les planètes visibles cette nuit depuis ta ville, la carte du ciel heure par heure, la Lune et les passages de l'ISS.
// Positions calculées sur place (méthode de Paul Schlyter, précise au degré près) ; l'ISS depuis ses éléments d'orbite (CelesTrak), à quelques minutes près.
// Il tourne dans le bac à sable de NeoDex.
const HTML = `<div class="appWrap wide">
  <div class="agHead"><span class="label">Ciel ce soir</span><span class="hint" id="ciWhere"></span></div>
  <div class="gMain"><div class="gameBox"><canvas id="ciCanvas" width="240" height="150" role="img" aria-label="Carte du ciel"></canvas>
      <div class="row ciTime"><input type="range" id="ciT" min="0" max="1000" value="0"><button class="btn" id="ciNow">MAINTENANT</button><button class="btn" id="ciCity">VILLE</button></div></div>
    <div class="gSide">
      <div class="sysCard"><b>CETTE NUIT</b><div class="ciList" id="ciPlanets"></div></div>
      <div class="sysCard"><b>PASSAGES DE L'ISS</b><div class="ciList" id="ciIss"></div></div>
      <div class="hint">La carte montre le ciel au-dessus de toi : le centre est le zénith, le bord l'horizon, le nord en haut et l'est à gauche (comme en levant les yeux). Le bouton VILLE choisit d'où tu regardes.</div>
    </div></div>
</div>`;
const CSS = `.gMain{display:flex;gap:22px;align-items:flex-start;flex-wrap:wrap}
.gameBox{display:grid;place-items:center;padding:10px;background:#05010b;flex:0 0 auto;gap:8px}
.gameBox canvas{height:min(66vh,540px);width:auto;aspect-ratio:240/150;image-rendering:pixelated}
.ciTime{width:100%;justify-content:space-between}.ciTime input{flex:1}
.gSide{display:flex;flex-direction:column;gap:14px;flex:1;min-width:280px;max-width:460px}
.gSide .sysCard{display:flex;flex-direction:column;gap:8px}
.ciList{display:flex;flex-direction:column;gap:6px;line-height:1.5}
.ciList b{color:var(--acc,#ffd84a)}`;
const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const rev = x => ((x % 360) + 360) % 360;
const jd = ms => ms / 86400000 + 2440587.5;
// les éléments d'orbite de Schlyter : N, i, w, a, e, M (et leur dérive par jour)
const CI_ORB = {
  Mercure: [48.3313, 3.24587e-5, 7.0047, 5e-8, 29.1241, 1.01444e-5, .387098, 0, .205635, 5.59e-10, 168.6562, 4.0923344368],
  Vénus: [76.6799, 2.4659e-5, 3.3946, 2.75e-8, 54.891, 1.38374e-5, .72333, 0, .006773, -1.302e-9, 48.0052, 1.6021302244],
  Mars: [49.5574, 2.11081e-5, 1.8497, -1.78e-8, 286.5016, 2.92961e-5, 1.523688, 0, .093405, 2.516e-9, 18.6021, .5240207766],
  Jupiter: [100.4542, 2.76854e-5, 1.303, -1.557e-7, 273.8777, 1.64505e-5, 5.20256, 0, .048498, 4.469e-9, 19.895, .0830853001],
  Saturne: [113.6634, 2.3898e-5, 2.4886, -1.081e-7, 339.3939, 2.97661e-5, 9.55475, 0, .055546, -9.499e-9, 316.967, .0334442282],
};
const CI_LOOK = { Mercure: ['#c8b8a8', 'bas sur l’horizon, juste après le coucher ou avant le lever du soleil'], Vénus: ['#fff4c0', 'l’astre le plus brillant après la Lune'], Mars: ['#ff7a4a', 'un point orangé'], Jupiter: ['#ffe8c8', 'très brillante, d’un blanc crème'], Saturne: ['#e8d088', 'jaune pâle, ses anneaux se voient aux jumelles fortes'] };
function kepler(M, e) { let E = M + e * DEG * Math.sin(M * RAD) * (1 + e * Math.cos(M * RAD)); for (let k = 0; k < 6; k++) E -= (E - e * DEG * Math.sin(E * RAD) - M) / (1 - e * Math.cos(E * RAD)); return E; }
const toEq = (x, y, z, d) => { const ecl = (23.4393 - 3.563e-7 * d) * RAD, ye = y * Math.cos(ecl) - z * Math.sin(ecl), ze = y * Math.sin(ecl) + z * Math.cos(ecl); return { ra: rev(Math.atan2(ye, x) * DEG), dec: Math.atan2(ze, Math.hypot(x, ye)) * DEG, dist: Math.hypot(x, y, z) }; };
function sunEcl(d) { const w = 282.9404 + 4.70935e-5 * d, e = .016709 - 1.151e-9 * d, M = rev(356.047 + .9856002585 * d), E = kepler(M, e) * RAD, xv = Math.cos(E) - e, yv = Math.sqrt(1 - e * e) * Math.sin(E), lon = Math.atan2(yv, xv) * DEG + w, r = Math.hypot(xv, yv); return { x: r * Math.cos(lon * RAD), y: r * Math.sin(lon * RAD), lon: rev(lon), M }; }
const sunPos = ms => { const d = jd(ms) - 2451543.5, s = sunEcl(d); return toEq(s.x, s.y, 0, d); };  // le Soleil seul (bien plus rapide)
function bodies(ms) {  // ascension droite et déclinaison du Soleil, de la Lune et des planètes à cet instant
  const d = jd(ms) - 2451543.5, s = sunEcl(d), out = { Soleil: toEq(s.x, s.y, 0, d) };
  for (const [name, o] of Object.entries(CI_ORB)) {
    const N = (o[0] + o[1] * d) * RAD, i = (o[2] + o[3] * d) * RAD, w = o[4] + o[5] * d, a = o[6], e = o[8] + o[9] * d, M = rev(o[10] + o[11] * d);
    const E = kepler(M, e) * RAD, xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E), v = Math.atan2(yv, xv) * DEG, r = Math.hypot(xv, yv), u = (v + w) * RAD;
    const xh = r * (Math.cos(N) * Math.cos(u) - Math.sin(N) * Math.sin(u) * Math.cos(i)), yh = r * (Math.sin(N) * Math.cos(u) + Math.cos(N) * Math.sin(u) * Math.cos(i)), zh = r * Math.sin(u) * Math.sin(i);
    out[name] = toEq(xh + s.x, yh + s.y, zh, d); out[name].elong = Math.acos(Math.max(-1, Math.min(1, ((xh + s.x) * s.x + (yh + s.y) * s.y) / (Math.hypot(xh + s.x, yh + s.y, zh) * Math.hypot(s.x, s.y))))) * DEG;
  }
  { // la Lune, avec ses plus grosses perturbations
    const N = rev(125.1228 - .0529538083 * d), i = 5.1454, w = rev(318.0634 + .1643573223 * d), e = .0549, M = rev(115.3654 + 13.0649929509 * d);
    const E = kepler(M, e) * RAD, xv = 60.2666 * (Math.cos(E) - e), yv = 60.2666 * Math.sqrt(1 - e * e) * Math.sin(E), v = Math.atan2(yv, xv) * DEG, r = Math.hypot(xv, yv), u = (v + w) * RAD;
    const xh = r * (Math.cos(N * RAD) * Math.cos(u) - Math.sin(N * RAD) * Math.sin(u) * Math.cos(i * RAD)), yh = r * (Math.sin(N * RAD) * Math.cos(u) + Math.cos(N * RAD) * Math.sin(u) * Math.cos(i * RAD)), zh = r * Math.sin(u) * Math.sin(i * RAD);
    let lon = Math.atan2(yh, xh) * DEG, lat = Math.atan2(zh, Math.hypot(xh, yh)) * DEG;
    const Lm = rev(N + w + M), D = rev(Lm - s.lon), F = rev(Lm - N);
    lon += -1.274 * Math.sin((M - 2 * D) * RAD) + .658 * Math.sin(2 * D * RAD) - .186 * Math.sin(s.M * RAD) - .059 * Math.sin((2 * M - 2 * D) * RAD) - .057 * Math.sin((M - 2 * D + s.M) * RAD) + .053 * Math.sin((M + 2 * D) * RAD);
    lat += -.173 * Math.sin((F - 2 * D) * RAD);
    const q = toEq(Math.cos(lon * RAD) * Math.cos(lat * RAD), Math.sin(lon * RAD) * Math.cos(lat * RAD), Math.sin(lat * RAD), d);
    q.elong = Math.acos(Math.cos(lat * RAD) * Math.cos((lon - s.lon) * RAD)) * DEG; q.waxing = rev(lon - s.lon) < 180; out.Lune = q;
  }
  return out;
}
const gmst = ms => rev(280.46061837 + 360.98564736629 * (jd(ms) - 2451545));
function altAz(ra, dec, ms, lat, lon) {
  const H = (gmst(ms) + lon - ra) * RAD, f = lat * RAD, dd = dec * RAD;
  const alt = Math.asin(Math.sin(f) * Math.sin(dd) + Math.cos(f) * Math.cos(dd) * Math.cos(H)) * DEG;
  return { alt, az: rev(Math.atan2(-Math.cos(dd) * Math.sin(H), Math.sin(dd) * Math.cos(f) - Math.cos(dd) * Math.sin(f) * Math.cos(H)) * DEG) };
}
const CI_DIR = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
const dir = az => CI_DIR[Math.round(rev(az) / 45) % 8];
// les étoiles brillantes (ascension droite en heures, déclinaison, magnitude) et quelques constellations
const CI_STARS = `Sirius 6.752 -16.716 -1.46|Arcturus 14.261 19.182 -.05|Véga 18.616 38.784 .03|Capella 5.278 45.998 .08|Rigel 5.242 -8.202 .13|Procyon 7.655 5.225 .34|Bételgeuse 5.919 7.407 .5|Altaïr 19.846 8.868 .77|Aldébaran 4.599 16.509 .85|Antarès 16.49 -26.432 1|Spica 13.42 -11.161 1.04|Pollux 7.755 28.026 1.14|Fomalhaut 22.961 -29.622 1.16|Deneb 20.69 45.28 1.25|Régulus 10.14 11.967 1.35|Castor 7.577 31.888 1.58|Bellatrix 5.419 6.35 1.64|Alnilam 5.604 -1.202 1.69|Alnitak 5.679 -1.943 1.74|Mintaka 5.533 -.299 2.23|Saïph 5.796 -9.67 2.06|Polaire 2.53 89.264 1.98|Dubhe 11.062 61.751 1.79|Merak 11.031 56.382 2.37|Phecda 11.897 53.695 2.44|Megrez 12.257 57.033 3.31|Alioth 12.9 55.96 1.77|Mizar 13.399 54.925 2.27|Alkaïd 13.792 49.313 1.86|Schédar .675 56.537 2.24|Caph .153 59.15 2.28|Gamma Cas .945 60.717 2.47|Ruchbah 1.43 60.235 2.68|Ségin 1.907 63.67 3.37|Sadr 20.37 40.257 2.23|Gienah 20.77 33.97 2.48|Delta Cyg 19.75 45.131 2.87|Albireo 19.512 27.96 3.08|Mirfak 3.405 49.861 1.79|Alphératz .14 29.09 2.06|Hamal 2.12 23.462 2|Algol 3.136 40.956 2.1|Dénébola 11.818 14.572 2.14|Alphard 9.46 -8.659 1.98|Elnath 5.438 28.608 1.65|Alhena 6.629 16.399 1.93|Pléiades 3.791 24.105 1.6|Kochab 14.845 74.156 2.08|Rasalhague 17.582 12.56 2.08`
  .split('|').map(s => { const p = s.split(' '), mag = +p.pop(), dec = +p.pop(), ra = +p.pop() * 15; return { name: p.join(' '), ra, dec, mag }; });
const CI_LINES = [['Bételgeuse', 'Bellatrix'], ['Bételgeuse', 'Alnitak'], ['Bellatrix', 'Mintaka'], ['Mintaka', 'Alnilam'], ['Alnilam', 'Alnitak'], ['Mintaka', 'Rigel'], ['Alnitak', 'Saïph'],
  ['Dubhe', 'Merak'], ['Merak', 'Phecda'], ['Phecda', 'Megrez'], ['Megrez', 'Dubhe'], ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaïd'],
  ['Ségin', 'Ruchbah'], ['Ruchbah', 'Gamma Cas'], ['Gamma Cas', 'Schédar'], ['Schédar', 'Caph'], ['Deneb', 'Sadr'], ['Sadr', 'Albireo'], ['Gienah', 'Sadr'], ['Sadr', 'Delta Cyg'], ['Castor', 'Pollux']];
// l'ISS : ses éléments d'orbite (format TLE), puis sa position à tout instant (Kepler + aplatissement de la Terre + freinage)
function tle(l1, l2) {
  const yy = +l1.slice(18, 20), day = +l1.slice(20, 32), epoch = Date.UTC(yy < 57 ? 2000 + yy : 1900 + yy, 0, 1) + (day - 1) * 86400000;
  return { epoch, ndot2: +l1.slice(33, 43), i: +l2.slice(8, 16), raan: +l2.slice(17, 25), e: +('.' + l2.slice(26, 33).trim()), argp: +l2.slice(34, 42), M: +l2.slice(43, 51), n: +l2.slice(52, 63) };
}
function issEci(T, ms) {
  const MU = 398600.4418, RE = 6378.137, J2 = .00108263, dtd = (ms - T.epoch) / 86400000, n0 = T.n * 2 * Math.PI / 86400, a = Math.cbrt(MU / (n0 * n0)), e = T.e, i = T.i * RAD;
  const p = a * (1 - e * e), k = 1.5 * J2 * (RE / p) ** 2 * n0 * 86400 * DEG, si = Math.sin(i) ** 2;
  const raan = (T.raan - k * Math.cos(i) * dtd) * RAD, argp = (T.argp + k * (2 - 2.5 * si) * dtd) * RAD;
  const M = rev(T.M + (T.n * 360 + k * Math.sqrt(1 - e * e) * (1 - 1.5 * si)) * dtd + T.ndot2 * 360 * dtd * dtd);
  const E = kepler(M, e) * RAD, xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E), v = Math.atan2(yv, xv), r = Math.hypot(xv, yv), u = v + argp;
  return [r * (Math.cos(raan) * Math.cos(u) - Math.sin(raan) * Math.sin(u) * Math.cos(i)), r * (Math.sin(raan) * Math.cos(u) + Math.cos(raan) * Math.sin(u) * Math.cos(i)), r * Math.sin(u) * Math.sin(i)];
}
function issLook(T, ms, lat, lon) {  // hauteur et direction de l'ISS vue d'ici, et si elle est au soleil
  const [x, y, z] = issEci(T, ms), th = (gmst(ms) + lon) * RAD, f = lat * RAD, RE = 6378.137;
  const ox = RE * Math.cos(f) * Math.cos(th), oy = RE * Math.cos(f) * Math.sin(th), oz = RE * Math.sin(f), dx = x - ox, dy = y - oy, dz = z - oz;
  const up = Math.cos(f) * Math.cos(th) * dx + Math.cos(f) * Math.sin(th) * dy + Math.sin(f) * dz, east = -Math.sin(th) * dx + Math.cos(th) * dy, north = -Math.sin(f) * Math.cos(th) * dx - Math.sin(f) * Math.sin(th) * dy + Math.cos(f) * dz;
  const sun = sunPos(ms), sx = Math.cos(sun.dec * RAD) * Math.cos(sun.ra * RAD), sy = Math.cos(sun.dec * RAD) * Math.sin(sun.ra * RAD), sz = Math.sin(sun.dec * RAD), dot = x * sx + y * sy + z * sz;
  const lit = dot > 0 || Math.sqrt(x * x + y * y + z * z - dot * dot) > RE;
  return { alt: Math.atan2(up, Math.hypot(east, north)) * DEG, az: rev(Math.atan2(east, north) * DEG), lit, h: Math.hypot(x, y, z) - RE };
}
/* ---------- l'habillage pixel art, dessiné à la main : police bitmap (accents compris), cadres, boutons, icônes ----------
   Tout est en pixels pleins, agrandis par 2 sans lissage : aucun dégradé, aucune ombre floue. */
const PXK = (() => {
  // chaque lettre : ses lignes, de haut en bas, à partir de la ligne 2 de la case (0-1 : accents des majuscules, 9-10 : jambages)
  const S = {
    A: '.###. #...# #...# ##### #...# #...# #...#', B: '####. #...# #...# ####. #...# #...# ####.', C: '.###. #...# #.... #.... #.... #...# .###.',
    D: '####. #...# #...# #...# #...# #...# ####.', E: '##### #.... #.... ####. #.... #.... #####', F: '##### #.... #.... ####. #.... #.... #....',
    G: '.###. #...# #.... #.### #...# #...# .####', H: '#...# #...# #...# ##### #...# #...# #...#', I: '### .#. .#. .#. .#. .#. ###',
    J: '..### ...#. ...#. ...#. #..#. #..#. .##..', K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#', L: '#.... #.... #.... #.... #.... #.... #####',
    M: '#...# ##.## #.#.# #.#.# #...# #...# #...#', N: '#...# ##..# #.#.# #..## #...# #...# #...#', O: '.###. #...# #...# #...# #...# #...# .###.',
    P: '####. #...# #...# ####. #.... #.... #....', Q: '.###. #...# #...# #...# #.#.# #..#. .##.#', R: '####. #...# #...# ####. #.#.. #..#. #...#',
    S: '.#### #.... #.... .###. ....# ....# ####.', T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..', U: '#...# #...# #...# #...# #...# #...# .###.',
    V: '#...# #...# #...# #...# #...# .#.#. ..#..', W: '#...# #...# #...# #.#.# #.#.# ##.## #...#', X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
    Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..', Z: '##### ....# ...#. ..#.. .#... #.... #####',
    a: '..... ..... .###. ....# .#### #...# .####', b: '#.... #.... ####. #...# #...# #...# ####.', c: '..... ..... .###. #.... #.... #.... .###.',
    d: '....# ....# .#### #...# #...# #...# .####', e: '..... ..... .###. #...# ##### #.... .###.', f: '..## .#.. #### .#.. .#.. .#.. .#..',
    g: '..... ..... .#### #...# #...# #...# .#### ....# .###.', h: '#.... #.... ####. #...# #...# #...# #...#', i: '.#. ... ##. .#. .#. .#. ###',
    'ı': '... ... ##. .#. .#. .#. ###', j: '...# .... ..## ...# ...# ...# ...# #..# .##.', k: '#... #... #..# #.#. ##.. #.#. #..#',
    l: '##. .#. .#. .#. .#. .#. ###', m: '..... ..... ##.#. #.#.# #.#.# #.#.# #...#', n: '..... ..... ####. #...# #...# #...# #...#',
    o: '..... ..... .###. #...# #...# #...# .###.', p: '..... ..... ####. #...# #...# #...# ####. #.... #....', q: '..... ..... .#### #...# #...# #...# .#### ....# ....#',
    r: '.... .... #.## ##.. #... #... #...', s: '..... ..... .#### #.... .###. ....# ####.', t: '.#.. .#.. #### .#.. .#.. .#.. ..##',
    u: '..... ..... #...# #...# #...# #..## .##.#', v: '..... ..... #...# #...# #...# .#.#. ..#..', w: '..... ..... #...# #...# #.#.# #.#.# .#.#.',
    x: '..... ..... #...# .#.#. ..#.. .#.#. #...#', y: '..... ..... #...# #...# #...# #...# .#### ....# .###.', z: '..... ..... ##### ...#. ..#.. .#... #####',
    0: '.###. #...# #..## #.#.# ##..# #...# .###.', 1: '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.', 2: '.###. #...# ....# ...#. ..#.. .#... #####',
    3: '####. ....# ....# .###. ....# ....# ####.', 4: '...#. ..##. .#.#. #..#. ##### ...#. ...#.', 5: '##### #.... ####. ....# ....# #...# .###.',
    6: '.###. #.... #.... ####. #...# #...# .###.', 7: '##### ....# ...#. ..#.. .#... .#... .#...', 8: '.###. #...# #...# .###. #...# #...# .###.',
    9: '.###. #...# #...# .#### ....# ....# .###.',
    '.': '. . . . . . #', ',': '.. .. .. .. .. .# .# #.', ':': '. . # . . . #', ';': '.. .. .# .. .. .# .# #.', '!': '# # # # # . #',
    '?': '.###. #...# ....# ...#. ..#.. ..... ..#..', "'": '# # . . . . .', '"': '#.# #.# ... ... ... ... ...', '-': '... ... ... ### ... ... ...',
    '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....', '/': '....# ...#. ...#. ..#.. .#... .#... #....', '(': '.# #. #. #. #. #. .#', ')': '#. .# .# .# .# .# #.',
    '%': '##..# ##.#. ...#. ..#.. .#... .#.## #..##', '·': '. . . # . . .', '×': '..... ..... #...# .#.#. ..#.. .#.#. #...#',
    '<': '...# ..#. .#.. #... .#.. ..#. ...#', '>': '#... .#.. ..#. ...# ..#. .#.. #...', '=': '.... .... #### .... #### .... ....',
    '_': '..... ..... ..... ..... ..... ..... #####', '#': '.#.#. .#.#. ##### .#.#. ##### .#.#. .#.#.', '&': '.##.. #..#. #.#.. .#... #.#.# #..#. .##.#',
    '…': '..... ..... ..... ..... ..... ..... #.#.#', '«': '..... ..#.# .#.#. #.#.. .#.#. ..#.# .....', '»': '..... #.#.. .#.#. ..#.# .#.#. #.#.. .....',
    '◀': '...# ..## .### #### .### ..## ...#', '▶': '#... ##.. ###. #### ###. ##.. #...', '→': '..... ..#.. ...#. ##### ...#. ..#.. .....',
    '←': '..... ..#.. .#... ##### .#... ..#.. .....', '↑': '..#.. .###. #.#.# ..#.. ..#.. ..#.. ..#..', '↓': '..#.. ..#.. ..#.. ..#.. #.#.# .###. ..#..',
    '*': '..... #.#.# .###. ##### .###. #.#.# .....', '[': '## #. #. #. #. #. ##', ']': '## .# .# .# .# .# ##', '|': '# # # # # # #',
    '@': '.###. #...# #.### #.#.# #.### #.... .###.', '€': '..### .#... ####. .#... ####. .#... ..###', '$': '..#.. .#### #.#.. .###. ..#.# ####. ..#..',
    '°': '.#. #.# .#. ... ... ... ...', '~': '..... ..... .#..# #.##. ..... ..... .....', '♪': '..##. ..#.# ..#.. ..#.. .##.. ###.. .#...',
  };
  const ACC = { a: ['..#', '.#.'], g: ['#..', '.#.'], c: ['.#.', '#.#'], d: ['...', '#.#'], t: ['.#.#', '#.#.'], z: ['.#.', '##.'] };  // aigu, grave, circonflexe, tréma, tilde, cédille
  const COMP = { é: 'ea', è: 'eg', ê: 'ec', ë: 'ed', á: 'aa', à: 'ag', â: 'ac', ä: 'ad', í: 'ıa', ì: 'ıg', î: 'ıc', ï: 'ıd', ó: 'oa', ò: 'og', ô: 'oc', ö: 'od',
    ú: 'ua', ù: 'ug', û: 'uc', ü: 'ud', ÿ: 'yd', ñ: 'nt', ç: 'cz', É: 'Ea', È: 'Eg', Ê: 'Ec', Ë: 'Ed', Á: 'Aa', À: 'Ag', Â: 'Ac', Ä: 'Ad', Í: 'Ia', Î: 'Ic', Ï: 'Id',
    Ó: 'Oa', Ô: 'Oc', Ö: 'Od', Ú: 'Ua', Ù: 'Ug', Û: 'Uc', Ü: 'Ud', Ñ: 'Nt', Ç: 'Cz' };
  const SUB = { 'œ': 'oe', 'Œ': 'OE', '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-', ' ': ' ', ' ': ' ', '•': '·', '✓': 'v', 'ᐸ': '<', 'ᐳ': '>', '＜': '<', '＞': '>', '｜': '|', '／': '/', '！': '!', '？': '?', '（': '(', '）': ')', '：': ':', '　': ' ' };  // ᐸ ᐳ : les < > des titres YouTube
  const H = 11, glyphs = new Map(); let raster;
  function glyph(ch) {
    let g = glyphs.get(ch); if (g) return g;
    const px = [], add = (rows, ox, oy) => rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') px.push([ox + x, oy + y]); });
    const c = COMP[ch], src = S[c ? c[0] : ch]; let w = 3;
    if (src) {
      const rows = src.split(' '); w = Math.max(...rows.map(r => r.length)); add(rows, 0, 2);
      if (c) { const a = ACC[c[1]]; add(a, Math.floor((w - a[0].length) / 2), c[1] === 'z' ? 9 : /[A-Z]/.test(c[0]) ? 0 : 1); }
    } else if (ch !== ' ') {  // japonais, emoji… : la lettre du système, réduite à des pixels nets (sans lissage) sur la même hauteur que la police
      const q = (raster ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })), RW = 16;
      q.canvas.width = RW; q.canvas.height = H; q.font = '11px "MS Gothic", "Yu Gothic UI", Meiryo, "Segoe UI Symbol", sans-serif'; q.fillStyle = '#000'; q.fillText(ch, 0, 10);
      const d = q.getImageData(0, 0, RW, H).data; let mx = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < RW; x++) if (d[(y * RW + x) * 4 + 3] > 110) { px.push([x, y]); mx = Math.max(mx, x + 1); }
      w = mx || 3;
      if (!px.length) { w = 5; add(['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####'], 0, 2); }  // vraiment inconnue : une petite case
    }
    g = { w, px }; glyphs.set(ch, g); return g;
  }
  function layout(text) {
    let x = 0; const items = [];
    for (const ch of String(text)) for (const c of SUB[ch] ?? ch) { const g = glyph(c); items.push([g, x]); x += g.w + 1; }
    return { w: Math.max(0, x - 1), items };
  }
  function draw(g, text, x, y, color, s = 1) {  // (x, y) : coin haut gauche de la case
    const L = layout(text); g.fillStyle = color;
    for (const [gl, ox] of L.items) for (const [px, py] of gl.px) g.fillRect(x + (ox + px) * s, y + py * s, s, s);
    return L.w * s;
  }
  const bmp = new Map();
  function sprite(text, color, s = 1) {  // le texte tout prêt, gardé pour les images suivantes du jeu
    const k = text + '|' + color + '|' + s; let c = bmp.get(k); if (c) return c;
    c = document.createElement('canvas'); c.width = Math.max(1, layout(text).w * s); c.height = H * s; draw(c.getContext('2d'), text, 0, 0, color, s);
    if (bmp.size > 400) bmp.delete(bmp.keys().next().value);
    bmp.set(k, c); return c;
  }
  // comme fillText : (x, y) sur la ligne de base, aligné à gauche, au centre ou à droite
  function fill(g, text, x, y, color, s = 1, align = 'left') {
    const c = sprite(String(text), color, s), dx = align === 'center' ? -c.width / 2 : align === 'right' ? -c.width : 0;
    g.drawImage(c, Math.round(x + dx), Math.round(y - 9 * s));
  }
  const scale = size => Math.max(1, Math.round((size || 8) / 8));
  function art(rows, pal, s = 1) {  // un dessin en lignes de caractères, chaque caractère une couleur de la palette (« . » : transparent)
    const c = document.createElement('canvas'); c.width = Math.max(...rows.map(r => r.length)) * s; c.height = rows.length * s;
    const g = c.getContext('2d');
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const col = pal[r[x]]; if (col) { g.fillStyle = col; g.fillRect(x * s, y * s, s, s); } } });
    return c;
  }
  return { H, layout, draw, sprite, fill, scale, art };
})();

// les pièces de l'interface, pixel par pixel (K : contour, les autres lettres : la palette du jeu)
const PX_PANEL = ['..KKKKKKKKKKKK..', '.KAAAAAAAAAAAAK.', 'KALAAAAAAAAAALSK', 'KAAKKKKKKKKKKSSK', 'KAAKHHHHHHHHKSSK', 'KAAKHDDDDDDDKSSK', 'KAAKHDDDDDDDKSSK', 'KAAKHDDDDDDDKSSK',
  'KAAKHDDDDDDDKSSK', 'KAAKHDDDDDDDKSSK', 'KAAKHDDDDDDDKSSK', 'KAAKHDDDDDDDKSSK', 'KAAKKKKKKKKKKSSK', 'KALSSSSSSSSSSLSK', '.KSSSSSSSSSSSSK.', '..KKKKKKKKKKKK..'];
const PX_CARD = ['.KKKKKKKKKK.', 'KFFFFFFFFFFK', 'KFHHHHHHHHFK', 'KFHDDDDDDDFK', 'KFHDDDDDDDFK', 'KFHDDDDDDDFK', 'KFHDDDDDDDFK', 'KFHDDDDDDDFK', 'KFHDDDDDDDFK', 'KFSSSSSSSSFK', 'KFFFFFFFFFFK', '.KKKKKKKKKK.'];
const PX_BTN = ['.KKKKKKKKKK.', 'KWWWWWWWWWWK', 'KWMMMMMMMMBK', 'KWMMMMMMMMBK', 'KWMMMMMMMMBK', 'KWMMMMMMMMBK', 'KWMMMMMMMMBK', 'KWMMMMMMMMBK', 'KBBBBBBBBBBK', 'KKKKKKKKKKKK', 'KDDDDDDDDDDK', '.KKKKKKKKKK.'];
const PX_BTN_DOWN = ['............', '............', '.KKKKKKKKKK.', 'KBBBBBBBBBBK', 'KBMMMMMMMMWK', 'KBMMMMMMMMWK', 'KBMMMMMMMMWK', 'KBMMMMMMMMWK', 'KBMMMMMMMMWK', 'KBMMMMMMMMWK', 'KWWWWWWWWWWK', '.KKKKKKKKKK.'];
const PX_TRACK = ['.KKKKKKKKKK.', 'KDDDDDDDDDDK', 'KDDDDDDDDDDK', 'KDDDDDDDDDDK', 'KHHHHHHHHHHK', '.KKKKKKKKKK.'];
const PX_KNOB = ['.KKKKK.', 'KWWWWWK', 'KWAAABK', 'KWAAABK', 'KKKKKKK', 'KWAAABK', 'KWAAABK', 'KBBBBBK', 'KDDDDDK', '.KKKKK.'];
const PX_RAIL = ['KDDDDDDK', 'KDDDDDDK', 'KDDDDDDK', 'KDDHHDDK'];
const PX_ICONS = {
  play: ['kk......', 'kakk....', 'kaaakk..', 'kaaaaakk', 'kaaaaaak', 'kaaaaakk', 'kaaakk..', 'kakk....', 'kk......'],
  full: ['www...www', 'w.......w', 'w.......w', '.........', '....a....', '.........', 'w.......w', 'w.......w', 'www...www'],
  note: ['...aaaaaa', '...aaaaaa', '...a....a', '...a....a', '...a....a', '.aaa..aaa', 'aaaa.aaaa', 'aaaa.aaaa', '.aa...aa.'],
  star: ['....g....', '....g....', '...ggg...', 'ggggwgggg', '.ggwwwgg.', '..ggggg..', '..oo.oo..', '.oo...oo.', '.o.....o.'],
  crown: ['g...g...g', 'gg.ggg.gg', 'ggggggggg', 'grgggggrg', 'ggggggggg', 'ooooooooo'],
  folder: ['oooo.....', 'oggoooooo', 'ggggggggg', 'ggggggggg', 'ggggggggg', 'ggggggggg', 'ooooooooo'],
  vol: ['....w....', '...ww..b.', 'wwwww.b.b', 'wwwww.b.b', 'wwwww.b.b', 'wwwww.b.b', '...ww..b.', '....w....'],
  clock: ['..wwwww..', '.w.....w.', 'w...a...w', 'w...a...w', 'w...aaa.w', 'w.......w', 'w.......w', '.w.....w.', '..wwwww..'],
  cursor: ['....a....', '..aaaaa..', '.a..a..a.', '.a.....a.', 'aaa.w.aaa', '.a.....a.', '.a..a..a.', '..aaaaa..', '....a....'],
  plus: ['...b...', '...b...', '...b...', 'bbbbbbb', '...b...', '...b...', '...b...'],
  down: ['wwwwwww', '.wwwww.', '..www..', '...w...'],
};

/* habille la page du jeu : root = son conteneur, T = sa palette, icons = [motif du texte, icône] pour les boutons et libellés */
function pxSkin(root, { T, icons = [], emblem, title }) {
  root.classList.add('pxk'); const s = 2, url = c => c.toDataURL();
  const btnPal = (M, W, B, D) => ({ K: T.k, W, M, B, D });
  const BN = btnPal(T.btn, T.btnHi, T.btnLo, T.k2), BH = btnPal(T.btnHov, T.btnHovHi, T.btnLo, T.k2);
  const BA = btnPal(T.acc, T.accL, T.accS, T.accD), BAH = btnPal(T.accL, '#ffffff', T.acc, T.accD);
  const img = { panel: PXK.art(PX_PANEL, { K: T.k, A: T.acc, S: T.accS, L: T.rivet, H: T.hl, D: T.fill }, s),
    card: PXK.art(PX_CARD, { K: T.k, F: T.line, H: T.hl, D: T.fill, S: T.k2 }, s), cardOn: PXK.art(PX_CARD, { K: T.k, F: T.acc, H: T.accS, D: T.fillOn, S: T.accD }, s),
    btn: PXK.art(PX_BTN, BN, s), btnH: PXK.art(PX_BTN, BH, s), btnD: PXK.art(PX_BTN_DOWN, BH, s),
    main: PXK.art(PX_BTN, BA, s), mainH: PXK.art(PX_BTN, BAH, s), mainD: PXK.art(PX_BTN_DOWN, BA, s),
    track: PXK.art(PX_TRACK, { K: T.k, D: T.k2, H: T.line }, s), knob: PXK.art(PX_KNOB, { K: T.k, W: T.accL, A: T.acc, B: T.accS, D: T.accD }, s),
    rail: PXK.art(PX_RAIL, { K: T.k, D: T.k2, H: T.line }, s), tile: PXK.art(T.tile, { x: T.bgDot, ':': T.bgDot2, '+': T.spark, '*': T.spark2 }, s) };
  const u = Object.fromEntries(Object.entries(img).map(([k, c]) => [k, url(c)]));
  const nine = (k, sl) => `border-style:solid;border-width:${sl * s}px;border-image:url(${u[k]}) ${sl * s} fill / ${sl * s}px stretch`;
  const IP = { k: T.k, w: T.text, a: T.acc, b: T.acc2, g: T.gold, o: T.orange, r: T.red, n: T.green, N: T.green2, m: T.muted, s: T.accS };
  const iconUrl = new Map(), icon = name => {
    let v = iconUrl.get(name); if (!v) { const c = PXK.art(PX_ICONS[name] || emblem, IP, s); v = { u: url(c), w: c.width, h: c.height }; iconUrl.set(name, v); }
    const b = document.createElement('b'); b.className = 'pxI'; b.setAttribute('aria-hidden', 'true'); b.style.cssText = `width:${v.w}px;height:${v.h}px;background-image:url(${v.u})`; return b;
  };
  const R = '.pxk.pxk';
  const css = document.createElement('style');
  css.textContent = `html,html body{background:${T.bg} url(${u.tile}) 0 0/${img.tile.width}px ${img.tile.height}px repeat!important}
::-webkit-scrollbar{width:16px;height:16px} ::-webkit-scrollbar-track{background:url(${u.rail}) 0 0/16px 8px repeat-y} ::-webkit-scrollbar-thumb{${nine('main', 4)}} ::-webkit-scrollbar-corner{background:none}
${R}{color:${T.text}}
${R} .px{box-shadow:none;background:none}
${R} .agHead{gap:18px;margin:0}
${R} .agHead .label{display:flex;align-items:center;gap:12px}
${R} .btn,${R} .tab{${nine('btn', 4)};height:auto;min-height:0;padding:0 6px 4px;margin:0;color:${T.text};font:12px/1 monospace;display:inline-flex;align-items:center;gap:6px;filter:none;text-shadow:none;letter-spacing:0;cursor:var(--cp,pointer)}
${R} .btn:hover,${R} .tab:hover{border-image-source:url(${u.btnH})}
${R} .btn:active,${R} .tab:active{border-image-source:url(${u.btnD});padding:4px 6px 0}
${R} .btn.main,${R} .tab.on{border-image-source:url(${u.main});color:${T.k}}
${R} .btn.main:hover,${R} .tab.on:hover{border-image-source:url(${u.mainH})}
${R} .btn.main:active,${R} .tab.on:active{border-image-source:url(${u.mainD})}
${R} .btn:focus-visible,${R} .tab:focus-visible{outline:2px dashed ${T.acc2};outline-offset:2px}
${R} .btn .pxV,${R} .tab .pxV{white-space:nowrap}
${R} .sysCard{${nine('card', 4)};padding:4px 6px;gap:8px;background:none}
${R} .sysCard.on{border-image-source:url(${u.cardOn})}
${R} .sysCard.on>b{color:${T.acc}}
${R} .sysCard>b{color:${T.text}}
${R} .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
${R} .gameBox,${R} .thBox{${nine('panel', 5)};box-shadow:none;background:none;padding:2px;gap:8px;grid-template-rows:auto auto}
${R} .gameBox canvas,${R} .thBox canvas{display:block;background:#05010b}
${R} .gameBox:fullscreen,${R} .thBox:fullscreen{border:0;padding:0;background:#000}
${R} .rhFs{position:static;opacity:1;justify-self:end;margin:0 6px 6px 0}
${R} .rhTabs{gap:8px;flex-wrap:wrap}
${R} .hint{color:${T.muted};line-height:24px}
${R} label{color:${T.muted};display:inline-flex;align-items:center;gap:8px}
${R} .rhDel{color:${T.red};top:6px;right:8px}
${R} input[type=range]{-webkit-appearance:none;appearance:none;background:none;height:20px;width:150px}
${R} input[type=range]::-webkit-slider-runnable-track{height:12px;${nine('track', 2)}}
${R} input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:20px;border:0;background:url(${u.knob}) 0 0/100% 100%;margin-top:-8px;cursor:var(--cp,pointer)}
${R} .pxSel{justify-content:space-between;gap:10px;max-width:100%;overflow:hidden}
${R} .rhImport .pxSel{flex:1;min-width:0}
.pxMenu{position:fixed;z-index:50;${nine('card', 4)};padding:2px;max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;color:${T.text}}
.pxMenu button{all:unset;padding:3px 8px;cursor:var(--cp,pointer);white-space:nowrap}
.pxMenu button:hover,.pxMenu button:focus-visible,.pxMenu button.on{background:${T.btnHov};color:${T.text}}
.pxMenu button.on{color:${T.acc}}
.pxT{position:relative;white-space:normal;font:12px/1 monospace;letter-spacing:0;text-transform:none}
.pxT i{display:inline-block;vertical-align:middle;background:currentColor;-webkit-mask:var(--m) 0 0/100% 100% no-repeat;mask:var(--m) 0 0/100% 100% no-repeat;image-rendering:pixelated}
.pxI{display:inline-block;vertical-align:middle;background:0 0/100% 100% no-repeat;image-rendering:pixelated;margin-right:6px}
.pxV>.pxI+.pxI{margin-left:-4px}
.pxSr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`;
  document.head.append(css);
  // un mot = une image (en masque : sa couleur suit celle du texte), une règle par mot pour ne pas répéter l'image
  const words = new Map(), sheet = document.head.appendChild(document.createElement('style')).sheet;
  const word = w => {
    let k = words.get(w);
    if (!k) { const c = PXK.sprite(w, '#fff', s); k = 'pw' + words.size; words.set(w, k); sheet.insertRule(`.${k}{--m:url(${c.toDataURL()});width:${c.width}px;height:${c.height}px}`, sheet.cssRules.length); }
    const i = document.createElement('i'); i.className = k; return i;
  };
  function render(vis, text, lead) {
    const parts = [], ic = lead && icons.find(([re]) => re.test(text.trim()));
    if (ic) parts.push(icon(ic[1]));
    for (const m of text.matchAll(/(★+)|(\s+)|([^\s★]+)/g)) {
      if (m[1]) for (const _ of m[1]) parts.push(icon('star'));
      else if (m[2]) parts.push(document.createTextNode(' '));
      else parts.push(word(m[3]));
    }
    vis.replaceChildren(...parts);
  }
  const lead = node => node.parentElement?.matches('button,label,.tab,.btn') && !node.previousSibling;
  function pixText(node) {  // le texte reste dans la page (lecteur d'écran, copier) ; on voit ses lettres en pixels
    const wrap = document.createElement('span'), sr = document.createElement('span'), vis = document.createElement('span');
    wrap.className = 'pxT'; sr.className = 'pxSr'; vis.className = 'pxV'; vis.setAttribute('aria-hidden', 'true');
    const first = lead(node); node.replaceWith(wrap); sr.append(node); wrap.append(sr, vis); render(vis, node.data, first);
  }
  function pxSelect(sel) {  // une liste déroulante en pixels ; la vraie reste cachée et garde sa valeur et ses événements
    sel.dataset.px = '1'; sel.style.display = 'none';
    const b = document.createElement('button'), lab = document.createElement('span'); b.type = 'button'; b.className = 'btn pxSel'; b.append(lab, icon('down')); sel.after(b);
    const sync = () => { const t = sel.selectedOptions[0]?.textContent || '—'; if (lab.dataset.t !== t) { lab.dataset.t = t; lab.textContent = t; } };
    const d = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    Object.defineProperty(sel, 'value', { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); sync(); } });
    new MutationObserver(sync).observe(sel, { childList: true, subtree: true, characterData: true, attributes: true });
    sel.addEventListener('change', sync);
    b.onclick = () => {
      document.querySelector('.pxMenu')?.remove();
      const m = document.createElement('div'), r = b.getBoundingClientRect(); m.className = 'pxMenu'; m.setAttribute('role', 'listbox');
      for (const o of sel.options) {
        const it = document.createElement('button'); it.type = 'button'; it.textContent = o.textContent; it.className = o.selected ? 'on' : ''; it.setAttribute('role', 'option');
        it.onclick = () => { sel.value = o.value; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); close(); b.focus(); };
        m.append(it);
      }
      root.append(m);
      const below = innerHeight - r.bottom; m.style.minWidth = r.width + 'px'; m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 4) + 'px';
      m.style.top = (below > m.offsetHeight + 8 || below > r.top ? r.bottom + 2 : r.top - m.offsetHeight - 2) + 'px';
      const close = () => { m.remove(); removeEventListener('pointerdown', out, true); removeEventListener('keydown', key, true); removeEventListener('blur', close); };
      const out = e => { if (!m.contains(e.target) && e.target !== b && !b.contains(e.target)) close(); };
      const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); b.focus(); } };
      addEventListener('pointerdown', out, true); addEventListener('keydown', key, true); addEventListener('blur', close);
      (m.querySelector('.on') || m.firstChild)?.focus();
    };
    sync();
  }
  const SKIP = 'select,option,textarea,script,style,canvas,.pxT,[data-pxskip]';
  let queued = false;
  function pass() {
    queued = false;
    root.querySelectorAll('select.gSel:not([data-px])').forEach(pxSelect);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), todo = [];
    for (let n; (n = w.nextNode());) if (n.data.trim() && n.parentElement && !n.parentElement.closest(SKIP)) todo.push(n);
    todo.forEach(pixText);
  }
  new MutationObserver(ms => {
    for (const m of ms) if (m.type === 'characterData') { const wrap = m.target.parentNode?.closest?.('.pxT'); if (wrap) render(wrap.lastChild, m.target.data, false); }
    if (!queued) { queued = true; queueMicrotask(pass); }
  }).observe(root, { childList: true, subtree: true, characterData: true });
  // le titre : grosses lettres à contour, trois tons, et l'emblème du jeu
  const lab = root.querySelector('.agHead .label');
  if (lab) {
    const L = PXK.layout(title), c = document.createElement('canvas'), g = c.getContext('2d'), on = [];
    c.width = L.w + 3; c.height = PXK.H + 3;
    for (const [gl, ox] of L.items) for (const [x, y] of gl.px) on.push([ox + x + 1, y + 1]);
    g.fillStyle = T.k; for (const [x, y] of on) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [2, 2], [1, 2], [2, 1]]) g.fillRect(x + dx, y + dy, 1, 1);
    for (const [x, y] of on) { g.fillStyle = y <= 5 ? T.accL : y <= 7 ? T.acc : T.accS; g.fillRect(x, y, 1, 1); }
    const big = document.createElement('canvas'), z = 4; big.width = c.width * z; big.height = c.height * z;
    const bg = big.getContext('2d'); bg.imageSmoothingEnabled = false; bg.drawImage(c, 0, 0, big.width, big.height);
    const t = document.createElement('b'); t.className = 'pxI'; t.style.cssText = `width:${big.width}px;height:${big.height}px;background-image:url(${big.toDataURL()})`;
    const e = PXK.art(emblem, IP, 3), em = document.createElement('b'); em.className = 'pxI'; em.style.cssText = `width:${e.width}px;height:${e.height}px;background-image:url(${e.toDataURL()})`;
    const sr = document.createElement('span'); sr.className = 'pxSr'; sr.textContent = lab.textContent;
    lab.dataset.pxskip = '1'; lab.replaceChildren(em, t, sr);
  }
  pass();
}



export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoDex pour s'ouvrir."; return; }
  const host = ctx.host, { el, toast } = host;
  const folder = ctx.folder;
  host.addStyle(CSS);
  view.innerHTML = HTML;
  const $ = id => view.querySelector('#' + id) || document.getElementById(id);
  const doc = async n => { try { return await folder.read(n); } catch { return null; } };
  const px = (g, color, x, y, w = 1, h = 1) => { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const sprite = (g, rows, x, y, pal) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c) px(g, c, x + i, y + j); } });
  const seeded = s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pxFont = (g, text, x, y, color, size = 8, align = 'left') => { const s = PXK.scale(size); PXK.fill(g, text, x + s, y + s, '#05010b', s, align); PXK.fill(g, text, x, y, color, s, align); };
  const gameText = (g, w, lines, y0) => {  // lignes centrées en police pixel, sur une bande sombre
    g.fillStyle = 'rgba(11,3,28,.78)'; g.fillRect(0, y0 - 14, w, lines.length * 14 + 14);
    lines.forEach(([text, color, size], i) => PXK.fill(g, text, w / 2, y0 + i * 14, color, PXK.scale(size), 'center'));
  };
  const theme = (acc, accL, accS, accD, acc2, base = ['#0c0a12', '#16121e', '#221c2c', '#2e263a', '#3a3046', '#62566e']) => {
    const [k, k2, fill, fillOn, hl, line] = base;
    return { k, k2, fill, fillOn, hl, line, acc, accL, accS, accD, rivet: '#f0f0f8', btn: hl, btnHi: line, btnLo: k2, btnHov: '#443852', btnHovHi: '#82768e', text: '#f4f0f8', muted: '#c0b8cc',
      acc2, gold: '#ffd84a', orange: '#ff8a3a', red: '#ff4a3a', green: '#7ee07a', green2: '#2f8a3a', bg: '#100c16', bgDot: fill, bgDot2: k2, spark: accD, spark2: acc,
      tile: ['................', '...:............', '................', '..........+.....', '................', '................', '.....:..........', '................', '................', '.............:..', '................', '..+.............', '................', '.........:......', '................', '................'] };
  };
  let ac = null, mute = false;
  const beep = (f, d, type = 'square', slide = 0, vol = .03, at = 0) => { if (mute) return; try { ac ??= new AudioContext(); const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + at; o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d); } catch {} };
  const on = () => view.classList.contains('on');
  // la manette : croix et stick gauche = flèches, A = Entrée, B = Échap, X = Retour arrière, Y = H, Start = P ; envoyées comme des touches du clavier
  const padKeys = (map = {}) => {
    const KEY = { 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 0: 'Enter', 1: 'Escape', 2: 'Backspace', 3: 'h', 9: 'p', ...map };
    const held = new Map(), send = (k, type) => document.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));
    const loop = () => {
      requestAnimationFrame(loop);
      if (!on() || !navigator.getGamepads) return;
      const p = [...navigator.getGamepads()].find(Boolean); if (!p) return;
      const now = performance.now(), down = new Set();
      for (const [i, k] of Object.entries(KEY)) if (p.buttons[i]?.pressed) down.add(k);
      const [ax = 0, ay = 0] = p.axes;
      if (ax < -.5) down.add('ArrowLeft'); if (ax > .5) down.add('ArrowRight'); if (ay < -.5) down.add('ArrowUp'); if (ay > .5) down.add('ArrowDown');
      for (const k of down) { const t = held.get(k); if (t === undefined) { held.set(k, now + 260); send(k, 'keydown'); } else if (/^Arrow/.test(k) && now > t) { held.set(k, now + 110); send(k, 'keydown'); } }
      for (const k of [...held.keys()]) if (!down.has(k)) { held.delete(k); send(k, 'keyup'); }
    };
    requestAnimationFrame(loop);
  };
  pxSkin(view.querySelector('.appWrap'), { title: 'CIEL CE SOIR', T: theme('#8ab0ff', '#e0e8ff', '#4a6ac8', '#0a1030', '#ffd84a'),
    emblem: ['.....w......', '............', '..w.....kk..', '.......kaak.', '....w.kaaaak', '.......kaaak', 'w........kk.', '...kkkkk....', '..kgggggk.w.', '.kgnggngk...', '..kgggggk...', '...kkkkk....'],
    icons: [[/^MAINTENANT/, 'clock'], [/^VILLE/, 'flag'], [/^CETTE NUIT/, 'star'], [/^PASSAGES/, 'star']] });
  const W = 240, H = 150, CX = 72, CY = 75, R = 62;
  let { lat, lon, city } = { lat: 48.8566, lon: 2.3522, city: 'Paris', ...(await doc('ville')) };
  const where = () => { $('ciWhere').textContent = 'Vu de ' + city + ' (' + lat.toFixed(1) + '°, ' + lon.toFixed(1) + '°)'; };
  where();
  const hm = ms => new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ');
  const dayOf = ms => new Date(ms).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const sunAlt = ms => { const s = sunPos(ms); return altAz(s.ra, s.dec, ms, lat, lon).alt; };
  // la nuit qui vient (ou celle en cours) : du coucher au lever du soleil
  function night(now = Date.now()) {
    const step = 5 * 60000; let a = now;
    if (sunAlt(now) > -.833) { while (sunAlt(a) > -.833 && a < now + 30 * 3600000) a += step; } else { while (sunAlt(a - step) <= -.833 && a > now - 18 * 3600000) a -= step; }
    let b = a + step; while (sunAlt(b) <= -.833 && b < a + 20 * 3600000) b += step;
    const edge = (lo, hi) => { const up = sunAlt(lo) > -.833; for (let i = 0; i < 9; i++) { const m = (lo + hi) / 2; if ((sunAlt(m) > -.833) === up) lo = m; else hi = m; } return Math.round(hi / 60000) * 60000; };  // à la minute près
    return [edge(a - step, a), edge(b - step, b)];
  }
  let win = night(), t = Math.max(Date.now(), win[0]), g = null, tick = 0, iss = null, passes = [];
  function planetsTonight() {
    const out = [], [a, b] = win;
    for (const name of [...Object.keys(CI_ORB), 'Lune']) {
      let first = 0, last = 0, best = null;
      for (let m = a; m <= b; m += 10 * 60000) { const o = bodies(m)[name], p = altAz(o.ra, o.dec, m, lat, lon); if (p.alt > 5 && sunAlt(m) < -6) { first ||= m; last = m; if (!best || p.alt > best.alt) best = { ...p, m }; } }
      if (best) out.push({ name, first, last, best });
    }
    return out;
  }
  function moonText(m) { const q = bodies(m).Lune, illum = Math.round((1 - Math.cos(q.elong * RAD)) / 2 * 100); return illum > 97 ? 'pleine Lune' : illum < 3 ? 'nouvelle Lune' : (q.waxing ? 'croissante' : 'décroissante') + ', éclairée à ' + illum + ' %'; }
  function renderList() {
    const list = planetsTonight(), box = $('ciPlanets');
    box.replaceChildren(el('div', 'hint', 'Nuit du ' + dayOf(win[0]) + ' : le soleil se couche à ' + hm(win[0]) + ' et se lève à ' + hm(win[1]) + '.'));
    for (const p of list) { const d = el('div'); d.append(el('b', '', p.name + ' '), p.name === 'Lune' ? moonText(p.best.m) + ', de ' + hm(p.first) + ' à ' + hm(p.last) + ', au plus haut vers ' + hm(p.best.m) + ' (' + Math.round(p.best.alt) + '°, ' + dir(p.best.az) + ').'
      : 'de ' + hm(p.first) + ' à ' + hm(p.last) + ', au plus haut vers ' + hm(p.best.m) + ' (' + Math.round(p.best.alt) + '° au-dessus de l’horizon, ' + dir(p.best.az) + ') : ' + CI_LOOK[p.name][1] + '.'); box.append(d); }
    if (!list.length) box.append(el('div', '', 'Aucune planète bien visible cette nuit.'));
  }
  function renderIss() {
    const box = $('ciIss');
    if (!iss) { box.replaceChildren(el('div', 'hint', 'Orbite de l’ISS indisponible (hors ligne ?).')); return; }
    box.replaceChildren(...(passes.length ? passes.slice(0, 6).map(p => { const d = el('div'); d.append(el('b', '', dayOf(p.start).replace(/^\w/, c => c.toUpperCase()) + ' à ' + hm(p.start) + ' '), 'apparaît au ' + dir(p.az0) + ', monte à ' + Math.round(p.max) + '°, disparaît au ' + dir(p.az1) + ' vers ' + hm(p.end) + (p.max > 50 ? ' : très beau passage.' : '.')); return d; })
      : [el('div', '', 'Pas de passage visible les trois prochaines nuits.')]), el('div', 'hint', 'Un point très brillant qui file sans clignoter, en quelques minutes. Horaires à quelques minutes près.'));
  }
  // les passages visibles des 3 prochains jours : l'ISS à plus de 10°, au soleil, et toi dans la nuit
  function findPasses(T, from = Date.now()) {
    const out = []; let cur = null;
    for (let m = from; m < from + 3 * 86400000; m += 20000) {
      const p = issLook(T, m, lat, lon), ok = p.alt > 10 && p.lit && sunAlt(m) < -6;
      if (ok) { if (!cur) cur = { start: m, az0: p.az, max: 0 }; if (p.alt > cur.max) cur.max = p.alt; cur.end = m; cur.az1 = p.az; } else if (cur) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur); return out;
  }
  async function loadIss() {
    try { const r = await ctx.net('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE'); const L = r.body.split(/\r?\n/).filter(Boolean);
      if (!r.ok || L.length < 3) throw 0; iss = tle(L[1], L[2]); await folder.write('iss', { l1: L[1], l2: L[2] }).catch(() => {}); }
    catch { const d = await doc('iss'); if (d?.l1) iss = tle(d.l1, d.l2); }  // hors ligne : la dernière orbite connue (bonne quelques jours)
    if (iss) passes = findPasses(iss); renderIss();
  }
  const proj = (alt, az) => { const r = R * (90 - alt) / 90; return [CX - r * Math.sin(az * RAD), CY - r * Math.cos(az * RAD)]; };
  function draw() {
    g.imageSmoothingEnabled = false; tick++;
    const sa = sunAlt(t), dark = sa < -12, sky = sa > -.8 ? '#3a5a9a' : sa > -6 ? '#2a3a6e' : sa > -12 ? '#16204a' : '#0a0e26';
    px(g, '#05060e', 0, 0, W, H);
    for (let y = -R; y <= R; y++) { const w = Math.round(Math.sqrt(R * R - y * y)); px(g, sky, CX - w, CY + y, w * 2 + 1, 1); }
    for (let k = 0; k < 360; k += 2) px(g, '#3a4a7a', CX + R * Math.cos(k * RAD), CY + R * Math.sin(k * RAD), 1, 1);
    for (const [txt, az] of [['N', 0], ['E', 90], ['S', 180], ['O', 270]]) { const [x, y] = proj(-8, az); PXK.fill(g, txt, x, y + 4, '#8ab0ff', 1, 'center'); }
    const pos = new Map();
    for (const s of CI_STARS) { const p = altAz(s.ra, s.dec, t, lat, lon); if (p.alt > 0) pos.set(s.name, proj(p.alt, p.az)); }
    if (dark || sa < -6) { for (const [a, b] of CI_LINES) { const p = pos.get(a), q = pos.get(b); if (!p || !q) continue; const n = Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])); for (let k = 0; k <= n; k += 2) px(g, '#2a3a6a', p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n, 1, 1); }
      for (const s of CI_STARS) { const p = pos.get(s.name); if (!p) continue; const c = s.mag < .5 ? '#ffffff' : s.mag < 1.5 ? '#d8e0ff' : '#8a9ac8'; px(g, c, p[0], p[1], 1, 1); if (s.mag < .5) { px(g, '#8a9ac8', p[0] - 1, p[1], 3, 1); px(g, '#8a9ac8', p[0], p[1] - 1, 1, 3); px(g, '#ffffff', p[0], p[1], 1, 1); } } }
    const B = bodies(t), shown = [];
    for (const name of ['Lune', ...Object.keys(CI_ORB)]) { const o = B[name], p = altAz(o.ra, o.dec, t, lat, lon); if (p.alt < 0) continue; const [x, y] = proj(p.alt, p.az);
      if (name === 'Lune') { const ill = (1 - Math.cos(o.elong * RAD)) / 2; for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (i * i + j * j <= 10) { const lit = o.waxing ? i / 3 > 1 - 2 * ill : -i / 3 > 1 - 2 * ill; px(g, lit ? '#f4f0d8' : '#3a3e58', x + i, y + j, 1, 1); } }
      else { px(g, CI_LOOK[name][0], x - 1, y - 1, 3, 3); px(g, '#ffffff', x, y, 1, 1); }
      shown.push([name, x, y]); }
    { const s = B.Soleil, p = altAz(s.ra, s.dec, t, lat, lon); if (p.alt > -2) { const [x, y] = proj(Math.max(0, p.alt), p.az); px(g, '#ffd84a', x - 2, y - 2, 5, 5); px(g, '#fff4c0', x - 1, y - 1, 3, 3); } }
    if (iss) { const p = issLook(iss, t, lat, lon); if (p.alt > 0) { const [x, y] = proj(p.alt, p.az); if (tick % 30 < 20) { px(g, p.lit ? '#ffffff' : '#5a6a9a', x - 1, y, 3, 1); px(g, p.lit ? '#ffffff' : '#5a6a9a', x, y - 1, 1, 3); } shown.push(['ISS', x, y]); } }
    // la légende à droite : l'heure, et ce qui est levé
    PXK.fill(g, hm(t), 190, 14, '#ffffff', 1, 'center'); PXK.fill(g, sa > -.8 ? 'jour' : sa > -12 ? 'crépuscule' : 'nuit noire', 190, 26, '#8ab0ff', 1, 'center');
    shown.forEach(([name, x, y], k) => { const ly = 44 + k * 12; px(g, name === 'Lune' ? '#f4f0d8' : name === 'ISS' ? '#ffffff' : CI_LOOK[name][0], 150, ly - 5, 3, 3); PXK.fill(g, name, 156, ly, '#d8e0ff', 1); });
    if (!shown.length) PXK.fill(g, 'rien de levé', 190, 50, '#5a6a9a', 1, 'center');
    if (tick % 30 === 0) g.canvas.setAttribute('aria-label', 'Carte du ciel à ' + hm(t) + ' : ' + (shown.map(s => s[0]).join(', ') || 'aucune planète levée') + '.');
  }
  const slider = $('ciT');
  const setT = v => { t = win[0] + (win[1] - win[0]) * v / 1000; };
  slider.oninput = e => setT(+e.target.value);
  $('ciNow').onclick = () => { win = night(); t = Date.now() < win[0] ? win[0] + 3600000 : Date.now();  /* le jour : une heure après le coucher, quand il fait noir */ slider.value = Math.max(0, Math.min(1000, Math.round((t - win[0]) / (win[1] - win[0]) * 1000))); };
  $('ciCity').onclick = async () => {  // la ville : cherchée chez Open-Meteo (le même service que la Météo de NeoDex)
    const q = await host.ask('Ta ville (pour calculer ton ciel) :', city); if (!q) return;
    let c; try { const r = await ctx.net('https://geocoding-api.open-meteo.com/v1/search?count=1&language=fr&name=' + encodeURIComponent(q)); c = JSON.parse(r.body).results?.[0]; } catch { toast('Recherche impossible (hors ligne ?).', true); return; }
    if (!c) { toast('Ville introuvable : « ' + q + ' ».', true); return; }
    ({ latitude: lat, longitude: lon, name: city } = c); folder.write('ville', { lat, lon, city }).catch(() => {});
    where(); $('ciNow').click(); renderList(); if (iss) { passes = findPasses(iss); renderIss(); }
  };
  {  // vérification sur des dates connues : équinoxe (Soleil à 0° de déclinaison), pleine Lune, Mars à l'opposition, Vénus à sa plus grande élongation, une orbite d'ISS de 92 min à 400 km
    const bad = [], T = Date.UTC, near = (v, w, tol, what) => { if (Math.abs(v - w) > tol) bad.push(what + ' : ' + v.toFixed(1) + ' au lieu de ' + w); };
    near(bodies(T(2024, 2, 20, 3, 6)).Soleil.dec, 0, .3, 'équinoxe');
    near(bodies(T(2024, 0, 25, 17, 54)).Lune.elong, 180, 6, 'pleine Lune');  // pas tout à fait 180 : la Lune passe un peu au-dessus ou au-dessous de l'ombre
    near(bodies(T(2025, 0, 16)).Mars.elong, 180, 6, 'opposition de Mars');  // Mars était 4° au-dessus de l'écliptique
    near(bodies(T(2025, 0, 10)).Vénus.elong, 47.2, 2, 'élongation de Vénus');
    near(bodies(T(2025, 2, 12)).Saturne.elong, 0, 3, 'conjonction de Saturne');
    const S = tle('1 25544U 98067A   26316.88411739  .00007667  00000+0  14541-3 0  9992', '2 25544  51.6325 284.2547 0007335  19.0494 341.0767 15.49339933594804');
    const h = Math.hypot(...issEci(S, S.epoch)) - 6378.137; if (h < 380 || h > 440) bad.push('ISS à ' + Math.round(h) + ' km');
    near(1440 / S.n, 92.9, .5, 'période de l’ISS');
    const p0 = altAz(0, 90, Date.now(), 48, 2); near(p0.alt, 48, .01, 'hauteur du pôle');
    console.assert(!bad.length, 'ciel', bad); view.dataset.selfcheck = bad.join(' | ') || 'ok';
  }
  $('ciNow').click(); renderList(); loadIss();
  let raf = 0; const frame = () => { if (!on()) { raf = 0; return; } raf = requestAnimationFrame(frame); draw(); };
  ctx.onOpen(() => { g ??= $('ciCanvas').getContext('2d'); if (Date.now() > win[1]) { $('ciNow').click(); renderList(); } if (!raf) raf = requestAnimationFrame(frame); });
  $('ciCanvas').__state = () => ({ iss: !!iss, passes: passes.length, planets: $('ciPlanets').children.length });
}
