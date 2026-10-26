// Major moons. Periods and sizes follow NASA planetary fact sheets.
// Distances are compressed so each moon sits just outside its planet
// instead of overlapping the next planet's orbit.

export const MOONS = [
  { planet: "Earth", name: "Moon", km: 1737.4, planetKm: 6371, radii: 60.3, period: 27.3217, incl: 5.14, speed: 1.022, color: 0xd5d2cc, texture: "moon", phase: 0.6 },

  { planet: "Mars", name: "Phobos", km: 11.27, planetKm: 3389.5, radii: 2.76, period: 0.3189, incl: 1.09, speed: 2.138, color: 0x8a7e74, phase: 0.4 },
  { planet: "Mars", name: "Deimos", km: 6.2, planetKm: 3389.5, radii: 6.92, period: 1.263, incl: 1.79, speed: 1.351, color: 0xb1a394, phase: 2.1 },

  { planet: "Jupiter", name: "Io", km: 1821.6, planetKm: 69911, radii: 5.9, period: 1.7691, incl: 0.05, speed: 17.33, color: 0xe6c15a, texture: "io", phase: 0.2 },
  { planet: "Jupiter", name: "Europa", km: 1560.8, planetKm: 69911, radii: 9.4, period: 3.5512, incl: 0.47, speed: 13.74, color: 0xe8e4d8, texture: "europa", phase: 1.1 },
  { planet: "Jupiter", name: "Ganymede", km: 2634.1, planetKm: 69911, radii: 15.0, period: 7.1546, incl: 0.2, speed: 10.88, color: 0xb7a48a, phase: 2.4 },
  { planet: "Jupiter", name: "Callisto", km: 2410.3, planetKm: 69911, radii: 26.3, period: 16.689, incl: 0.19, speed: 8.2, color: 0x7a7066, phase: 4.2 },

  { planet: "Saturn", name: "Mimas", km: 198.2, planetKm: 58232, radii: 3.08, period: 0.942, incl: 1.57, speed: 14.28, color: 0xd8d2c7, phase: 0.5 },
  { planet: "Saturn", name: "Enceladus", km: 252.1, planetKm: 58232, radii: 3.95, period: 1.3702, incl: 0.01, speed: 12.63, color: 0xf7fbff, texture: "ice", phase: 1.3 },
  { planet: "Saturn", name: "Tethys", km: 531.1, planetKm: 58232, radii: 4.89, period: 1.8878, incl: 1.12, speed: 11.35, color: 0xe4e1da, phase: 2.2 },
  { planet: "Saturn", name: "Dione", km: 561.4, planetKm: 58232, radii: 6.26, period: 2.7369, incl: 0.02, speed: 10.03, color: 0xddd4c8, phase: 3.4 },
  { planet: "Saturn", name: "Rhea", km: 763.8, planetKm: 58232, radii: 8.74, period: 4.518, incl: 0.35, speed: 8.48, color: 0xd0cbc2, phase: 0.9 },
  { planet: "Saturn", name: "Titan", km: 2574.7, planetKm: 58232, radii: 20.27, period: 15.945, incl: 0.35, speed: 5.57, color: 0xe0a15a, texture: "titan", phase: 2.8 },
  { planet: "Saturn", name: "Iapetus", km: 734.5, planetKm: 58232, radii: 59.1, period: 79.322, incl: 15.47, speed: 3.26, color: 0x9c8d78, phase: 5.5 },

  { planet: "Uranus", name: "Miranda", km: 235.8, planetKm: 25362, radii: 5.08, period: 1.413, incl: 4.34, speed: 6.66, color: 0xc8c2ba, phase: 0.3 },
  { planet: "Uranus", name: "Ariel", km: 578.9, planetKm: 25362, radii: 7.47, period: 2.52, incl: 0.26, speed: 5.51, color: 0xd5d0c8, phase: 1.7 },
  { planet: "Uranus", name: "Umbriel", km: 584.7, planetKm: 25362, radii: 10.4, period: 4.144, incl: 0.13, speed: 4.67, color: 0x8f8a84, phase: 3.1 },
  { planet: "Uranus", name: "Titania", km: 788.9, planetKm: 25362, radii: 17.07, period: 8.706, incl: 0.08, speed: 3.64, color: 0xc2bbb2, phase: 4.4 },
  { planet: "Uranus", name: "Oberon", km: 761.4, planetKm: 25362, radii: 22.83, period: 13.463, incl: 0.07, speed: 3.15, color: 0xb3aaa0, phase: 0.8 },

  { planet: "Neptune", name: "Proteus", km: 210, planetKm: 24622, radii: 4.75, period: 1.122, incl: 0.52, speed: 7.62, color: 0x8a847c, phase: 1.5 },
  { planet: "Neptune", name: "Triton", km: 1353.4, planetKm: 24622, radii: 14.33, period: 5.8769, incl: 157, speed: 4.39, color: 0xe4cfc6, texture: "triton", phase: 2.6, retrograde: true },

  { planet: "Pluto", name: "Charon", km: 606, planetKm: 1188, radii: 16.5, period: 6.387, incl: 0.08, speed: 0.21, color: 0xc8beb4, phase: 1.1 },
  { planet: "Pluto", name: "Nix", km: 25, planetKm: 1188, radii: 41, period: 24.85, incl: 0.13, speed: 0.11, color: 0xb7b2aa, phase: 0.4 },
  { planet: "Pluto", name: "Hydra", km: 26, planetKm: 1188, radii: 54.5, period: 38.2, incl: 0.24, speed: 0.09, color: 0xa9a49c, phase: 2.2 },
];

export function moonOrbitDistance(planetRadius, radii) {
  return planetRadius * (1.9 + Math.sqrt(radii) * 0.4);
}

export function moonBodyRadius(planetRadius, km, planetKm) {
  const scaled = planetRadius * Math.sqrt(km / planetKm) * 0.9;
  return Math.min(planetRadius * 0.4, Math.max(0.05, scaled));
}
