import { getTimeZone } from './get-time-zones.js';

interface TimeZoneFormatData {
  alternativeName: string;
  mainCities: string[];
  rawOffsetInMinutes: number;
  currentTimeOffsetInMinutes?: number;
}

interface FormatOptions {
  useCurrentOffset?: boolean;
}

export function formatTimeZone(
  timeZone: TimeZoneFormatData,
  options: FormatOptions = {},
): string {
  const {
    alternativeName,
    mainCities,
    rawOffsetInMinutes,
    currentTimeOffsetInMinutes,
  } = timeZone;
  const { useCurrentOffset = false } = options;

  const offsetInHours =
    useCurrentOffset && currentTimeOffsetInMinutes !== undefined
      ? getOffsetString(currentTimeOffsetInMinutes)
      : getOffsetString(rawOffsetInMinutes);

  return `${offsetInHours.padStart(
    6,
    '+',
  )} ${alternativeName} - ${mainCities.join(', ')}`;
}

export function getOffsetString(offsetInMinutes: number): string {
  const absOffsetInMinutes = Math.abs(offsetInMinutes);
  const [hours, minutes] = [
    Math.floor(absOffsetInMinutes / 60),
    absOffsetInMinutes % 60,
  ].map((v) => {
    return v.toString().padStart(2, '0');
  });
  const durationInHoursMinutes = `${hours}:${minutes}`;
  return `${offsetInMinutes >= 0 ? '+' : '-'}${durationInHoursMinutes}`;
}

export function formatTimeZoneDisplay(
  timezoneName: string,
  options: {
    includeDST?: boolean;
    formatType?: 'full' | 'utc' | 'simple';
  } = {},
): string {
  const { includeDST = true, formatType = 'utc' } = options;

  const tz = getTimeZone(timezoneName);
  if (!tz) {
    return timezoneName; // Return the original string if timezone not found
  }

  const standardOffset = getOffsetString(tz.rawOffsetInMinutes);
  const hasDST = tz.dstAbbreviation !== undefined && includeDST;

  if (formatType === 'utc') {
    if (hasDST) {
      // DST is typically +1 hour from standard time
      const dstOffsetMinutes = tz.rawOffsetInMinutes + 60;
      const dstOffset = getOffsetString(dstOffsetMinutes);
      return `${tz.alternativeName} (UTC${standardOffset}/UTC${dstOffset})`;
    }
    return `${tz.alternativeName} (UTC${standardOffset})`;
  }

  if (formatType === 'simple') {
    if (hasDST) {
      const dstOffsetMinutes = tz.rawOffsetInMinutes + 60;
      const dstOffset = getOffsetString(dstOffsetMinutes);
      return `${tz.alternativeName} (${standardOffset}/${dstOffset})`;
    }
    return `${tz.alternativeName} (${standardOffset})`;
  }

  // Default 'full' format - uses your existing formatTimeZone function
  return formatTimeZone(tz, { useCurrentOffset: false });
}
