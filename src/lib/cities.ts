/** Small gazetteer used to name heatmap hotspots. */
export const CITIES = [
  ["Lawrence, KS", 38.9717, -95.2353], ["Kansas City, MO", 39.0997, -94.5786], ["Topeka, KS", 39.0473, -95.6752], ["Wichita, KS", 37.6872, -97.3301],
  ["Omaha, NE", 41.2565, -95.9345], ["Lincoln, NE", 40.8136, -96.7026], ["Des Moines, IA", 41.5868, -93.625], ["Iowa City, IA", 41.6611, -91.5302],
  ["Columbia, MO", 38.9517, -92.3341], ["St. Louis, MO", 38.627, -90.1994], ["Springfield, MO", 37.209, -93.2923], ["Tulsa, OK", 36.154, -95.9928],
  ["Oklahoma City, OK", 35.4676, -97.5164], ["Denver, CO", 39.7392, -104.9903], ["Minneapolis, MN", 44.9778, -93.265], ["Chicago, IL", 41.8781, -87.6298],
  ["Nashville, TN", 36.1627, -86.7816], ["Memphis, TN", 35.1495, -90.049], ["Louisville, KY", 38.2527, -85.7585], ["Indianapolis, IN", 39.7684, -86.1581],
  ["Austin, TX", 30.2672, -97.7431], ["Dallas, TX", 32.7767, -96.797], ["Houston, TX", 29.7604, -95.3698], ["Atlanta, GA", 33.749, -84.388],
  ["Athens, GA", 33.9519, -83.3576], ["Birmingham, AL", 33.5186, -86.8104], ["New Orleans, LA", 29.9511, -90.0715], ["Charlotte, NC", 35.2271, -80.8431],
  ["Asheville, NC", 35.5951, -82.5515], ["Knoxville, TN", 35.9606, -83.9207], ["Chattanooga, TN", 35.0456, -85.3097], ["Lexington, KY", 38.0406, -84.5037],
] as const;

export function nearestCity(lat: number, lng: number) {
  let best: (typeof CITIES)[number] = CITIES[0];
  let d = Infinity;
  for (const c of CITIES) {
    const dd = (c[1] - lat) ** 2 + (c[2] - lng) ** 2;
    if (dd < d) { d = dd; best = c; }
  }
  return { city: best[0], lat: best[1], lng: best[2], distance: Math.sqrt(d) };
}
