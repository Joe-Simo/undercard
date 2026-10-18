import type { ShowInput } from "../types";

/**
 * Fixed Gut vs Graph cases: real headliners, real cities, real room sizes, chosen before any run
 * and never edited after seeing results. Inputs only; no Qloo data lives in this file.
 */
export const CASES: ShowInput[] = [
  { headliner: "Japanese Breakfast", city: "Lawrence, KS", capacity: 1000 },
  { headliner: "Khruangbin", city: "Nashville, TN", capacity: 2500 },
  { headliner: "Wednesday", city: "Asheville, NC", capacity: 350 },
  { headliner: "Phoebe Bridgers", city: "Denver, CO", capacity: 600 },
  { headliner: "Big Thief", city: "Omaha, NE", capacity: 800 },
  { headliner: "Turnstile", city: "Richmond, VA", capacity: 1500 },
  { headliner: "Mitski", city: "Tucson, AZ", capacity: 450 },
  { headliner: "Waxahatchee", city: "Birmingham, AL", capacity: 500 },
  { headliner: "Alvvays", city: "Madison, WI", capacity: 900 },
  { headliner: "Tyler Childers", city: "Lexington, KY", capacity: 3000 },
  { headliner: "Snail Mail", city: "Baltimore, MD", capacity: 300 },
  { headliner: "Black Pumas", city: "San Antonio, TX", capacity: 1800 },
];
