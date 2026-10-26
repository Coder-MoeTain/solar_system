import { EPOCH_MS, YEAR } from "./ephemeris.js";

export function simDaysFromIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return (Date.UTC(y, m - 1, d) - EPOCH_MS) / 86400000;
}

export function isoFromSimDays(simDays) {
  const date = new Date(EPOCH_MS + simDays * 86400000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const EVENTS = [
  { name: "Solstice", iso: "2026-12-21", focus: "Earth" },
  { name: "Mars opposition", iso: "2027-02-19", focus: "Mars" },
  { name: "Equinox", iso: "2027-03-20", focus: "Earth" },
  { name: "Juno arrives", iso: "2016-07-05", focus: "Jupiter" },
  { name: "Voyager 1 crosses", iso: "2012-08-25", focus: "Voyager 1" },
  { name: "Voyager 2 crosses", iso: "2018-11-05", focus: "Voyager 2" },
  { name: "Pluto perihelion", iso: "1989-09-05", focus: "Pluto" },
  { name: "Halley returns", iso: "2061-07-28", focus: "Halley" },
];

export const TOURS = [
  {
    id: "year",
    name: "One Earth year",
    steps: [
      {
        t: 0,
        focus: "Earth",
        space: true,
        dps: YEAR / 12,
        trail: 1.5,
        lesson: "One Earth year is starting. Watch the trail close into a single turn of the helix.",
      },
      {
        t: 12,
        lesson: "That turn is one year. The outer planets have moved only a slice of their own orbits.",
      },
    ],
  },
  {
    id: "venus",
    name: "Venus",
    steps: [
      {
        t: 0,
        focus: "Venus",
        space: false,
        dps: 30,
        trail: 1,
        lesson: "A year on Venus is 225 Earth days. Its day is longer, 243 Earth days, and it spins backward, so the Sun rises in the west.",
      },
      {
        t: 8,
        lesson: "The orbit is closing. Venus is nearly round and only slightly tilted, yet the long backward day is the strange part.",
      },
    ],
  },
  {
    id: "moons",
    name: "Galilean moons",
    steps: [
      {
        t: 0,
        focus: "Jupiter",
        space: false,
        dps: 2,
        lesson: "Io goes around Jupiter in 1.8 days. Europa takes 3.6, Ganymede 7.2, and Callisto 16.7.",
      },
      {
        t: 6,
        lesson: "Count Io. It should lap Europa about twice, and Ganymede about four times. That rhythm is the Laplace resonance.",
      },
    ],
  },
  {
    id: "voyage",
    name: "Out to the galaxy",
    steps: [
      {
        t: 0,
        focus: "Neptune",
        space: true,
        lesson: "Neptune is the last planet. The solar wind still blows past it.",
      },
      {
        t: 5,
        focus: "Heliopause",
        lesson: "This faint shell is the heliopause, about 120 AU out, where the solar wind gives way.",
      },
      {
        t: 10,
        focus: "Voyager 1",
        lesson: "Voyager 1 crossed that boundary in 2012. It is the farthest thing humans have built.",
      },
      {
        t: 15,
        focus: "Milky Way",
        lesson: "All of that sits in the Orion Spur of the Milky Way. You are looking down on the disk.",
      },
    ],
  },
  {
    id: "scale",
    name: "True Sun motion",
    steps: [
      {
        t: 0,
        focus: "Earth",
        space: true,
        motion: 100,
        dps: YEAR / 8,
        trail: 2,
        lesson: "This is the Sun’s real motion, about 46 AU per Earth year. The helix stretches because Earth keeps orbiting while the Sun advances.",
      },
      {
        t: 8,
        motion: 8,
        lesson: "The usual view draws that motion at 8% so the spiral stays readable. The distance in the card is still the true one.",
      },
    ],
  },
];
