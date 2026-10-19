/**
 * Qloo resolves `signal.location.query` and `filter.location.query` by name, and two-letter state codes
 * are read loosely: on the hackathon server "Lawrence, KS" resolved to a Toronto neighborhood and
 * "Richmond, VA" to Staten Island, while "Lawrence, Kansas" and "Richmond, Virginia" resolve correctly.
 * So a trailing US state code is spelled out before it is sent. Anything else passes through unchanged.
 */
const STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

export function qlooLocation(city: string | undefined) {
  if (!city) return city;
  const m = city.trim().match(/^(.+?),?\s+([A-Za-z]{2})$/);
  const state = m ? STATES[m[2].toUpperCase()] : undefined;
  return m && state ? `${m[1].replace(/,$/, "").trim()}, ${state}` : city.trim();
}
