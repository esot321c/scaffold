import rawTimeZones from './timezone-data/raw-timezones.json' with { type: 'json' };
import { formatTimeZone } from './format-time-zone.js';
import { getZoneOffset } from './utils/time-zone.js';

export interface TimeZoneOptions {
  includeUtc?: boolean;
}

export interface RawTimeZone {
  name: string;
  alternativeName: string;
  abbreviation: string;
  group: string[];
  countryName: string;
  continentCode: string;
  continentName: string;
  mainCities: string[];
  rawOffsetInMinutes: number;
  rawFormat: string;
  dstAbbreviation?: string;
}

export interface TimeZone extends RawTimeZone {
  currentTimeOffsetInMinutes: number;
  currentTimeFormat: string;
  isDst?: boolean;
}

const utcTimezone: TimeZone = {
  name: 'Etc/UTC',
  alternativeName: 'Coordinated Universal Time (UTC)',
  abbreviation: 'UTC',
  group: ['Etc/UTC', 'Etc/UCT', 'UCT', 'UTC', 'Universal', 'Zulu'],
  countryName: '',
  continentCode: '',
  continentName: '',
  mainCities: [''],
  rawOffsetInMinutes: 0,
  rawFormat: '+00:00 Coordinated Universal Time (UTC)',
  currentTimeOffsetInMinutes: 0,
  currentTimeFormat: '+00:00 Coordinated Universal Time (UTC)',
};

export default function getTimeZones(opts?: TimeZoneOptions): TimeZone[] {
  const includeUtc = !!opts?.includeUtc;

  return rawTimeZones
    .reduce<TimeZone[]>(
      (acc, timeZone) => {
        const timeZoneName = timeZone.name;
        const currentOffset = getZoneOffset(timeZoneName);

        // Skip if environment doesn't recognize this timezone
        if (currentOffset === false) {
          return acc;
        }

        const timeZoneWithCurrentTimeData = {
          ...timeZone,
          currentTimeOffsetInMinutes: currentOffset,
        };

        const isDst = currentOffset !== timeZone.rawOffsetInMinutes;

        acc.push({
          ...timeZoneWithCurrentTimeData,
          isDst,
          currentTimeFormat: formatTimeZone(timeZoneWithCurrentTimeData, {
            useCurrentOffset: true,
          }),
        });

        return acc;
      },
      includeUtc ? [utcTimezone] : [],
    )
    .sort((a, b) => {
      return (
        compareNumbers(
          a.currentTimeOffsetInMinutes,
          b.currentTimeOffsetInMinutes,
        ) ||
        compareStrings(a.alternativeName, b.alternativeName) ||
        compareStrings(a.mainCities[0] ?? '', b.mainCities[0] ?? '')
      );
    });
}

function compareNumbers(x: number, y: number): number {
  return x - y;
}

function compareStrings(x: string, y: string): number {
  if (typeof x === 'string' && typeof y === 'string') {
    return x.localeCompare(y);
  }
  return 0;
}

let timeZoneMap: Map<string, RawTimeZone> | null = null;

export function getTimeZoneMap(): Map<string, RawTimeZone> {
  if (!timeZoneMap) {
    try {
      timeZoneMap = new Map<string, RawTimeZone>();

      for (const tz of rawTimeZones) {
        timeZoneMap.set(tz.name || '', tz);
      }
    } catch (error) {
      console.error('Error parsing timezone data:', error);
      return new Map<string, RawTimeZone>();
    }
  }

  return timeZoneMap;
}

export function getTimeZone(timezoneName: string): RawTimeZone | undefined {
  const map = getTimeZoneMap();
  return map.get(timezoneName);
}
