// lancé par le test « local » de NeoDex : vérification interne (dates connues, Galaxie, catalogue), la liste de la nuit, l'orbite de l'ISS, la vue qui suit l'heure et qui tourne
module.exports = async ({ pj, sleep }) => {
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
  return s.passes + ' passage(s) de l’ISS · ' + dusk + ' · ' + l;
};
