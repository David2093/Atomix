export function moleculeFallback(item) {
  if (!item?.atoms?.length) return '';
  const xs = item.atoms.map(atom => atom.position[0]);
  const ys = item.atoms.map(atom => atom.position[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  const scale = Math.min(180 / Math.max(maxX - minX, .8), 126 / Math.max(maxY - minY, .8));
  const points = item.atoms.map(atom => ({
    x: 200 + (atom.position[0] - centerX) * scale,
    y: 130 - (atom.position[1] - centerY) * scale,
    element: atom.element,
  }));
  const bonds = item.bonds.map(([from, to]) => {
    const start = points[from], end = points[to];
    return `<line class="fallback-bond" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" />`;
  }).join('');
  const atoms = points.map(point => {
    const radius = point.element === 'H' ? 17 : 26;
    const label = point.element;
    return `<g class="fallback-${label.toLowerCase()}"><circle cx="${point.x}" cy="${point.y}" r="${radius}" /><text x="${point.x}" y="${point.y + 5}">${label}</text></g>`;
  }).join('');
  return `<svg class="molecule-fallback" viewBox="0 0 400 260" aria-hidden="true">${bonds}${atoms}</svg>`;
}
