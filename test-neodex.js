// lancé par le test « local » de NeoDex : vérification interne (dates connues, Galaxie, catalogue), la liste de la nuit, l'orbite de l'ISS, la vue qui suit l'heure et qui tourne
module.exports = async ({ pj, sleep, shot }) => {
  const sc = await pj(`document.querySelector('[data-selfcheck]')?.dataset.selfcheck`); if (sc !== 'ok') throw new Error('vérification interne : ' + sc);
  let s; for (let i = 0; i < 20; i++) { await sleep(500); s = await pj(`document.getElementById('ciCanvas').__state()`); if (s.iss) break; }
  if (!s.iss) throw new Error('orbite de l’ISS pas chargée');
  if (s.planets < 2) throw new Error('liste de la nuit vide');
  const at = async v => { await pj(`(() => { const r = document.getElementById('ciT'); r.value = ${v}; r.dispatchEvent(new Event('input')); })(), 0`); await sleep(900); return pj(`document.getElementById('ciCanvas').getAttribute('aria-label')`); };
  const dusk = await at(30), before = await pj(`document.getElementById('ciCanvas').toDataURL().length`);
  await pj(`document.getElementById('ciRight').click(), 0`); await sleep(900);
  const turned = await pj(`document.getElementById('ciCanvas').getAttribute('aria-label')`);
  if (turned.split(' à ')[0] === dusk.split(' à ')[0]) throw new Error('la vue n’a pas tourné : ' + turned);
  await pj(`document.getElementById('ciLeft').click(), 0`); const l = await at(180);
  if (before < 20000) throw new Error('ciel presque vide');
  // la colonne de droite : le plus beau d'abord ; un clic sur la première ligne ouvre sa fiche
  const top = await pj(`(() => { const d = document.querySelector('.ciItem.top'); if (!d) return null; d.click(); return [d.querySelector('b').textContent, document.getElementById('ciInfo').hidden, document.getElementById('ciInfoT').textContent]; })()`);
  if (!top) throw new Error('pas de « à voir en premier »');
  if (top[1] || top[2] !== top[0].toUpperCase()) throw new Error('fiche de la première ligne : ' + JSON.stringify(top));
  // un clic dans la vue sur une constellation ouvre sa fiche
  const clickAt = xy => pj(`(() => { const c = document.getElementById('ciCanvas'), o = { clientX: ${xy[0]}, clientY: ${xy[1]}, pointerId: 1, bubbles: true }; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); return document.getElementById('ciInfoT').textContent; })()`);
  let got = null;
  for (const n of await pj(`document.getElementById('ciCanvas').__consts()`)) {
    await pj(`(() => { const r = document.getElementById('ciT'); r.value = 500; r.dispatchEvent(new Event('input')); })(), 0`);
    for (let k = 0; k < 8 && !got; k++) { const xy = await pj(`document.getElementById('ciCanvas').__at('const', ${JSON.stringify(n)})`); if (xy && (await clickAt(xy)) === n.toUpperCase()) got = n; else await pj(`document.getElementById('ciRight').click(), 0`); }
    if (got) break;
  }
  if (!got) throw new Error('aucune constellation trouvée au clic');
  // les alertes de l'ISS : un passage inventé dans 8 min ; prévenu une seule fois, pas trop tôt, et seulement pour les passages choisis
  const T0 = Date.now(), fake = [{ start: T0 + 8 * 60000, end: T0 + 14 * 60000, az0: 225, az1: 45, max: 62 }, { start: T0 + 9 * 60000, end: T0 + 12 * 60000, az0: 270, az1: 0, max: 18 }];
  await pj(`document.getElementById('ciCanvas').__alertSet({ on: true, lead: 5, min: 30 })`);
  const early = await pj(`document.getElementById('ciCanvas').__alerts(${T0}, ${JSON.stringify(fake)})`);
  const due = await pj(`document.getElementById('ciCanvas').__alerts(${T0 + 4 * 60000}, ${JSON.stringify(fake)})`);
  const again = await pj(`document.getElementById('ciCanvas').__alerts(${T0 + 5 * 60000}, ${JSON.stringify(fake)})`);
  if (early.n !== 0 || due.n !== 1 || again.n !== 0 || !/dans 4 min/.test(due.got[0]?.title) || !/sud-ouest.*nord-est.*62°.*6 min/.test(due.got[0]?.body)) throw new Error('alertes ISS : ' + JSON.stringify({ early, due, again }));
  const hint = await pj(`document.getElementById('ciAlHint').textContent`);
  await pj(`document.getElementById('ciAlOn').closest('.sysCard').scrollIntoView({ block: 'center' }), 0`); await sleep(300); if (shot) await shot('iss');
  await pj(`document.getElementById('ciCanvas').__alertSet({ on: false, lead: 10, min: 10 })`);  // le profil de test reste comme avant
  await sleep(900);
  return s.passes + ' passage(s) de l’ISS · ' + dusk + ' · ' + l + ' · en premier : ' + top[0] + ' · fiche : ' + got + ' · alerte ISS : « ' + due.got[0].title + ' » (une fois, pas trop tôt, pas pour un passage bas) · ' + hint;
};
