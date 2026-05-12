const DATE_LOCALE = 'es-MX';
const MAINTENANCE_TIME_ZONE = import.meta.env.VITE_MAINTENANCE_TIMEZONE || 'America/Mazatlan';

const toValidDate = (value) => {
  if (!value) return null;

  // `YYYY-MM-DD` debe interpretarse como fecha local (sin desfase UTC).
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      // Mediodia evita brincos de fecha al formatear en otra zona horaria.
      const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDatePartsInMaintenanceTimeZone = (value) => {
  const date = toValidDate(value);
  if (!date) return null;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MAINTENANCE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  if (!lookup.year || !lookup.month || !lookup.day || !lookup.hour || !lookup.minute) {
    return null;
  }

  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
    hour: lookup.hour,
    minute: lookup.minute
  };
};

export const formatMaintenanceDate = (
  value,
  {
    fallback = '-',
    month = 'short',
    withWeekday = false
  } = {}
) => {
  const date = toValidDate(value);
  if (!date) return fallback;

  return date.toLocaleDateString(DATE_LOCALE, {
    ...(withWeekday ? { weekday: 'long' } : {}),
    day: '2-digit',
    month,
    year: 'numeric',
    timeZone: MAINTENANCE_TIME_ZONE
  });
};

export const formatMaintenanceTime = (
  value,
  { fallback = '-' } = {}
) => {
  const date = toValidDate(value);
  if (!date) return fallback;

  return date.toLocaleTimeString(DATE_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: MAINTENANCE_TIME_ZONE
  });
};

export const formatMaintenanceDateTime = (
  value,
  {
    fallback = '-',
    month = 'short',
    withWeekday = false
  } = {}
) => {
  const date = toValidDate(value);
  if (!date) return fallback;

  return date.toLocaleString(DATE_LOCALE, {
    ...(withWeekday ? { weekday: 'long' } : {}),
    day: '2-digit',
    month,
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: MAINTENANCE_TIME_ZONE
  });
};

export const toMaintenanceDateInputValue = (value, fallback = '') => {
  const parts = getDatePartsInMaintenanceTimeZone(value);
  if (!parts) return fallback;
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const toMaintenanceTimeInputValue = (value, fallback = '09:00') => {
  const parts = getDatePartsInMaintenanceTimeZone(value);
  if (!parts) return fallback;
  return `${parts.hour}:${parts.minute}`;
};

