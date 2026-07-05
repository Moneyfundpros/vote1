/**
 * Nigeria geo reference data: 6 geopolitical zones + 36 states + FCT.
 * LGAs (774) are loaded separately from a bulk data import (see scripts/import-lgas).
 * Codes follow ISO 3166-2:NG (NG-XX) with synthetic zone codes (NG-Z-XX).
 */

export interface RegionSeed {
  code: string;
  name: string;
  level: 'zone' | 'state' | 'lga' | 'ward';
  parentCode: string | null;
}

export const ZONES: RegionSeed[] = [
  { code: 'NG-Z-NC', name: 'North Central', level: 'zone', parentCode: null },
  { code: 'NG-Z-NE', name: 'North East', level: 'zone', parentCode: null },
  { code: 'NG-Z-NW', name: 'North West', level: 'zone', parentCode: null },
  { code: 'NG-Z-SE', name: 'South East', level: 'zone', parentCode: null },
  { code: 'NG-Z-SS', name: 'South South', level: 'zone', parentCode: null },
  { code: 'NG-Z-SW', name: 'South West', level: 'zone', parentCode: null },
];

export const STATES: RegionSeed[] = [
  // North Central
  ['NG-BE', 'Benue', 'NC'],
  ['NG-KO', 'Kogi', 'NC'],
  ['NG-KW', 'Kwara', 'NC'],
  ['NG-NA', 'Nasarawa', 'NC'],
  ['NG-NI', 'Niger', 'NC'],
  ['NG-PL', 'Plateau', 'NC'],
  ['NG-FC', 'Federal Capital Territory', 'NC'],
  // North East
  ['NG-AD', 'Adamawa', 'NE'],
  ['NG-BA', 'Bauchi', 'NE'],
  ['NG-BO', 'Borno', 'NE'],
  ['NG-GO', 'Gombe', 'NE'],
  ['NG-TA', 'Taraba', 'NE'],
  ['NG-YO', 'Yobe', 'NE'],
  // North West
  ['NG-JI', 'Jigawa', 'NW'],
  ['NG-KD', 'Kaduna', 'NW'],
  ['NG-KN', 'Kano', 'NW'],
  ['NG-KT', 'Katsina', 'NW'],
  ['NG-KE', 'Kebbi', 'NW'],
  ['NG-SO', 'Sokoto', 'NW'],
  ['NG-ZA', 'Zamfara', 'NW'],
  // South East
  ['NG-AB', 'Abia', 'SE'],
  ['NG-AN', 'Anambra', 'SE'],
  ['NG-EB', 'Ebonyi', 'SE'],
  ['NG-EN', 'Enugu', 'SE'],
  ['NG-IM', 'Imo', 'SE'],
  // South South
  ['NG-AK', 'Akwa Ibom', 'SS'],
  ['NG-BY', 'Bayelsa', 'SS'],
  ['NG-CR', 'Cross River', 'SS'],
  ['NG-DE', 'Delta', 'SS'],
  ['NG-ED', 'Edo', 'SS'],
  ['NG-RI', 'Rivers', 'SS'],
  // South West
  ['NG-EK', 'Ekiti', 'SW'],
  ['NG-LA', 'Lagos', 'SW'],
  ['NG-OG', 'Ogun', 'SW'],
  ['NG-ON', 'Ondo', 'SW'],
  ['NG-OS', 'Osun', 'SW'],
  ['NG-OY', 'Oyo', 'SW'],
].map(([code, name, zone]) => ({
  code: code as string,
  name: name as string,
  level: 'state' as const,
  parentCode: `NG-Z-${zone}`,
}));

export const ALL_REGIONS: RegionSeed[] = [...ZONES, ...STATES];
