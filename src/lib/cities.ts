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
  ["Seattle, WA", 47.6062, -122.3321], ["Portland, OR", 45.5152, -122.6784], ["San Francisco, CA", 37.7749, -122.4194], ["Oakland, CA", 37.8044, -122.2712],
  ["Los Angeles, CA", 34.0522, -118.2437], ["San Diego, CA", 32.7157, -117.1611], ["Sacramento, CA", 38.5816, -121.4944], ["Las Vegas, NV", 36.1699, -115.1398],
  ["Phoenix, AZ", 33.4484, -112.074], ["Tucson, AZ", 32.2226, -110.9747], ["Salt Lake City, UT", 40.7608, -111.891], ["Boise, ID", 43.615, -116.2023],
  ["Albuquerque, NM", 35.0844, -106.6504], ["El Paso, TX", 31.7619, -106.485], ["San Antonio, TX", 29.4241, -98.4936], ["Milwaukee, WI", 43.0389, -87.9065],
  ["Madison, WI", 43.0731, -89.4012], ["Detroit, MI", 42.3314, -83.0458], ["Ann Arbor, MI", 42.2808, -83.743], ["Grand Rapids, MI", 42.9634, -85.6681],
  ["Columbus, OH", 39.9612, -82.9988], ["Cleveland, OH", 41.4993, -81.6944], ["Cincinnati, OH", 39.1031, -84.512], ["Pittsburgh, PA", 40.4406, -79.9959],
  ["Philadelphia, PA", 39.9526, -75.1652], ["New York, NY", 40.7128, -74.006], ["Brooklyn, NY", 40.6782, -73.9442], ["Boston, MA", 42.3601, -71.0589],
  ["Providence, RI", 41.824, -71.4128], ["Burlington, VT", 44.4759, -73.2121], ["Portland, ME", 43.6591, -70.2568], ["Albany, NY", 42.6526, -73.7562],
  ["Buffalo, NY", 42.8864, -78.8784], ["Washington, DC", 38.9072, -77.0369], ["Baltimore, MD", 39.2904, -76.6122], ["Richmond, VA", 37.5407, -77.436],
  ["Raleigh, NC", 35.7796, -78.6382], ["Durham, NC", 35.994, -78.8986], ["Charleston, SC", 32.7765, -79.9311], ["Savannah, GA", 32.0809, -81.0912],
  ["Jacksonville, FL", 30.3322, -81.6557], ["Orlando, FL", 28.5383, -81.3792], ["Tampa, FL", 27.9506, -82.4572], ["Miami, FL", 25.7617, -80.1918],
  ["Little Rock, AR", 34.7465, -92.2896], ["Fayetteville, AR", 36.0626, -94.1574], ["Missoula, MT", 46.8721, -113.994], ["Boulder, CO", 40.015, -105.2705],
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

/** Look up a city by name ("Omaha", "omaha, ne"). */
export function findCity(name: string) {
  const q = name.trim().toLowerCase();
  if (!q) return undefined;
  const hit = CITIES.find((c) => c[0].toLowerCase() === q) ?? CITIES.find((c) => c[0].toLowerCase().startsWith(q.split(",")[0].trim()));
  return hit ? { city: hit[0], lat: hit[1], lng: hit[2] } : undefined;
}
