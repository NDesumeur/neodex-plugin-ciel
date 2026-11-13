// lancé par le test « local » de NeoDex : vérification interne (dates connues), la liste de la nuit, l'orbite de l'ISS chargée, la carte qui suit le curseur d'heure
module.exports = async ({ pj, sleep }) => {
  const sc = await pj(`document.querySelector('[data-selfcheck]')?.dataset.selfcheck`); if (sc !== 'ok') throw new Error('vérification interne : ' + sc);
  let s; for (let i = 0; i < 20; i++) { await sleep(500); s = await pj(`document.getElementById('ciCanvas').__state()`); if (s.iss) break; }
  if (!s.iss) throw new Error('orbite de l’ISS pas chargée');
  if (s.planets < 2) throw new Error('liste de la nuit vide');
  await pj(`(() => { const r = document.getElementById('ciT'); r.value = 500; r.dispatchEvent(new Event('input')); })(), 0`); await sleep(700);
  const l = await pj(`document.getElementById('ciCanvas').getAttribute('aria-label')`);
  return s.passes + ' passage(s) de l’ISS, ' + l;
};
