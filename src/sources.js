// "¿Cómo nos conociste?": la pregunta de un toque que el cliente contesta al crear su tarjeta.
// Con esto el negocio sabe qué le trae clientes: la calle, las recomendaciones, sus redes, Google…
const SOURCES = {
  calle: 'Pasó por el negocio',
  recomendacion: 'Se lo recomendaron',
  redes: 'Redes sociales',
  google: 'Google o Maps',
  cliente: 'Ya era cliente',
  otro: 'Otro'
};
const NETWORKS = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', whatsapp: 'WhatsApp' };

// Devuelve { source, detail } limpio, o null si no es una respuesta válida.
function cleanSource(source, detail) {
  const s = String(source || '').trim().toLowerCase();
  if (!SOURCES[s]) return null;
  let d = String(detail || '').trim();
  if (s === 'redes') d = NETWORKS[d.toLowerCase()] ? d.toLowerCase() : '';
  else if (s === 'otro') d = d.replace(/\s+/g, ' ').slice(0, 40);
  else d = '';
  return { source: s, detail: d || null };
}

// Texto para el dueño y para el CSV: "Redes sociales (Instagram)".
function sourceText(source, detail) {
  if (!SOURCES[source]) return '';
  if (source === 'redes' && NETWORKS[detail]) return `${SOURCES.redes} (${NETWORKS[detail]})`;
  if (source === 'otro' && detail) return `Otro: ${detail}`;
  return SOURCES[source];
}

module.exports = { SOURCES, NETWORKS, cleanSource, sourceText };
