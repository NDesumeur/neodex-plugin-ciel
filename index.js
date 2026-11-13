// Ciel ce soir : les planètes visibles cette nuit depuis ta ville, la carte du ciel heure par heure, la Lune et les passages de l'ISS.
// Positions calculées sur place (méthode de Paul Schlyter, précise au degré près) ; l'ISS depuis ses éléments d'orbite (CelesTrak), à quelques minutes près.
// Il tourne dans le bac à sable de NeoDex.
const HTML = `<div class="appWrap wide">
  <div class="agHead"><span class="label">Ciel ce soir</span><span class="hint" id="ciWhere"></span></div>
  <div class="gMain"><div class="gameBox"><canvas id="ciCanvas" width="320" height="180" role="img" aria-label="Le ciel vu de dehors"></canvas>
      <div class="row ciTime"><input type="range" id="ciT" min="0" max="1000" value="0"><button class="btn" id="ciLeft" aria-label="Tourner à gauche">◀</button><button class="btn" id="ciRight" aria-label="Tourner à droite">▶</button><button class="btn main" id="ciLines">CONSTELLATIONS</button><button class="btn" id="ciNow">MAINTENANT</button><button class="btn" id="ciCity">VILLE</button></div></div>
    <div class="gSide">
      <div class="sysCard"><b>CETTE NUIT</b><div class="ciList" id="ciPlanets"></div></div>
      <div class="sysCard"><b>PASSAGES DE L'ISS</b><div class="ciList" id="ciIss"></div></div>
      <div class="hint">Le ciel comme si tu sortais : fais glisser la vue (ou ◀ ▶ et les flèches du clavier) pour tourner et lever les yeux. Le curseur avance l'heure dans la nuit ; le bouton VILLE choisit d'où tu regardes.</div>
    </div></div>
</div>`;
const CSS = `.gMain{display:flex;gap:22px;align-items:flex-start;flex-wrap:wrap}
.gameBox{display:grid;place-items:center;padding:10px;background:#05010b;flex:0 0 auto;gap:8px}
.gameBox canvas{height:min(56vh,460px);width:auto;max-width:100%;aspect-ratio:320/180;image-rendering:pixelated;cursor:grab;touch-action:none}
.ciTime .btn{flex:0 0 auto}
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
//<ciel-data>
// étoiles et constellations : d3-celestial d'Olaf Frohn, licence BSD-3 (d'après le Yale Bright Star Catalogue) ; voir LICENCE-DONNEES.md
const CI_DATA = { stars: 'FrBT0AF05r7DXRH4CZYN4aCOheK8CACOLGDQCICoD9HyEuFJ3q58G7DuFEGeW-4eH5kXFTIETA4DI5AoGfJfVTCKK5cg9yKlIBISLUrq9SLDT_4lM5mWL9MCYN4aNSNnFyN8GN9YO6HmJ3PBTM59PgfA8HP5CjF3P6CmIYP7Ld3BPBD9DuQ6pv6kQ9DKDnQ6J86hQ7UFMqQA7_LtQKh88iQ9PxNkQVGl9yRNWLLnR8Je4nRYfJ7MRIE3L5RCdQ3IRdFYGeRAKW5XRBlu5DS85yS1SNEzBGS5MBCjSd4-HlSXOEHASX1jBGSUiM9zS7X58OSU0LIdT92kJeTgDbCZT7YpPgTdrF6lTgfDG2TD7MKUTA4sKhTbRjGMTC2ENZT9Tm6QUAIv7qU5Ln4pUEaXIFUBLQ7IUhVQMfUBlmKNUN1bMvUXg4M7UeC-E1U70NNJUIW25jU7bXAYU8dT8jUXYT6gU7YD7UV7PtMuVBYaIJVToyFdVefW7-V7127TVWRvMTVBeGBdVBs3ITWhHM9VW8nyNsWFLz5UW7miJOWUs6GSWA78EjWhczCQWBWf6hW6QLHHWDbkA-W9D0BIXEST69X7SmBLX8if9PXBZrCcX9avF4XX4VHKXDDH8lX8E3JuX8TUAQXS3NNUXDWdGyXMZ67LX6BcJGYePH6MYSTb3HY6f38FY6H58HYgh09QYckMFkYec4DVYgcSNhYSP740Y6TmDsYHD7D9Y6VH8LYBYpBaYDfZEoYXC2DHYDciHRYTeRGKYXSk4vY6f2MFYTaY7eY6CrAqYQd7J0YN101_ZMcw9gZ6hIA6ZV0XGSZ6J3AHZJbK4AZG99J3ZFer5PZef66HZ78vHrZ8UZFoZTp4BZZE4f4SZGkIL7ZAEzHbZgZv3LZAqI4fZc6-7nZDiwAoZIHUFNZ8UKK3Z8bT9_Z69JKKZ6cLA4ZGoTDCZR7EMRZOMy3vZFrGIoZRG16AaYTJBVaApoE1aT9JBzagDCHNa7MvHoaQgR9KaUVDASaSfj7paKimGFaA54JYaDQAL1aXZ-PIaBdY88a6pL8Ea88jLYa8Et9Na7GYAMa8SXAYabBpKwaLTy3Ra6Y4K3aEjlISaWljBmaQFoH_acOKKZagj1OfbUgu8KbgKwE_bUPOBYbZRB4Eb9mM6hbUDj8UbXL4LabEdp5KbfeSHybCZ87Vb6LxJSbfMK5AbfeSJqbdFY7Kb8MOM9bKeCOLb8h-9sb8B-KWb7YU3wbFBLFAcKByAacddmFYcXfp8IcYnkIocUtSQCcVZ_7kc5cEDLcTh1DdcToMP6c6Fy4PcFlKDyc9HZ7JceX49vcWZKA7chiVJBc98u2Ucg1YIvcZejAAc6rjBccBCEBYc8N-38c9a8NIcXAj5Uc8Oi4Rc8EfHbcger5Gc72b6ndS7FK8dfSlM-dCeK7KdJgACYdUip9ldX9y4JdSQMGUdAILABdY4UO1d7ChDid5FrG5dJJyNZdRjYEZdGa375d6KbF4dOVrD-dCD6Fdd7O74VdfUJEcdfp_NAdfAWGZdE3T7Jdf9QG1d8WQ7Zd6Zf5xdSmfNkdSrCFmd84RIidKbW84d6fgIPdPme3kdDLX4sd6O6HkdGioDJd8O7KneB1xN6eM2hCUeXIe5oe6ZnJHeT6OEaeCWQ7Re7NkGie9dBK9eS44BbePGU9jejQWJFecZFKOeThF6ue6rT63eCG18_e8HCHWeHrWOQeVkrH7efrXHweT8kCYeSMjFdeKNK5Ye9i9JIeAiSAneXpzF2eCAWH4eUJPFWeeR595eTb6DYe9fKBgeFA58oe8DZBmeCXb6te6h1PReKlE3keP0nCieY5L61e8QYBmeWdZ88e6I9HufTLFLSfAY4Iqfaa18PffH7GffClbC7fS3rLgfaCQD0f8DTAafKRnEMfKSz4efc3ICofVG8JOfCKL5pf7MJ7lfHad9hfbf44bf86fILf880FUfSNsC8fUUa2vfYfe3zfX3bGTfT8zHrf9IB88fide7Sfcr_Khf8Ra3ffDmMGMfJA9GWfUMLNxfHazGUfBgT6Ff8qiE4fIaGIdfGah9Qf6W_O8f9n14xfZBOEyf7KT8uf6kOGzfasIAmfY1SMVg64Y60gRBqKVgXMt4JgURbLYgYooBTgG7pAgggg6IegTsbEbgSBWESg6DxBsgHIT7kgUb9EngDgUFagDkiF4gR8KCbgS8oHrg8E3MZgUnQKxgg86Fbg8YeENgAfyMzgYos1-gUreCugh4NCTgXcNH4gGnpK0gILG6jgXfkEVgBD24JgNDkApgUFCC-g8ikAhgUjiM9gDqoLxgB6hMpgi8pKkgJAHGpgUDFDgg6Jm3lgXKM6ogNdS4sgfmRGZg9oHAagUpsI1gJGm33gUHQIQgUN5NIgGPY4tgTYRGDgBmlCbgM7QL5gUPXJQgVQVI_gM7W9YgLHx9ug7aXFjgFjDMQgTlQLNgZAn9IgTOY4vgGarIBgAtOLLgU4nEWhALrJqhBR1OvhgcjEOhAfPLGh6OTBShdWm7Vh6Yi1khd8m3yhX8nJ7hAAVGahTKw4ch8OkFXh7Ov6YhGTP2ph7gVIahAgkAnhEkQP3hS9x7ThWDa65hDEx8shRO17VhBTSO-h8Tc6VhBbNGXhKh7HUhXhaCoha2EK5hDAtBrhWCy8XhXc747hWcq1lhSg3JvhbqQDsh98rHuh9KZ6uhAWn74h6YWDBhIbO9Wh6kbEEhN0O6xhU4SH5h9NAI8hYZe6Th9sK70hU6vChhWGBAIhjLgERh9SwDzhBklJZhUMgDvhaQd5Zh7Vi7whY9WF0hBJmDThATE6Eh6ZN6jh7aZBmhUcHLJh7dtIvhAjOBIhFnsEuhL127FhE3a6PhT6qMKhPApDYh6I32khVQ74shZbnArh9gEEXhB2h5Si8I1CaiUI89YiDKWGwiWn7KWiB4rPOiAFWB3iV9kLXiAE27OiXL8KciJLY4Li6jR77i8jU7ki8lVLXidspAxiWAK8midDlKBiXH43SiPKK8ZiTSb5ui7b98qi9kv2hi9qj7HiUrOHmiV9LJgiAoZLCiS4iAnifEfD5iaOP2WiHVTMgiDsc4-iILC3iiDQkFjiIb-B1iC43L_i8BADZi7GaHIiSG_9ui7YT8Ai7bbNEiLcI6EiWhu2wiXm1IqiIKk9liZSTADiHiXGRiWicDBiW5NJMiABtNWiSKbIaiUUG58i6gQETiRmBFri8uEF9iI9sD0iHRbF5ieXpMBiKqyE3i87PLqiMJU23iIKV7QiRQdF0i9WQGYieXd89i9YJ6Mi7rWByifBbGBiXHqIHifQmBJiESq3SigSs44i7YX8aibdr5midXSD8jKZW6_j7Zs4ujCqjNCjQ1sHtjW5Y3LjB6FE7j678AOjDGBCCjcMS4qjAPnBDjWiMKxjcnTBOjAo5HAjWDAFXjTb4Gvjg3oKYjL6QLmjKIL6qj7hK6PjUix7xjX6I7rjUGZBej8KE7MjCN7BmjSOr1ojgRc4WjSac3jjXiw89jBry5qjT6F3Pj99zLejTEAFajDSLFRjTki7XjVmw9tjhqk7FjfCgCsjTFCHEj8bHBTjUmhA7jJrN1MjEtUEyjK8FG5jW8sHpj9KEEzjASP3-jHaSI-j7bQIHjZo-I4jJqCJzjdGuD_jAenJtjAtVK_j9EEHjjRHZJ2jGbhCIjJeuAIjG1JNvjD8-8QjTqECsjUXKCTjaXTLHjCcx8ZjfqAM-jGrA9sj8WQ8hkeh-HHkKCxE_k7IeAVkOOYJpkScrKikArPF-kKrm8_kT8BNRkIANHZkDdJQukSm2NwkEoG3skK6gK3kH8tASkJIV6Zk7bm8Kk6caBBkEh0PDk8i2DLkWiF4Mk7iKJrkgmgItkVnwKEkCsUD8kf0o3xkMI6IbkWUyIRkLWG8wkIWuEJkCbsL5k9dC1zkVio8HkKoxNGktp3Lnk82iRZkY5l6dk76QBvk8Ss1hk8TSKYkMck8fk7fUC3kCsYCfkW2z3JkK9eLykAAnFgkEAqKXkXC5Cik6JfKqkfUE7okEXvPvkdp0NdkJ2kLSkA47FWkT7q7LkO8MAik8A061kGBVORkAL2FxkDfH82kWgGHSkIpjOAkI2TFJkT6SFfkG9_FTk9AtG1kCB2Hgk8Ul6Hk6Zu6bk8jS74kHmjGbkVt0F4kVAQHekFMZQnkeOW9Dkdew9PkIlPMwkCo6BSkSpzJGkJsB7HkI8UE8kMCVC0k5O-5OkVRs8nk8auQEkBckBUkSpqBvk9qp91kAtPKrk82J9Uk75oFPk98pHvk88x8Ck9AOGtkBE4LFkiKSEck6PdHxkAREDykURk46k7TOBYkIXd5GkClaC7kTKM4kk8Xt0_kaa7JwkGbpApkRmODvkT8TLcl9AzA_lgC_G-lpEgIhlUKaBzlSMLHglfSG4BlGUtGplJWW8wl7Yr7Gl7egC4lBHWFTldUD6RlbXr6-lJeS9wlRgX47lFg-JjlX1SJLl81WIflR2oMhlDDU3plEFKAQl5Ja1zlXLl55lgMY6MlDWu6ylMaf7QlceuEjlehyJylEi2GwlDozGolXqkLXli7VH9lVBNFTlAFR5olAGJNClRJ43Ml8KfE-l9TBIVlXZt9NlWf7RclAh64TldjBK1lZo-8wl91F4El91i55lA5DFSlS8ELalb9aHXlVBSDDlFCFC3l8D-8Zl7GGBPl9J5DclTX37el6j-Dtl805D8lhEj8blUH9AAl7Po7UlCgYHKl7kt8Zl7UtDDlAlEQDl9sxAsldtC8Al84S6rlg8-OJllD5FZl7DsHFlME_EolEIsERlZNmFeldZHEPlVddFgl8ehAnlIk6GulQk9GplVo05klE2FHklTIIA1l9J7B4l7iQ3alLpV5UlGG15ilSGsIolZXk7vl6f3I9ldg8IolInxJXl8sEPslQsdCel7sf8_lWENGOl7FZBElXGy76lbG-9yl7JJ7nlXPuHElBYo9ilba-FElMgGEHlBqVMElUsvHklM8rCBlg9-CtlQBdMUlAj4KBl7k_9llhlqJ6lbmbGRlGmlDIlh0bB7mh1wFGmeA14pmWAz7XmHErNImBHlAbmKJC7umgJU8LmEY66Bm6jgHxme3-Exmb6d90mUCDCDm8EYGIm6KHEbmYL67dmNOr54mgPE1Vm6QSDVmEcmAjmDj9PYmZjtFEmY5rOcmD9ADcmNCFEXmXLSM8mGQFAWmBSS69m7ca6em9rd8xm96TBAmK7rIcmfBgELmbFA8-m7FMFDmAIi6Om6LJ2kmMM4IAmYMTMDmBRo70maYBIjmHZ3DPmGnoFemLpp7vmb1mLdm99Q4MmeAQGWmFFyESmWNmE0m9a44pmDcSAymUs4Egm8sBANmS4nP9mDAi9QmTFoG8mXGv6mmGIU7_m6NlJamEYQGemAjzLwmInWAAmgoyIZmKtZEMmEtbBpm9uG3qm9DGEjm8Dh5ImWKb5Cm7OG5Km8RgHEmLWKGpmKlVIQmZncCImToMAgmSpv8wmBq7KHmcr9K_ma0kJqmB2pInmWDfKCmTMF8SmcMe4Vm9aoH9mBk_Ohmamc5zmGohB1m6qe3wm9u2N3mY6aIemWVN4Ym7VQ3_mQXaB-mDZLIHmZge6umUjOBamCmfN4mLoPHmmgqmKpm81F4EmD1zKVm7E4DbmYHt8cm8XMMAmFevDHmIfj9kmMmlJnm8sPLomGCRJImZFSAUm9MMDumCMSJmmSMSO-mQYqH3mOZfA-m9a48Jm7km9qmdsCFYmft3G4mT09BNm98DNHmKBv8XmYGQQ6mbHaFymaN8MXmBaa72m7cKAImPgW9dmTotPDmWqPLLm8qXLpmC6jJZmf9L4UmgDpIOmALMK5mVQOHhmhXr70m7fF6pmAmwIJmRnVLWmf8V7nnUcWGGnAcWAQnFfVPLnJiLHcnQit7lnVkeHrn9D6DKn6N76pnXP94cniUz4jn9WVOBnfb_9jn7fLCpnDskHnnE1d6tnT8j8FnY90PDnBCnEZn6KLO7nYMFDenIOD5UngQI4fnLb6I9nQbGA7n9hxKGnEj-ABn9tq9hnAA6LxnBNfC1n8Pg8HnUYbGknTa981nMbEKjnLjMOLnB0DDBnV0hK7nB4SEanT7UKGnWHTLmnAImBCnCaVCVnUmDJbng2ENKnT9OAKn8BsHSnDC-Cxn5LQA1ngP_FDnHQ24KnUR95bn8Ty5Fn7UH4rn7ccCmnEgDDVnIhW7TnUiPEknD70HPnBI79enhIV6Kn5KTCynRLj8EnJTi7qn8W4MdnhZ4ONngb9A2n9bf52nFhQ4Ln8iCNMnYuAH_ng98AEn7BXFgnCEEHDnFWJ62nTaiJon8an75nIdTCOnKeYJvnBgUFRnTjaE7nMmGGNnCr1M7nFs4LvnV6PIPn8AjGOnFBvGUn9Dr4DnUH88Ln8Hd9EnSHo9en8OX54nJSAF6nCbe6OnS2pHMnU4ICPnHFgFdn5GFAxnHH39jngKSHRnALK33n7PZKqn9TgCqnZTo6SnWaj8inTgP9SnPgv9snhh7ChnTkxIQnE2uHwnV8BLpn89zKPnUAwGZnDEJBlnBJFGqnLLXN_nIgCGinZhLBonChxKHnDjpOznQnH91nS3hNKnU4V3WnT4t9Vn76_KHnBKz5rn8McEonaNTFKngOzJ4nQVkD5ngVqLknDcJ1nnik4IonToiCrnErHB8nbARGNoUCUKLoNHwA6o8IJ6joVIpDsoeOz4qofTw4YoVotM4o8pi5CoVtI7QoCCXAmo9RECYo9RN8fo9dd7SoJhsCfoHkk9zoPneFfoFriRFoctDApoA71FTo88B4FoIBRGJojBy55oLCuDvogD0J6oGLyA0ohM09aoSRYBCoTUk6Vo7Wk47oWkgFPoUnx92oBsJAZoN3NOjoVCaE0o7DkJvogEU5Uo5JCC3oTMAAboXOTJMoFOe2qoBOlKOoESJ4Co8SyGsoUVAKQoGbdLGo8eWE0oWovB7oR5iLxofGDG8oGJD7MoDPtDhogbm70oFbsJnoUmyCgoH1FMbo837ILoB5yBioJ6F7NoB7qOLo88FDHo8J74VoJKN6hoDLCOeofVCBDoOXD5koTbAHMofgBAMo9ig7Vo9jnJTo7nELVo8piDko8tP6zoCG_6Xo8Rh3eoeWZ95o8XSM6oFapA_ofar8fo7mH4coGsfOjoR1F6SoA6g2Lob6iAooSDnENocEpOvoBIg9LoDMjAOo8P63_o7QYK2oCT4M8oSURGoofVZBaoWWVJSogXj4xoQej3UoYfR6MoIjBHQo9ojNnoFsCI3oa1kCQoU7GMxoUDFCyoDFwFKocLtCCoTQ-DcofUGCbogfIOqoJgKCooIhTM-oMl189oclaK0oIliC4o9m0BIoIrRR4oZ0421oZ25Dvof51J_oC8rNzoPAaGcoDBkC7oFD6D8o5J5M7oBJI8To8Mr9koKODH7oJT0I6oKVAExohXe70oGXk9koaf5AKoAfp7poFh-3xoEqPIVoAqgEpoV0bHEof4dHmoGBSJpocJe6Vo7Lw4KoTV43To8bAJfoUciA9o8fn97o9gDEmo8lUI4o6pzPNoSqB7doQ1fLzo825NdoL7gCioFAELLoAAKGooDBoCyo7FcKjoZLWOZoKLkMWoELvCaoSPA44o7TVHcoAUmIOoeXAQBobXXJdoVYXIDohZFH-oecE9coAeXJFo7lPLOoCmzL0o7o27ioBqZEIo7rCIfoAC6GWoGCG3aoZCQ8doUD_I8o8In48o7MUKGoUQmCNofXxDkoOhBAtoamOHOo9moLHoL4b6gpRCGK5pEFcBtpdGAAwp6HkBppbOK7apWOfMqpLTA61p7VyJlpFXEH_pLbcHepBcNEEpHdRLGpCdvDQpehDOKpYiKPDpXnPAzpDqQF-p7qnCPp9scLkphtYBIpQ2ANIpY3RLApI6FCDpJ6U3WpBGm7tp6H4ARpgJb8vpcKQ5np7Ud6LpBZJLXpNZg77p6ceKdpae28lpFh_IFpYiRDApViV8HpI3XF1pb5DK-pe5NJQpM7oEcpO9xFXpQDLGfp8Hz85p6K850pUPpEepXRZFNpDXbGdpZcoFtped6OApYdHMypIkr9-pSrH7cpVrM5jpYsBNMp97WPipB7nJQpeHbAUpFNo5-p8Uy8ApOZs48pZg479pYh0EcpSiU5pp9168wph7mAZpSFuNMpCKJ9SpSOqPvpTV93epeXkFOpAYSFMpUcNIvpTcr7CpBd1Ljpff7MipGfZAhpJhx8Wp7iJAXpcj9A7pLmM4TpJpoEtpd3ELBpW66EypS7dHMpA9yCTpXGx70pAKOBbpVKx9lpDNEA1pYOv9ophPH40p7kMA-pVobK5pW5jC9p9CpHVp7DfHwpUDp8op7H9AEp7S71sp9TnFgpCUVIupXdiOFpKg67ZpghvCnpWjEB6pUjw6ZpWtmNFpWuDDWpTuEMop90SBfpKBLJxpdCiEMp6DgG3p9HyJUpIIDGzpdOg5hpKOwB-p_Rc7lpNRq3up8UDHOpSXY1QpFe3G3pDf6MipFkHJwpTmr8opUr6KBp6t5NDp81wM2p83MBopZDOEJpXGKL7pBU78mp9V24rpKbf82p7bkA-pAcd37pLkYHcp7mq6spe6MKMpMAeE4paBoAxp9C1G-pNEsDdpgGqDQpUGtKDpdOyBRpSTn4lp9VrJupIZCClpMZl99pHd8BJpWe3MbpJkjMGpCm2DdpXmKDhpgqt4OpgrkFSpA4aAZpdE9CQp7EGBVpEF2LnpmGa6KpDHeQyphLj82pWP_9ppHTAILpGVpEfpBWQHPpdYa8apAa6CTpJgT7IpFg_HWpghR6vp8iHL_pSmeI1pY9p7WpHA3HIpFABJUpTBiJ_pBHp5tpbI6NFpCIlDVpYK-4qp6MmALpLR39VpLRO4NpWSnHppTU9INpOUWMupHXFBXpiYqDjpUZSHzpJb-CVpCj-C-p9lA5ppglGJqp7lSJqpDmkJSpasaCtpgteIgpT5BIpqP70JaqZGH6TqhHIB6q9IvIQqXKi6_qBNFB6qfOOOKq9Og2eqiUrATqVV0KMqVccOqq9iYJ5qdlSGSqBm3Lkq8pz8_qK1jLQqD38NAqO9INxq9DKDvq6EYGbq7QuEXqUTVP0qabRBrq8c25YqUcCPwqIkkK5q8ky4oqbrcKrqfszEHqBtkEdqy3xKQq93-KkqM619gq97uKrqBAVGeqXCUHXqTDtMnqBWRBFqVbQMdqFbeA1qZgRHYqhgfANqVggI-qhsuNpqi2y6zqL4YOpq88iJOq99R4XqcABIMqXDv8HqWIWIGqCOL3dq7SxEbqXVbGEqOXw9Tq9alAMqacB6FqQd-GHqgtFIzqctTBsqFtjLKqW41DVqc54I7qH6_43qDB_M8qHD6DEqMD6DEq8H_BhqfKKC7qcPqF1qDRl36qbTBIGqCaPKTqCbaIlq9h8NGqCiPEkqEjLDEqTkkNGqg0BCRqg4oMbq988Llq88i95q79HNdqdAvCBqBCdEdq8G3KcqZG38iqcGXDQq6HQFXqUJHBcqVLLEtqYLY73qEMMFrqVQhKtqUSnJFqXW65Yq9XJESq8a16bqKa4IpqMbV7ZqUglO8qJjUIiq8l393qYpv8mqernLrqksfCaqA9ZNKqKChGoqLEN8Fq8EhBxq8GGBuqYH8LpqCMZF8qVQi8QqdRV4JqQaPQ9qfbqGkqTgA9LqhgVKtqSiMAXqbicLPqEj5N5qXjuHAq8kMJLqKuA41qB0QLHqI16Gtqg3uL0qSBp9zqVCLJBqEEW3qqgEnNhqlHbIRqWIT8fqJK76HqaMR63q6P8OtqcRL3sqQSt5TqgT9KAqTTJOuqgefGvqhkSH3qCkpBfqBAWG6qECiJwqdMPAnqUOk6kqVPdJJqWWhINqdYu8Aq7ZrPIqbfnM0qBfoQ6qKh2LlqghyEPq9iRArqDjXAFqFp59FqB4yHcqCBLBYqUEC9zqbH48Mq7IDBoqHJw75q7PnKOqMTWGyqXW6CjqgXP59q9dXHxqZdx93q8ebFnqfhtMlq9jR5aqAjlDeqjkXMMqan0ITqe069Rq72gKxqC495jqB7hM1qWB18HqIE2CaqEEM4MqZEjF_qJFmL1qeHLH_qSHzGrqgI570qPJ16_qeSK27qeUyBYqJVT2NqWVe64qBZq4Yq8ZwEMqLaNKSqgbFAwqAnyKxq9ogKOqEpYPWqJr2DQqX7oLvq98zHrq8Bw6KqeCWJOqGFb6YqUH_RgqgKIAXqOgUIsqLq1NMqEsIFRqesjEwqYtoOgqA8hNyqhCL9tq9CaACqNEQ3Kq9EYD2q6FADKq7HmAPqJJU3qqXNh6gqSPqKCqFXi1Zq8eH76qRk8LBqJkCBZqGkxLvqWmOHrq7mrKzqEmv60qXnl37qgtzH3qg1I4ErB1wGjrK7YDurMAb72r6AyMNrWChDxrTGM8lr7GxGcrhHZITrCIH83r8MMFbrbMR1Rr7MhBrr7N9CprBOpFArSR14orVXK9prXcxMLr9eEKSraf6OjrWhS6wr7ipFpr9mQFfrOpBIorApnNprF1QMYr88xFpr8AwGYrDBOH0rECcQSrKCpJTrcEU2OrOFxCgrkIf7Br7Jr5nrFM_LGrMOeD-r7OnANrgOt4mrXP9HirBQiB8rJUH58r8Z24GrAiLBerDl9Hmr7lyBEr9pJByrIqzParI1v2Nrb4bGsrS8DMlrABlQmraFODur7HHHGrfHS66rVIkARrWJJ8Pr6Kk6pr6M85kr8MwM_rgN36xr8Qi3wr9SmGPrBbADbrDby9UrXfmI4rXh481rel5HCrVooKrrgpJI7r7ppL6rfqM1Wras1KmrCsqF_ratcFhri6xJ3rA7xHJrZ9nQhrMAKFZrBDh3dr7Ri9vrgV899rTXmE-rCbZGsrUdL3br8ep7Ar9gYHCrEjGEFrXonEQrVo_CfrWrwMzrUty1GrT3WAirB988fr7C4DNrJGAOrr8H98Lr7NMKVrKQ74PrEVV7srYbL3MrWh9KFrBhv85rCivQ2rGmS4drLmn7CrHpSO0rfqD7arTr5MyrfrIKcrT4U7Rr97B4lrHB_DLr9Gr6RrZHHJqrWI77hrWIREMr8Ll79rhMQ6Qr8P5OLrYPYMcrbR24nrJTX7grETzGgrbfa5-rOh1IbrEhRBCrAhaCMrTjlISr8jwCQrWkYFirLmD77rUqQAirVs38frG05Dcr70aCsrg32EerB5o8orC80OArpD6DErAJYIKrKJnFGrTR49DrgX8KxreZN7frUaX9irac66gr8egHvrMi_MzrUnQ22rKuD5rrW1SL1rg2wCrrJ8EFrr98-JFrBCm4trUEDH9r8G16orJG3Oer7GS62rhGZForcGb5Dr9HtDRrJIHJIrhIh6yrZIzG7rAJI6kr7PH5Cr8Qv7Pr9RF4VrWScQCrHSyByrVVCLrr9XbDjrUaYKArhbO8mrDeZAHrViV4grbj4ERr9jYHArUkdN3r8ldJYrNmX3er92oI-rF4m75rd5yJjrdEmBSraIFJxrgKT6Ir6KoKvrTLROXreMnPNrVN-3irEQ47QrBRH4Qr9SH7SrIS_3XrEUoCPrXWJ8PrAYdA6rGYpBarIZlObrLZo7brLaIEMrFdJFQrfkuJsr7mRE9rVmSBFrhmjGbrKsNFRrD0rK0rJ5aMorH6wDVrC7nLwr9Dj5xrTFIC8rZIRBvrMJM4FrCLTHWrTOqM_rHWdDrrWZM44rTaAGUrhaWCer8hT7trCo7F8rBosBurNrdFcrK1CAMrD1zCQrK2hMfrO6BPSrS6SG0rFAJDVrBIMBOraL36irFL54rrIR-BOrASS2IraT5I9rCTlC2rJUN64r9fxKKrXio5vrLjWFxrPjZJlr8j-L3rTnR5XrYnrArrXtwB7r80s9YrU17L0rB41P6rA9fIOr8BXFsrCCBGarfC-29rXDHI7r7DX91r5GQ3TrcHOBYr9Jb8Nr6Jm5_r7KK5nr7LgNgrMP9LIrGQTEOreQo44rKXIOwrgY_4hrXiG5xrTk4EwrAkWK7rhlVHlrUm7PorCowPNrVtm6Er75aAMsM5fLusUC14AshEFD1s9F8E7sYIl4csjKI34sAKj8ysSOcDfs9RCOvsTV8FYsMZRBXsga_NssBcj4SsZet6AsVlSIZsEn3GDsWn-ODs9r5O0sCsgBzsSspBksE1BIksF1ODWsLA2MSsBAjCosiDtNRsAEfH4sJFE5BsWFkGqsBGWHssTGa7TsEH2NOsWHVHQsJJ87Bs7KL7ns9KP6-sDRQ8_seSxAcs8UiJgs9WmAAs8cOJMshhGE6sKi37msQiRJDsMirJ9sHnU91sWnVK7sVsgBzsQ2f7bsD2uFGsG6I5ZsI9gIcsHE1EAsAF0CHsZF7NCsfFjCesfQo8RsUV6AzsUVmCUsTb8EQsUem6fs8qxArsJ1mAesH4wPzsT6_DesA9zFes8AsDhsGBzNIs8CbKcs7FKFtsEFxLisXGVDBsiHWF9sEIH6os7Il7xsIK_GTsDQI42s8Qq4Xs8SDKosGTwFHsGXc4VsGYg5usUdNEusAi8Avsci9JAsCjRIBs8kyOCsgoOLLsTt8KCsV3BIZsc5CHOsJ7ID7sgFp9Ds7HMKRsZJ86bs6KxIRsUL5J8sSLA5ws8LPFls8NP8TsGPG41s8PYAxsKUJOIsGYh9_sTar8EsUc5JNsMdX7esBdeD6sWfDNlsMiuF1sHkzHzsH0T8bsJ1_66sH40HFsR74MGs97m4JsM8TBLs88nDus88vALsC90I4sFAF4AsTAjCgsdCfN3sAD7DJsFFvKusMH87ysBHgENsFKF9zs9Lg7Ks7LmD4sXRIFLseUw7IsVZQMcsTc3CEsccbCusiciHHsZh97Bs7kn4tsAmQBks7nCElsJotARsUq2MysLrRB0sTtfBDs83_91sV5KJIsA6d4GsCCfBvs6FL8BsUFY91sYIEFmsAIx8zsmO8CpsHOgQ-sIafKOsSfL5ZsEgIHKs8h5GssZh-PfsTiqJjs8nl7wsJrCKMs7s3OasZ6dGps97DCusEACGRsFACOFsQDcF5sFFSISsALg5OsULp65s9NOG0s9No3osTPV58sDRC6esFROHQsURxA3sSWW5qs8X9LpshaK6nsjabFesTcNOtsWiXIAsZpkNxsf3XLQsU4vQ9sH5C9HsA5xERsZ5x1jsU7tHNs9AOHYsFErCss6Fw89s8HkGYsBK84-s7NHLssCNz64sFOa42slRdMmsaTp4DsEVXC5seYyAEsbcJ1nscdwJKsBd-5msKiWGCsLlYKOshpD19sPpnNuscq5RXs9taBgsb3sPUsT9GL_sJ9SDrs7B74lsEC2HGsCDC9bsKDbGFs7ENB4shFF6EsHFvBqsAG5HUsAJd2csAKcDnsBLkMxsfLo2NsAMcKMsERa6xs8SAA_s6SwLksgZkIesBcc43sIc_MqsVev6ws9hX8ws8jFFusEkCFwsMklFssAleB5scqY2nsNtjB9sG0P1EsV0UBHse48A9sI4hOAsA5RIYsB5ZE8sh5oIjsG9wFHsHAPI-sUBGMysFCWC9s8DO8fs9Dt5ssGGFAVs7H99wsTN8HusFTGI7s9XPFfsUgoArsAiL0OsaoHLisCoU7esWp1HfscpmDxsF1dKFsS6A5tsG6IIJsC8JLHsIB36BsUB3KssBBr2xsUFtBmsCGv7lsBI8I6sfIiEQsTJ3HSsNKhDYs8LfKqs7Mi50sENrC4sHQxKDsAem9hsfgyHusek8BXsWku8fsDlYHxsTloEvsUnAHZscnCElsJnZAmsMoIJts7ouEzshsDLKsctW93sTt-FnsE5EM3sT5SLUsADY6osVI8LysAKt6fsGLm7wsXQQG9sYRPJQsORgFMsBSh6xscV1AzsRcl7YsGf2DvsOix3OsSnrBishqY52sN2nOqtA79CttT7yLmt89XEwt8ArEEt8D4EgtBILABtPJlAKtePNFjtBRSOVtZT38Yt9VT3_tIYlBttBY_8ntBZmErtWcO6Kt9eLFktgka7rt9kz3dtYlK8RtRnL82tIrY1Zt72aHRtAA879tVBTETthBXFItYC2FPtHJ2AstCJY2vt9Jv6bt7J_GvtfK2HGtZPG3_t8V9GDtah58Lt8iUGotPkQ5GtEkuGptgq8AntQtEHbte4l9OtS6oK3tI8qF1t8A9HUt8CUEUtID0Dqt6D042tVEhGbt8EwMRtJFbKJt9FvN0tTG9NMtOHoIwtUJGOntVKk3etIM21StJON88tFSK3PtAST6TtAUK5CtAXoACtTaoG4tBdaJ1tGjvKitBm-7stapBGntIq4JUtXqEC4tXrpLht81_O6tL2CCJte3OH4tIBBFvtEEKK5tFETNHtWHO96tVHbLrtJKNLEtUMN7ktSWAEdtWZ_EBtYbJKpthbq9zthcg6stKdgGytcfILgtXiP7PtUj2CrtCqMCst9snJ2t8tSLzt91aHQtX1qGVtf2e4QtS5g4ftI5yDwtU9YEWtKAyMRtHD2Dut7DkCvt6EaOLtbEpCctZG-EZtYH09Ht7IC8ktMIe7Ht7JDCstSLiGPtaMpGGtgP74qtEPFItt9S8EftAVOBJtUYb4FtGa87tt8ahB3tSeeI3tBgt5Kt9iQ8Ft7mlQgtXqI5itMtYBGtg49DBteBr6OtID7Hqt8ELDQt8EhNStbF43BtTHL9ktfHOFvtCImPdtcNVJ3tOQH6PtETJNCtEUUOUtaZ525tdcBNQtfcS7ytNgJAHtKhQ8wtEi0Aatgi0PstBpz8mtFq2NatYqNE-t9s65etd0pFMtb0-NktA1HHFtV1g3rtK65JVth9VE1tKACAst9AGI4t9AwFJtFCUJLt7HE5xt9IbHBt9Ln3LtIMBD7tNT153t8TD4stfU3R6tBW74ut9Y06LtBZ15qtDa1JDt9bHAFtAegJ9tMhMDmtThXMGtWhdFVtIi3DBtajB6ztbkXCOtIl8JitRl_QotUnHLIt6oAAptYq0M0tD2T6qtS6f9jtA9ELZt99pIDtHB7FptFBkCTtQElFdtCFv63tbF-Bjt8IyQVt9MLJZtfQkEItTR67ktCYH6ttTYLL0tBazDot9bZJHtMbvDXtddfHMtTej37t9g-BctdiZLzt6jvIhtMkU2ltFmDG6tCoJIOtBsJFct92UDKtW6M68tL8zP9tCAENZteAbGDtFCoGut8DFIrtJFVK4t_HK95t7KuIstVMDFVtMMELCtUMVJgtPQKE3tAVbNRtAXsH4tFaP2ct7cOJLtecU9RtNhy7ttRifDVtAikMQtAikDStWl6NmtYnxBGt80T9ktb1nMitA3mBgtZG52-t8GhCJtBHL92t7HZ80t7I183t7Tc9rtHWLBHtgXaG6tIauBdtFbHAKt9cdEBtdeAJhtGe-E7tFgyFDtWh3HjthheJJt8k5Kmt9kX4qtCmYLxt8mp3KtWnl9mtd0N9itI177rtf1tPmt930DhtS3K7btV4RKRta4qE5tD5aDxtHASQitYFP8QtcFqIctdHl8Pt8J_B0t9LQIjtSO6GDthRe53thTSJGtUTvLAt_XyC_tecT8Ct8hl7KthmNFstBoJOWt8sGEPtS4hAqth4jCltc5ZCOtH6QK_tSC5FctFCvNxtiFKCotbKa6vtFK-0htGMw24tSOiGHtiP-8UtAQ89htBT_OWtfZv4dt8ah5utAbLJ_tHbSACt8b-CltCeECRtJg0PKtHheF7tIiFHQt9pc9dt8p_CGt8rWMptXra7ytdrvEEtUtqNotN2HIcuW6xALuF7rQDuE8xHku99oC_uTCDPdu8CU6AuKDI8-uSEhG2uAFuQWuLGCDvuDGsE1uGIV8OuXKyFuudK-JDuEMZ5huDPHBNuCS45Hu9Uo3tu9ab78uebmOguAcG7PuCg4DRuXhF6ZuRlPDwudm6Lmufs7CtuGshLguU1TJcuS1YLouh2A3DuW6DHWuD7GI1u98oHtu99YFMuH9lBWu79z4MuWAyF-u8D083uYGH1guBGKAEuIHgGluXJn7Uu7KD4FuUKI5ku7LDHvu9MH61u8PYDluTSaAOuBTF7-u9UH0nuUZH8-u7Zc5RuWbIHFugcA5guigq7AuTjYAKudk0DMuJna0AuGpR8FuCq89ku8qlQOuCrqHKuN29HmuU9ZHruQA8LuuFAwBquVCXKVuCCv6juMCyEbu6DXLsuBDi1gu8EKATuBGq9nuUGxM6uhH3BeuCKN1ku8MA2uuWML2fufPD1VuTR3NduKRG6duZTs9fubUI7NuhW1MLuCWL6DubX5CduHaCJRucaE8Ku7c1Esudcx7NuHdd7YuEi67FuDiLKauVjEHguAjLDxu9jj9suWk0BruKknKOu8oiH5uG24AKua72LSuR8ILau8AZR5uRAbGXuFBQN_ufBY2NueCtI0u9DbGruGGlGZuUIZLWudK7OFuEKi7nuBLUCiuUOw4vuKPpLBudStPquBTIHruJTMHwuBVI5ru8Ww9oubYoJvuVbXBVuKec6ouPg1I9uHgc4OuMgj7du7h72MuBhUBluohUIsu8mT8suWm_JIueoM3DufqbP8uYqi7zuT5gFku86h8VuZ96DEu8CQBzuTEwCEuAIICAuKIX8Tu7KQ6Zu7LKLfuKRJC0uKTSCbu9YrNLubZ2CIuearMGu9bxPxu8cIKHuIdL7wuUdUFCuCdl8tugmi7yu8mzL8uWoAC3uGoDDWud1pAZuU3e8JuU4968ug7HQUuf7kKyu99FJZu9BFBRuNDgBpuREQAauAIDD0ucKQ5nu7LmCju8MH9wubO5IfuAPGGIuSTN4ouMTgHNuUc7CmuNgWJmuXgmAhufhXAKukij9EuBkFBfuJn6CZudqH1zuGtPGyuAtoDeuT0q3Cu92S98uC2TJ2u93PH4uW4pJHuB7uAOuS7_HxuYA9HNu9BbDGu8C2HtuBCJEuubC_GluAEO7UuAGY4qu8HD5vuKNSMyueOq7uu_PGH1uXR96PuVVxPCuYWHC8uSaSA_uEaSDuuWbv8ru9cs2-uZcv3ruTgdEbuYkFI6uTllHuu8oI7RuIpY84uUt00Pua1P6auJ1sFyuU2hEyuH3PC1uG5MD4uT782ru87g1-uJ9lH8uWAVRAu8BdGmuaEoAyu7Jq37uAMb7KuUP03vu7P8IBuDPwCJuTSU7eu8WJK5uVX_6_u8Z4E2uXZyIiuUdXEGuBefLIugfqIfuViDMMuRiF6ouhiWC4u9iaMnuRj3C9udkL95uAkrIwu9l2FDuVlIIHuClLIGucnAFmuTn-NEuWowKWugqlEmuIrv9TuF405huL6jGRu88w9MuT9kK0uKBYMjuACMFruACpGZuADx9AuIFVDGu8It7du7Iz5nubJI6EuhJiMOuDJpC7uXO99YuGOOJLuYOcRFuFQ3EOuTSxIEuWVmBguZZDDeuiZIJauUZpAaubevHDu8gWBOuXh78QuUjD3fuDmu89ucpD3CucpHIauJp_P1uIqeOFuGrM6pua036Dug4OMhu766Csug7k4IuN8eDGu7ASHgu8AVEIu8B42_u8B6B9uBCyApuADBGkuFF6MtuFJBBwuKNU1EuBRzGWuCUkHcudWa8VuJXL5hudXNG6uLXRBEuAaSBRu7b4DUuCbYCmuBcH9FuJcWJwuDcwMLu9do6AuAeX8zuKfX8Jufgb9HuUipIYuGjJG0uFmVJ7uRnODAuOoRNXuCp5NZugq7LAuAqVACuUrjBXuWs63KuIsz5ruI0PFpu93pFzuHCdKUuDDiGJuUE78nugET7muhEl8BuXFzMnuMH2LSuMHQ1juaLc4ouRQ-GyuVRP7LuBSACSuPSyN7udZ_DAuVb23suFbPGKuXeLNvuEfDCKuAfVGauIkaH-uOkoGiu9n3G2uDnDNMucpSFzuBsd7iuJ0EGAuS1K9SuZ1zIPuI2aHRu93rN8uc5nJ2uW7XF7uU7vIOuW8cEZuT8fJyu9AAM1u9CSKmueDt7queEu8lu6F8E1ucF8EXuVGfJTuSHW9Wu9I3GIuhJXPwuSKnCyuDO-MTuZQk2nuAU42quXWDBYuQXc7LuSYF6sueYSFvuTcWQQuFd9AzuJdM4zu8eiKKuNjmLxuZmwDDu8nAL1uTnU7cubpfN8uApiD3uTqcBTuMrz9ZubsXP9uFtHKMuCtmN3uh2ENWu92gHJuC2pO6u971Dhu98SCKuS8oE1ucAyAFuTCr8GuBESBouXEz38ueGa7GuMJpG3ugKL5ou8L97Xu7Lb7Gu8Lz7UuhMSD9uXMp5fu9N54HuaRIKuuHRq5AuBTB8yuAW40guEXp3QuJa3KGuhe6HXuafWHwudgpKgu8iNBWuJiRETuAitB3u8kgHtuAqi3XuEsXDXuBsgDHuIsoNTuisuJ8u9s-RjuF0GO6vA0NGwvV1M5uvJ1TACvO1uAhv92lH9vO2pOEv940Oiv94h7WvV5G3Uvf5JH-vK5WLwv88CC5vDBJI-vXFOGIvWIL5GvWK-OAvSMYIyvgOc9Iv9OmJYvBPSNLvXTnF8vAUpCgvYW1FlvHXi8ev8as0tvCauJ9vWaxEwvBbt51vAd76SvDdkASvAf4EVvRgbJnvSjaAgvZjhGMvVmmF0vAoX74vVp2CIvAp76hvMphL2v9sRN0vUu9MnvK04NevI0zMCv82bCYvA3tAlvH5PHBvA6vGuvJ8ALsv9AAGGvGAZGWvGBN5jvHFI5-vLG_9svYHwJYvSI1LbvUJbAxvPJoIRvcMw74v6OV5VvfOc9RvcQ32_v9QoGfvIRyFOvTTSC4vRUdAsvLXyLsvRfx8dvWgp4DvThB9GvXiIJsv7iNF6vVj8GRvVlcJsvBllLEvWo3HpvVpxJGvUq6A8vKsaMOvLskIqve0C2wv81FMKvX1yByvb29R9vC2P7_vY4qO8vH6uNhvJ8lCRvE9c9lvGAq4NveFT8Kv7GMA6v7HEBqvTHjEbvGIg4fvLJU8XvZKn54v8LV9KvENkBPveO37LveOfByv9S24Kv7S541vDSCJivUUk7avVYv2evQZOLcvAZv7iv8bO8mvBjBEqvCjJ8Yv8jMAavGjr6_vAlgOrvdmLIDv9maOVvEnALzv7oDLNvHtyEXvfuF9Tvg2rQXvA3HJzvG5PEMvM8nJnvBCACEvbCjCTvfD3GJv8D6FgvDDjISvUDnGIv9Ez5GvFFLD9vFFw5PvfHUBHvGHZDnveI68Rv7INCevdIoGnvaJoDSvELSCkv9M6DHveOSCzvfScHHvTVHKMvYVpMjvAdHGXvheS8rv9i87Iv8jaHDvAkaLQv8khE7vClm7WvAmmLYvdnaIov9pdEAvaqjFVvgrnKav7sF9avSsv5CvVs-P4vD0sAxvg4rDRvg7eIsvA9NC6veAXC2v6BuAGvCF0A4vfFe1SvEIM8tvgJjDUvKJy92veLz5PvEMlKIvTORFSvhPP8lvBUKK3vHW27pvaWOIyvVXP7YvTYgA4v9a_8fv8bTJovfc851vDclLCvDfADBvEfiGrvBh0IlvFpdG7vHraNjvQ2JCIvT3jBdvB78Emv87mDxvV8JRLvS9GHbvH9ZC4vVDOOLvZDn8CvVDtCEveEhD_vKF08LvVFQ8zv8Fs9Fv7I9ADv6IRAmvTIZ57vaJHIjv9KSG3vJMZ92vUN66svXRoDFvVZ16bv9ZoE8vEb-Jmvbd86Jv9g2HbvZhbHmvUiPOHvTl4J6vPpB3zvUpp4mvdqU6vvHsB7_vA3yKrvE3_Jav94DO3vQ7pAJvhEGEkvVGaDFvaHdOnvWJTNOvEJY2vv8KIOEvMKWFfv9P78zvARAMevVTKANvhUl8TvBVx4RvKW5HbvUYoQzvNZ1LqvLbL9zvDbpFdvEcnExv9e4DxvCf3IyvThJ7-vDhNB9vVieACvZikJ1vfkdDbvFlzK4vBnPExvho8AXvhp4EVvAs-4xvUtHJJvV1oPovC2ZGPvI4rI7vL58FQvL68G0vK7IG8vWA6HSvGAJGivGBOLhvUCXNtvjChBQvAGTA8v7H36mvdHjB2vWI59yvULBD_vXMpImvCNtCmvaR47mvgRA6gviRF2DvHUjL9vXV2FrveZ9KDvHaHBTvfal2cv9dG7iv8ds5YvEhCFKvSiKIRvbjyADvEk8D-vClq7SvEniNSvCoG8AvYqlJAv9sa4OvK5CDivL6ADYvU8_L6vQBiBWvJDB1VvME664vEEF92v6G9B6vGHTATv7IpErvAMwEMvHPaBwvRTyFZvUU19mvTVV32vAVdFmvVZ79lvFZF14vTZM16vZZyMCvCa16XvNa44bvKaeOvvbesNSvAf9H5vKhMQBvYj8HOvCjBGLvAkv8pvKlS5uvepdFNvdsl9svQ0e9Avb1lLZv83q0qvT52NCvM8pHyv98rLDv894F5vBB0LdvAB49GvcCZIivBFvCVv9HqBpv9HrLIvfJ76Tv8J8BYv7J85JvEKGMQvTMFArvgOC3zvBOF6dvhPSMwvXScI7vcT2ACvXWe5wv9cgBovQeL7vvBf6IWvAjb9RvAj_BEvZm9CXvOmvIVvMokE-vFotEHvdr58vvBrwA8vZt34Dv7tOC1vV0K8rvW1C6YvH2mKfvM5J3Vva7L1kvG8J6CvW9SFevAA51YvRAjEyvBC9LQvJD2GzvAD6D8v5EGEwvVEsGNvgJj1RvUJkASvBKL70vhKpJ9vEMwFwveOqFRvBPz6dvFYR8Rv8ZVIBvZb_9evAcRNjvTcd4wvAgbEZvKhV81v9iQN6vXj_GfvUl3Dzvamv4KvEnb2evMoBIAvG0COavV57H7vh8D1qvT8iH9vABSKkvCCaE0v8G2GAvbG6HmvdGm33vJHw6UvOK05mvML0GWvEMZA7vWNZHVv6Rm4IvFTDMnvgTIHLvCTeENvgWIMav9YcEBvAYlAHvaYmLhvKZuHIvTebIavUfAGdvUfq5iv8hwJ3vHiJAkvYkXKQv9ksHhvHluHQvSmPIpvWmXKbv8n4LUvIo5LovWrRBtvArz67vcsDLnvJsINLvGsLGqvbtLEPvJ1HFAwA2ML3wA3gNBwd3m9PwH4YJvwV71A7wJA2Nlw8CfE2w6CoIowEFK4uw9GTP8wbGoA8w7HsA_w7Hs6Sw9ITBmwHQ19pw9SmKRwgVKEPwBVX7bweVl9bwBX124wZbrFPwgduHcwbeiMQwdeo4Fw7fD8-wBflHIwTgCLBwfhN6iwZi1CVwMiOGvwWibIBw8kzBywCljO4wfmPG9wenFH5wgnT9NwVoxK3wApKH9wApoIcw906FPwG0G6PwK1tBFwa2xDwwJ3-4awZ3_8KwA4OM0w94eLmwU7tEfwT9A7mwM9pCiwVE1G4wREQETwBElEtwMFbKEwbFd9JwXHBBWwHHYLcw8IT5aw7KZDmwWKw5UwKNdAHwGNv4_w8Pm8pwHQ8HxwCTaGlwdU75qwDUn5jw9VtDEwTWbMTw9YWAAwAZe6TwDbl2mwXeoHgwFje5bwcjh7IwEkhCow8lLNnwLlUJLwTn69zwKoAHtwGobAxwIpGMow8qrP-wAtuBqwe036SwS0YKUwH2fCYwJ7X57ww878Vwa9qExwHAjD1w7BYBTwTBYBWwRBx9-wXD9D7w6E6LZwAESAWwJFVB9wRG-FzwUJdBKwVJ_HrwHKc6swLNF6EwANeMVwKOtCAwLQ9JlwcRD8qwUSqIbwDT78aw9U2GHwAU84fwHWZGtwRZFE3weaF3_whb0GHwCgaEiwHh6CCwAhIF2w9hS7Hwai63vwFjZBjwAjuM4wKkkGgwSlfNpw9oDCZwEpLDPwY0_MMw91BDSwf1e5FwD5DGTwf65Jvwc6JDzwK7nBAwI89JMwB8p6gwTA3N7wWAFGHwGAUHSwFB9AlweDaGLwCEJ3mwAEU9qwVFX8Iw8G0JAwaG_6mw8K9CqwAKrNmwGK-LCwXLaA_wUMDFMwVMmOuwXN56lwWNE6_w8SXE-wHSkP2wYVwHwwgXU3gw8YXKPwcZ3GewTZ4AkwUa3Nzwaa6C8wVbo8KwGc7H0wXey5vwXf9KWwWgHAWw9gRJ6wYjXBvwbq9KowAquMwwTrAGLwOrkDIwSro6awFuA1EwV264Fwf6U47wTALJPw9A_IYwACf7twhDQBAwAFM94w6GRGbwhHz87w8JAI3wRJWNrwSLTBDwMMZGewYOJKWwLPbJOwVQpMpwURQJ1wJRkJXwJT03PwVVw9xwEW4HCwAWV3EwibLKkw8bfQ4wBdVIkwhe153w8fYHtwOhyJywGig85wHjdMFwAl1Gaw8l1IlwPlU9swSlyLowHnr5lwEoe9-wFouKVwBq-KGw7rlJmw9tf40wc0gNhwS1vEvwS63Crwc669OwU6MHCwA7QIdwC88CJwW8jNSwjAT4JwUBrAWwYD9MawhELAgwgFC90w7G297wCGEI2wLGkFFwYHFL8wHId4dwfJmEPwfKW8Hw7LGMZwBL-6uwSMNB2wDO9OFwDP5OmwaPA42wAQK4mw8QyGUwbTQBvwIVXQMwPW26HweWd3VweY5MkwfYBLowfYG7ow8YKKuweYe6gwBZq4Zw9aNO6wUbA5TwAbT3ww9bzHlwed8EGwHdK4xw8dsAAwIedQbwefLCNwZg98JwSgCQawKgSDKwThN55wUhWBlwBhgNrw9kr3GwEolN3wEpNMwwNptH7wHtg1mwWtmCDwV3gC-wN3-CJwJ5PN7wY75CtwV9pJKwcBaMLwCCI8SwUD18bwWESHhwEFBIrwQFfQGweFzDtwGF_Djw8G8FOwFGiAMw8GsIHwDH2IRwgHZCTwgJs8bw7KwBEwbMJ95wBNRIiwVQK5mwaSU79wFUD4fwGUHLSwdVTHpwCZV7kw8Za9zwVZk37w_bpC5wAcTMiwAepGdwBfaMUwAkSFwwLkv3dwVmV98wfmYQzwMnZ45wYneMSw8n_Lpw8oKJ6wHpnIFwZqFDEwSqINuwZst5zwgs-KnwA3v5IwS4YHmwY6OMhw86uGxwd8D7QwE8JFYw98rHww998LhwVACF1wSAgDaw8BHBXwLD68vwWEYHAw9Er8iw8F46Yw9FCBLwWFaIcwAHz85w9IUDEwIK7JmwBLTC8wTOi71w6R8EZwKTV75wOU3IOwBUzFuweVI6lwWVRDGwIWnHTwAYi9wwAYlLHwKZY3bwOagLOwHbM4dwCcJ5TwTckHYwgdyI3wUeb7Bw9em5FwUep4bw9fKHtwCg49hwEh1B7wNhQGjwBhgE1wBhv3-wTjaG6wJjq5mwGkc5UwSkfCkwhlcMkwCmB1QwWnF63wKoB7gw9q3NzwhqXBzwTqdEmwKqp0ewUruFvwGt-CgwX0bCaw810ENwR2hNBwAAMJOwIBIDBwNCqGmwhCvEMw6G2BPwdGxCJweHNIOwHH_K3whIj4aw8JE6owNJK8XwUM64OwDMTPMwLNyEowYP8EpwXQJ78whQyAFwBSg7_w7V5KTwEWV6lw7WqAAwKZT6PwSaaMcwBcxDjwRd6EkwAeoFTwZfxF1wJhRCOwInUIywLoWLuw9omHFwGsV7fwXskK2wJtsEFwDtwFXwh0BBVwW0X0owi1RNVwG42NYwA4GJBwL4QBRwF688gwN6RGTwA7XILw87_JJwA94JSw9AC1KwHAeMVwCAtGawGB6Clw8CaFOw8ClA_wJDZFZwSEXLhwCEZJBwhF14fwAFSEDwAG3D_wIGWGTwXGeFWweH1FKwfHZ99w6Hm9swVHx8Nw7IL4fwJIM3kw9IpNIwIKt4ew8LZ6ow6N-5-wDSLQ5wVTJ5FwfTY7rwAUw7UwKYdGRwbYyCDwUb75mw8bL4gwHbP8QwWc15PwHdf7ewDf3RgwFfT6lwAft4gwUhiAPwAipHtwCmDLNw7n1BHwWoIAmwdpFHAw8p_FuwgqZ34wIu3E5wd0qJDwg3b9LwV5JI6wJ66F9wS6HCbwK7fM_wN8MKJwD8rOawHAi4GwVBaGQw8BfHpwWBfH_wAD52ZwiDhFdwSEJ9QwBEpApw7FhE9w8HPBwwJHQA8w8HWCGwMI3GBwhKA66w7KZ1fwgKq81weLtBcwaLyMxweN64owbOdK9wCP9N0w9QB90wBQLFLwXT37_w9UTDUwEUrFewVW23-wIafATwVbeJowMcd8GwWdr3Fw8gWI9wDhaGwwAj3A1wcjhEOwCkhJswPmTBZwUocDSwWpfMLw8puHTw8qWDKw9qjIGwZrgL3wGs47bwV05IJwO0DNfw91o6ewN28H4wA2oJzw86AOLwf6ZQowa6zHJwI98N8wE9rAuwDC3Cjw9CtDYwXEI8XwBGEAuwBGi7hw7GzDTwgHJMjw8HOMBwgI88RwGIeGYwaJZHJwXK5DkwAL3BZwKL84YwYMj57wWMvF7whNq3LwAOB5JwKPQChwDQmFswcQr5mwKRDIQwFSqMOwbYdASwUYnIYwBapGzwEcAIewBfDFawBi86wwSkw71wGl2GlwMpwBBw7qECgwXr1PswgrgCGw8',
  lines: '4sKh2kJe1YIv0LId,2FHk1sHt1WIf1YIv1SJLtPKrr_Kh,tPKrtVK_tOLL,2kJe2EK51zKV2kLS3rLg,tVK_tjLK,MF8SOW9DPg8H,Yi1kcJ1ndC1zcq1l,mlCbmyCgoTDCpoE1qQDsqiE4qyE3reCusdCesIAm,oTDCpqBv,poE1qECs,qiE4qZEI,spAxsdCetYBI,kMFkkXFTkiF4lKDykbEEjYEZimGFkXFTjYEZioDJ,er5Gf44bdS4sdp5Kdr5mf66Her5P,6fIL4-Hl4VHK4SH5,E3L5COLGB-KWBcJGCmIYE3JuE3L5E3MZCOLGBpKwBqKV,WKGpWdGyXRH4Y4IqY4K3ZFKOZnJHYaIJXRH4YRGD,Y4K3XTLHXMMAXpMBXTLH,Ab72Az7XB18HBv8X,BdMUBtNWBVOR90PD8-OJ8BNR,BVOREpOvGQQ6,L2FxKWGwKSHRKbIa,KWGwJPFW,UKK3TSKY,EzBGFrBTGYAMGl9yGU9jGN9YEt9N,HM9VGl9y,FrBTGGBPGZBeGBCCGGBP,HyEuHUFN,laC7ljBmm0BImhA7mw9toHAap4BZooBTo6BSnTBOlaC7,FY7KF05rLd3BN-38P740Oi4RO74VLn4pJe4nIe5oJ86hKW5XLn4p,P740Q24KQ74PQI4fQ74sPY4tOi4R,4UO13NNU2ENZ1bMv0NNJ,Qd5ZST69TE6ETm6QW25jWf6hWQ7RWQ7ZX58OYD7UZ87V,WQ7ZVH8L,YN4aW25jW-4e,TE6ESb5uR14o,m2NwmfNknyNsoxNGqAM-p_NAqjNCrWOQtSQCoMP6nyNs,oMP6rWOQ,6OEa66Ey5oFP6SFf71FT78Ej6OEa6FE75SDc4NCT44Bb1jBG0nCi2hCU3ICo4NCT,JU23Or1oPD1VSs1hS71sOr1o,Zs4uYU3wa44p,Ex8sDj8UDH8lCy8X,Dj8UE27O,UtGpUyIRTBIV,iV8Hio8Hiw89ix7xit7lig7Vi87IhW7T,aSI-aGIdaXIFarIBb6I9bQIHbaIl,STADSXAYSmBLTJBVTUAQSXAY,RECYQmCNQYBmPnBDQFAWQiB8QmBJRYBCR-BO,QYBmQmBJ,T_4lSk4v,TA4DTM59,nkIomiJOlmKNkIL7jiM9jDMQ,mWL9lmKNklJZjlIS,mBFrmMGMmRGZmjGbmbGRmMGM,A061Aj5UD24JDU3pDr4DD24JBy55Aj5U,fyMzg4M7f2MFf7MifyMzj1Ofh0PDeCOLcSNhbbNEa8NIW_O8TSO-R1Ov,h0PDh1PR,j1OfkQP3,nsEunoFeneFf,C2DHBADZApDY9sD09JBz8rCB8kCY8KCb6vCh6QBv6TBA78AO7pAg8MAi8tASAn9IAK8mA58o8-8Q8V7n7q7L6-7n6I7r5l6d5L614Y603q58,7W9Y6d904t9V,EfHbEzHbFoH_GsIoHmJ3IBISHqIHHCHWGaHIFYGeFrG5,HCHWH7Gf,ry5qrT63rF6lqk7Fpv6krF6l,qj7HqB7dpp7vpL8E,cNH4ciHRd7J0dBK9crKicHLJbsL5bEKj,d7J0dtIv,dBK9eSJq,g3JvenJteSJqdtIveSHyfgIPg6IegVIa,eRGKciHR,9x7T6M686A5t6I5Z7B4l6_43,KbF4KfE-KSEcKHEbKEEzKbF4KwE_LgERMgDvMBCjN7BmNsC8OTBSPOBYR595Rs8nVDASX49vYo9i,101_8u2U6F3P5Y3L4V3W4f4S,mM6hmc5zn14xpV5Uo05kmM6h,qVMEqoLxqkLXqPLLqmKpr9K_qkLXqXLpqVME,qmKpq7KHqCJz,NnFyNkGiOEHAQLHHRjGMQMGUNnFy,OEHAO6HkNAI8MvHo,NlJaOTJMPXJQOYJpNlJaMSJm,EJBlDxBsDZBmD0BICEBYByAaCrAqDTAaDkAp,CFC3CEBYCVC0,ZKA7YpBaZrCcaZBmad9hah9Q,YpBaaZBm,b98qaj8ia18PZ_7kZ67LYT6gZf5xZu6ba375aY7ebW84bm8K,Z_7kaY7e,ErNIGJNCHTLmJfKqL8KcLrJqLxJS,hyJyhxKGheK8hyJyiKJriVJBi9JIhyJy,EU2OC-29BY2NBr2x,mr8omn7Co27inx92nH91mr8o,I1CaJ5DcGuD_FCC-EfD5,GuD_FyESE_EoFMFDFgFd,Ra3fSq3STb3HTy3RUa2vTP2pTb3H,bm70ca6ecI6Ebe6Obm70,Xt0_rN1Mos1-Xt0_,gACYfkEVfZEofDG2dmFYcjEOc4DVcEDLczCQeGBd,dmFYczCQckBUcaBBcSAycWAQ,fZEoeGBdejAAew9P,ENGODsHFEEHDEYGIEAFaDuFECjF3BXFg,BgELBWESBOEyBLFABNFTBXFgBbGBBvGUC6GW,CICoChDiC-E1CjF3D6FdDuFEDKDnDbCZ,DKDnD9DuC-E1,lu5Dme3klE3kiF4Mh64TgX47fe3zhu2wkv2hme3koG3s,pzJGrGIos3IT0LId0XGSs6GSrPF-rCFmpzF2oyFd,s6GSs3ITrXHwrOHmpsI1o-I4,8nJ799J39LJg9JKK8pKk8jLY8TLc7_Lt7EMR6hMp6qMK7PLq7QL57MKU7UKG7FK86_KH71KU7MKU,9eLy9zLe9kLX8jLY,7PLq6QLm43L_,127T2b6n3T7J3a6P2h5S2b6n0O6x127T,Fy4PDh5IDa65,2uHw2pIn37IL2uHw2pHM3bGT47FW4nEW4SEa3-Ex3XF12uFG2TFJ1wFGuEF9tUEyt0F4sjEwsbEbszEHtZEMtkEdtUEy,sbEbs4Eg,rA9srq9Srm8_rd8xqp91pv8wo-8wp59Fpv8wrA9s,FY7KH58HHo9eHx9uILABIeAVJ3AHIv7qJ86h,ILABIIA1I89YHo9e,Iv7qKK8ZKT8uKk9l,9y4JA14p9L4U8m3y9y4J,k6GukOGzkrH7,k9GpkOGz,gu8Kh88ih09QhIA6gkAn,jR77jU7kif9Ph-9shIA6,ki7Xkt8Zkk9zj-ABjXAFj9A7iM9zh-9sh09QgR9Kh88iif9Pip9liM9zikAhiwAojEB6jOBIjOBa,ikAhiSAniJAXiM9z,bT9_bXAYbkA-,bXAYcLA4cg9ycw9gdT8jdY88de7SeK7KfJ7Mfj7pfW7-fA8H,2J9Utq9hsf8_tC8A,haCoi2DLhsCfhLBohaCo,azGUaoH9b4GvbNGXazGUaXFjavF4b9Enc4DV,eGBdfKBggACYgKCoh1DdiPEk,NmE0N9CpOcDfOeD-,DCHNAoGfAWGZA9GWAHGpAWH4CmIY,A9GW9QG186Fb9WF0,86Fb80FU8UE8,ge6uhF6uhK6P,4RIi54JY5NJM4RIi,dQ3IbK4AZv3LdQ3I,qI4fsc4-1F4E0o3xuG3qqe3wqI4f,SlM-PxNkPtMuRvMTSlM-UFMqVQMfWLLn,RvMTRbLYQWJFQVI_,RbLYQAL1OKKZ,QAL1O7Kn,PxNkMLNxJyNZN5NIPtMu,PtMuN8MXMOM9L4La,LFLSMOM9,auQEcCPwZ-PIYpPgauQEdJQuf7Rc5yS1,KW5XLz5UNK5YPH6MO17VMJ7lLQ7IJ86h,RbF5RnEMSwDzTmDsUtDDVTCKXSD8YWDB,UZFoUJEcTmDs,UtDDVrD-WuEJYeEN,LC3iJm3lJ43MH43SGm33J43MLC3i,jBHQjgHxkeHrkxIQlVIQ' };
//</ciel-data>
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
  const W = 320, H = 180;
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
  // la vue « comme dehors » : un panorama vers une direction (vaz au centre), l'horizon en bas, K pixels par degré ; on tourne et on lève les yeux
  const K = 3.2, GROUND = 22, VMAX = 90 - (H - GROUND) / K;
  let vaz = 180, valt = 0, bgKey = '', skyIm = null, groundCv = null, stars = [], segs = [], lines = true;
  const HY = () => H - GROUND + valt * K;  // la ligne d'horizon (descend sous le cadre quand on lève les yeux)
  const projAz = az => { const d = rev(az - vaz + 180) - 180; return Math.abs(d) * K > W / 2 + 12 ? null : W / 2 + d * K; };
  const proj = (alt, az) => { const x = projAz(az); return x == null ? null : [x, HY() - alt * K]; };
  const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_', n64 = c => B64.indexOf(c), n2 = (s, i) => n64(s[i]) * 64 + n64(s[i + 1]);
  const STARS = []; for (let i = 0, s = CI_DATA.stars; i < s.length; i += 6) STARS.push({ ra: n2(s, i) / 10, dec: n2(s, i + 2) / 10 - 90, mag: n64(s[i + 4]) / 8 - 1.5, bv: n64(s[i + 5]) / 20 - .5 });
  const LINES = CI_DATA.lines.split(',').map(l => { const p = []; for (let i = 0; i < l.length; i += 4) p.push([n2(l, i) / 10, n2(l, i + 2) / 10 - 90]); return p; });
  const starRGB = bv => bv < 0 ? '170,190,255' : bv < .3 ? '214,224,255' : bv < .6 ? '255,250,242' : bv < 1 ? '255,236,200' : bv < 1.4 ? '255,212,160' : '255,180,120';
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
  const mixHex = (a, b, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - k) + parseInt(b.substr(i, 2), 16) * k).toString(16).padStart(2, '0')).join('');
  const noise = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, a = noise(xi, yi), b = noise(xi + 1, yi), c = noise(xi, yi + 1), d = noise(xi + 1, yi + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
  const galactic = (ra, dec) => {  // longitude et latitude galactiques (degrés), le centre de la Galaxie en 0, 0
    const a = (ra - 192.85948) * RAD, d = dec * RAD, dG = 27.12825 * RAD;
    const b = Math.asin(Math.sin(d) * Math.sin(dG) + Math.cos(d) * Math.cos(dG) * Math.cos(a));
    const l = 122.93192 - Math.atan2(Math.cos(d) * Math.sin(a), Math.sin(d) * Math.cos(dG) - Math.cos(d) * Math.sin(dG) * Math.cos(a)) * DEG;
    return [rev(l + 180) - 180, b * DEG];
  };
  const milky = (l, b) => {  // l'éclat de la Voie lactée : une bande sur le plan de la Galaxie, plus large et plus vive vers le Sagittaire, coupée par le Grand Rift
    const core = Math.exp(-1 * (l / 38) ** 2), w = 5 + 8 * core;
    let v = Math.exp(-1 * (b / w) ** 2) * (.32 + .68 * core + .2 * Math.exp(-1 * ((l - 78) / 22) ** 2));
    v *= 1 - .7 * Math.exp(-1 * ((b - 1.5 + l * .015) / 2.4) ** 2) * Math.exp(-1 * ((l - 32) / 42) ** 2);
    return v * (.6 + .6 * vnoise(l / 3.5, b / 3.5));
  };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function paintSky(sa, sunAz) {  // le ciel pixel par pixel : bleu le jour, rougeoyant vers le soleil au crépuscule, la Voie lactée la nuit noire ; tramé comme en pixel art
    const im = g.createImageData(W, H), d = im.data, hy = HY(), f = lat * RAD, lst = gmst(t) + lon;
    const day = smooth((sa + 10) / 14), dusk = Math.exp(-1 * ((sa + 4) / 6) ** 2), night = 1 - smooth((sa + 18) / 10);
    for (let y = 0; y < H; y++) {
      const alt = (hy - y) / K; if (alt < -3) continue;
      const a = clamp(alt, 0, 90) * RAD, hz = (1 - clamp(alt / 90)) ** 3, sinA = Math.sin(a), cosA = Math.cos(a);
      for (let x = 0; x < W; x++) {
        const az = vaz + (x - W / 2) / K, A = az * RAD, ga = Math.exp(-1 * ((rev(az - sunAz + 180) - 180) / 65) ** 2);
        let r = 6 + 12 * hz, gg = 8 + 14 * hz, b = 22 + 26 * hz;
        r += day * (46 + 114 * hz - r); gg += day * (96 + 104 * hz - gg); b += day * (190 + 50 * hz - b);
        const low = Math.exp(-Math.max(0, alt) / 9) * dusk * (.25 + .75 * ga), mid = Math.exp(-Math.max(0, alt) / 28) * dusk * ga;
        r += 230 * low + 60 * mid; gg += 105 * low + 22 * mid; b += 40 * low + 70 * mid;
        if (night > .02) {
          const sd = Math.sin(f) * sinA + Math.cos(f) * cosA * Math.cos(A), dec = Math.asin(clamp(sd, -1, 1)) * DEG;
          const ha = Math.atan2(-Math.sin(A) * cosA, Math.cos(f) * sinA - Math.sin(f) * cosA * Math.cos(A)) * DEG;
          const [l, bb] = galactic(rev(lst - ha), dec), m = milky(l, bb) * night * (1 - .6 * hz);
          r += 66 * m; gg += 68 * m; b += 86 * m;
        }
        const k = (y * W + x) * 4, dz = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - .5) * 9, q = v => Math.round(clamp((v + dz) / 6, 0, 42)) * 6;
        d[k] = q(r); d[k + 1] = q(gg); d[k + 2] = q(b); d[k + 3] = 255;
      }
    }
    return im;
  }
  const hill = az => 6 + 3 * Math.sin(az * RAD * 3 + 1) + 2 * Math.sin(az * RAD * 7 + 2) + 1.3 * Math.sin(az * RAD * 13);  // en pixels au-dessus de l'horizon
  const TREES = [[18, 1], [25, .8], [31, 1.25], [96, .9], [118, 1], [124, .7], [160, 1.1], [168, .8], [232, .9], [238, 1.25], [245, .8], [300, 1], [330, 1.1], [337, .8]], HOUSE = 205;
  function paintGround(sa) {  // le paysage : collines au loin, prairie, sapins, une maison dont la fenêtre s'allume la nuit, les points cardinaux
    const c = groundCv ??= document.createElement('canvas'); c.width = W; c.height = H; const q = c.getContext('2d'), hy = HY();
    if (hy - 26 > H) return c;
    const L = smooth((sa + 8) / 12), col = (n, dd) => mixHex(n, dd, L);
    const far = col('#0c1020', '#6a86a6'), near = col('#05060c', '#3a6a34'), rim = col('#141a30', '#5a8a48'), tree = col('#020307', '#1c3a20'), wall = col('#0b0b14', '#c0a07a'), roof = col('#07070e', '#8a3a2a');
    for (let x = 0; x < W; x++) { const az = vaz + (x - W / 2) / K, hf = Math.round(10 + 4 * Math.sin(az * RAD * 2 + 2) + 3 * Math.sin(az * RAD * 5 + .5)), hn = Math.round(hill(az));
      px(q, far, x, hy - hf, 1, hf + 2); px(q, near, x, hy - hn, 1, H); px(q, rim, x, hy - hn, 1, 1);
      for (let y = hy - hn + 3; y < H; y += 3) if (noise(Math.round(az * 3), y) < .18) px(q, rim, x, y, 1, 1); }
    for (const [a, s] of TREES) { const x = projAz(a); if (x == null) continue; const base = Math.round(hy - hill(a)) + 1, h = Math.round(18 * s), w = 6 * s;
      for (let j = 0; j < h; j++) { const half = Math.round(w * (j / h) * (1 - .35 * ((j * 3 / h) % 1))); px(q, tree, Math.round(x) - half, base - h + j, half * 2 + 1, 1); }
      px(q, tree, Math.round(x), base - 1, 1, 3); }
    { const xh = projAz(HOUSE); if (xh != null) { const x = Math.round(xh), base = Math.round(hy - hill(HOUSE)) + 1;
      px(q, wall, x - 8, base - 9, 17, 10); for (let j = 0; j < 7; j++) px(q, roof, x - 10 + j, base - 10 - j, 21 - 2 * j, 1); px(q, roof, x + 4, base - 16, 2, 5);
      if (L < .5) { px(q, 'rgba(255,200,110,.22)', x - 7, base - 8, 7, 7); px(q, '#ffd27a', x - 5, base - 6, 3, 3); } else px(q, col('#000000', '#7a9ac0'), x - 5, base - 6, 3, 3);
      px(q, col('#000000', '#5a3420'), x + 2, base - 6, 3, 6); } }
    CI_DIR.forEach((n, k) => { const x = projAz(k * 45); if (x != null) PXK.fill(q, ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][k], x, Math.min(H - 5, hy + 16), col('#4a5a8a', '#e8f0d8'), 1, 'center'); });
    return c;
  }
  function place(sa) {  // ce qui ne bouge qu'avec l'heure ou la vue : les étoiles visibles et les traits des constellations
    const lim = sa > -2 ? -2 : sa > -6 ? 1.2 : sa > -12 ? 3.4 : 5.6, hy = HY();
    stars = [];
    for (const s of STARS) { if (s.mag > lim) break;
      const p = altAz(s.ra, s.dec, t, lat, lon); if (p.alt < 0) continue; const x = projAz(p.az), y = hy - p.alt * K; if (x == null || y < -2 || y > H) continue;
      const m = s.mag + (p.alt < 20 ? (20 - p.alt) / 20 * 1.6 : 0); if (m > lim) continue;  // près de l'horizon, l'air éteint les étoiles
      stars.push([Math.round(x), Math.round(y), (lim - m) / 2.2 + .2, starRGB(s.bv), m, p.alt, s.ra + s.dec]); }
    segs = [];
    if (sa < -8) for (const l of LINES) for (let i = 1; i < l.length; i++) {
      const a = altAz(l[i - 1][0], l[i - 1][1], t, lat, lon), b = altAz(l[i][0], l[i][1], t, lat, lon); if (a.alt < 0 || b.alt < 0) continue;
      const p = proj(a.alt, a.az), q = proj(b.alt, b.az); if (p && q && Math.abs(p[0] - q[0]) < W / 2) segs.push([p, q]); }
  }
  function aim() {  // regarder d'abord vers ce qu'il y a de plus beau : la Lune, puis la planète la plus brillante, sinon le sud
    const B = bodies(t); for (const n of ['Lune', 'Vénus', 'Jupiter', 'Saturne', 'Mars']) { const p = altAz(B[n].ra, B[n].dec, t, lat, lon); if (p.alt > 8 && p.alt < 45) { vaz = Math.round(p.az / 5) * 5; return; } }
    vaz = 180;
  }
  function draw() {
    g.imageSmoothingEnabled = false; tick++;
    const B = bodies(t), sun = altAz(B.Soleil.ra, B.Soleil.dec, t, lat, lon), sa = sun.alt, hy = HY();
    const key = [Math.round(t / 30000), vaz.toFixed(1), valt.toFixed(1), lat, lon].join();
    if (key !== bgKey) { bgKey = key; skyIm = paintSky(sa, sun.az); paintGround(sa); place(sa); }
    g.putImageData(skyIm, 0, 0);
    if (lines) for (const [p, q] of segs) { const n = Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])) || 1; for (let k = 0; k <= n; k += 3) px(g, 'rgba(130,150,215,.2)', p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n, 1, 1); }
    for (const [x, y, b, c, m, alt, seed] of stars) {  // les étoiles scintillent, surtout près de l'horizon
      const tw = alt < 40 ? (noise(seed, tick >> 2) - .5) * (alt < 15 ? .7 : .35) : 0, k = clamp(b + tw, .3, 1);
      px(g, 'rgba(' + c + ',' + k.toFixed(2) + ')', x, y, 1, 1);
      if (m < 2.2) { const a = 'rgba(' + c + ',' + (k * .45).toFixed(2) + ')'; px(g, a, x - 1, y, 1, 1); px(g, a, x + 1, y, 1, 1); px(g, a, x, y - 1, 1, 1); px(g, a, x, y + 1, 1, 1); }
      if (m < 0) { const a = 'rgba(' + c + ',.18)'; px(g, a, x - 2, y, 1, 1); px(g, a, x + 2, y, 1, 1); px(g, a, x, y - 2, 1, 1); px(g, a, x, y + 2, 1, 1); }
    }
    if (lines && sa < -8) for (const s of CI_STARS) if (s.mag < 1.6) { const p = altAz(s.ra, s.dec, t, lat, lon), q = p.alt > 3 && proj(p.alt, p.az); if (q) PXK.fill(g, s.name, q[0] + 4, q[1] + 6, 'rgba(150,170,220,.6)', 1); }
    const shown = [];
    if (sun.alt > -1) { const q = proj(sun.alt, sun.az); if (q) { const [x, y] = q.map(Math.round); for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) { const r2 = i * i + j * j; if (r2 <= 64) px(g, r2 <= 14 ? '#fff8dc' : r2 <= 30 ? 'rgba(255,240,190,.5)' : 'rgba(255,236,170,.14)', x + i, y + j, 1, 1); } shown.push('Soleil'); } }
    for (const name of ['Lune', ...Object.keys(CI_ORB)]) { const o = B[name], p = altAz(o.ra, o.dec, t, lat, lon); if (p.alt < -1) continue; const q = proj(p.alt, p.az); if (!q || q[1] > H) continue; const [x, y] = q.map(Math.round);
      if (name === 'Lune') {  // la Lune et sa phase : le côté éclairé tourné vers le soleil, le reste à peine visible (lumière cendrée)
        const ill = (1 - Math.cos(o.elong * RAD)) / 2, side = rev(sun.az - p.az + 180) - 180 > 0 ? 1 : -1;
        if (sa < -4) for (let j = -9; j <= 9; j++) for (let i = -9; i <= 9; i++) if (i * i + j * j <= 81 && i * i + j * j > 30) px(g, 'rgba(240,236,210,' + (.16 * ill).toFixed(2) + ')', x + i, y + j, 1, 1);
        for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { if (i * i + j * j > 28) continue; const lit = side * i / 5.3 > 1 - 2 * ill, sea = (i === -1 && j === -2) || (i === 1 && j === 1) || (i === -2 && j === 1) || (i === 2 && j === -1);
          px(g, lit ? (sea ? '#d2cbb0' : '#f4f0d8') : (sa < -4 ? 'rgba(70,78,118,.6)' : 'rgba(200,210,240,.15)'), x + i, y + j, 1, 1); }
        PXK.fill(g, 'Lune', x + 8, y + 3, '#f4f0d8', 1); shown.push('Lune'); continue; }
      if (sa > -3 && name !== 'Vénus') continue;  // en plein jour, seule Vénus perce
      const [c] = CI_LOOK[name];
      px(g, c, x, y, 2, 2); const a = c + '66'; px(g, a, x - 1, y, 1, 2); px(g, a, x + 2, y, 1, 2); px(g, a, x, y - 1, 2, 1); px(g, a, x, y + 2, 2, 1);
      if (name === 'Saturne') { px(g, c + 'aa', x - 2, y + 1, 1, 1); px(g, c + 'aa', x + 3, y, 1, 1); }
      PXK.fill(g, name, x + 5, y + 4, c, 1); shown.push(name); }
    if (iss) { const p = issLook(iss, t, lat, lon), q = p.alt > 0 && proj(p.alt, p.az); if (q) { const [x, y] = q.map(Math.round); if (tick % 30 < 22) { const c = p.lit ? '#ffffff' : '#5a6a9a'; px(g, c, x - 1, y, 3, 1); px(g, c, x, y - 1, 1, 3); } PXK.fill(g, 'ISS', x + 4, y + 4, '#d8e0ff', 1); shown.push('ISS'); } }
    g.drawImage(groundCv, 0, 0);
    PXK.fill(g, hm(t), 6, 11, '#ffffff', 1); PXK.fill(g, sa > -.8 ? 'jour' : sa > -15 ? (new Date(t).getHours() < 12 ? 'aube' : 'crépuscule') : 'nuit noire', 6, 22, '#b8c8ff', 1);
    PXK.fill(g, 'vers le ' + dir(vaz), W - 6, 11, '#ffffff', 1, 'right');
    if (tick % 30 === 0) g.canvas.setAttribute('aria-label', 'Ciel vers le ' + dir(vaz) + ' à ' + hm(t) + ' : ' + (shown.join(', ') || 'aucun astre dans cette direction') + '.');
  }
  {  // tourner la tête : glisser la vue (ou au doigt), flèches du clavier, boutons
    const cv = $('ciCanvas'); let drag = null;
    const turn = (da, dl = 0) => { vaz = rev(vaz + da); valt = clamp(valt + dl, 0, VMAX); };
    cv.onpointerdown = e => { drag = [e.clientX, e.clientY, vaz, valt]; try { cv.setPointerCapture(e.pointerId); } catch {} };
    cv.onpointermove = e => { if (!drag) return; const s = cv.getBoundingClientRect().width / W; vaz = rev(drag[2] - (e.clientX - drag[0]) / s / K); valt = clamp(drag[3] + (e.clientY - drag[1]) / s / K, 0, VMAX); };
    cv.onpointerup = cv.onpointercancel = () => { drag = null; };
    document.addEventListener('keydown', e => { if (!on() || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName)) return;
      const m = { ArrowLeft: [-15], ArrowRight: [15], ArrowUp: [0, 10], ArrowDown: [0, -10] }[e.key]; if (!m) return; e.preventDefault(); turn(...m); });
    $('ciLeft').onclick = () => turn(-45); $('ciRight').onclick = () => turn(45);
    $('ciLines').onclick = () => { lines = !lines; $('ciLines').classList.toggle('main', lines); };
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
    where(); $('ciNow').click(); aim(); bgKey = ''; renderList(); if (iss) { passes = findPasses(iss); renderIss(); }
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
    { const [l, b] = galactic(266.405, -28.936); if (Math.abs(l) > .3 || Math.abs(b) > .3) bad.push('centre de la Galaxie en ' + l.toFixed(1) + ', ' + b.toFixed(1)); }
    if (STARS.length !== 4086 || Math.abs(STARS[0].mag + 1.46) > .1) bad.push('catalogue : ' + STARS.length + ' étoiles, la plus brillante ' + STARS[0]?.mag);
    console.assert(!bad.length, 'ciel', bad); view.dataset.selfcheck = bad.join(' | ') || 'ok';
  }
  $('ciNow').click(); aim(); renderList(); loadIss();
  let raf = 0; const frame = () => { if (!on()) { raf = 0; return; } raf = requestAnimationFrame(frame); draw(); };
  ctx.onOpen(() => { g ??= $('ciCanvas').getContext('2d'); if (Date.now() > win[1]) { $('ciNow').click(); renderList(); } if (!raf) raf = requestAnimationFrame(frame); });
  $('ciCanvas').__state = () => ({ iss: !!iss, passes: passes.length, planets: $('ciPlanets').children.length });
}
