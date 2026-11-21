// Premios a elegir (plan Premium): además del premio principal, el negocio arma un menú.
// Ej. con 50 puntos un café, con 100 un postre y con 200 (la meta) un platillo.
// El cliente canjea el que quiera en cuanto le alcance; se descuenta el costo de ese premio.
const crypto = require('crypto');

function isPremium(b) { return (b.plan || 'esencial') === 'premium'; }
function isWallet(b) { return Boolean(b) && b.mechanic === 'puntos' && Number(b.wallet_pct) > 0; }
function goalOf(b) { return b.mechanic === 'sellos' ? Number(b.stamps_goal) : Number(b.points_goal); }

function parseRewards(raw) {
  let v = [];
  try { v = JSON.parse(raw || '[]'); } catch (e) { v = []; }
  return Array.isArray(v) ? v.filter(x => x && typeof x.name === 'string' && Number(x.cost) > 0) : [];
}

// Limpia lo que manda la pantalla: máximo 8 premios extra, sin repetir costo ni nombre.
// En sellos el costo debe ser menor que la meta (la meta es el premio principal).
function cleanRewards(input, business) {
  if (!Array.isArray(input)) return { error: 'Lista de premios inválida.' };
  const goal = goalOf(business);
  const max = business.mechanic === 'sellos' ? goal - 1 : 100000;
  const out = [], names = new Set(), costs = new Set([goal]);
  for (const item of input.slice(0, 8)) {
    const name = String(item && item.name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const cost = Math.round(Number(item && item.cost));
    if (!name) continue;
    if (!(cost >= 1 && cost <= max)) {
      return { error: business.mechanic === 'sellos'
        ? `"${name}": los sellos deben ser de 1 a ${max} (con ${goal} se gana el premio principal).`
        : `"${name}": los puntos deben ser 1 o más.` };
    }
    if (names.has(name.toLowerCase())) return { error: `"${name}" está repetido.` };
    if (costs.has(cost)) return { error: `Ya hay un premio de ${cost} ${business.mechanic === 'sellos' ? 'sellos' : 'puntos'}. Usa otro número.` };
    names.add(name.toLowerCase()); costs.add(cost);
    const id = /^[a-z0-9]{6,12}$/.test(String(item.id || '')) ? item.id : crypto.randomBytes(4).toString('hex');
    out.push({ id, name, cost });
  }
  out.sort((a, b) => a.cost - b.cost);
  return { rewards: out };
}

// Menú completo (extras + premio principal en la meta). Vacío si no aplica: Esencial, Monedero o sin extras.
function rewardMenu(business) {
  if (!business || !isPremium(business) || isWallet(business)) return [];
  const extras = parseRewards(business.rewards);
  if (!extras.length) return [];
  const goal = goalOf(business);
  return [...extras.filter(r => r.cost !== goal), { id: 'main', name: business.reward_desc, cost: goal, main: true }]
    .sort((a, b) => a.cost - b.cost);
}

// Con cuántos sellos o puntos ya puede canjear algo.
function firstRewardAt(business) {
  const menu = rewardMenu(business);
  return menu.length ? menu[0].cost : goalOf(business);
}

module.exports = { parseRewards, cleanRewards, rewardMenu, firstRewardAt };
