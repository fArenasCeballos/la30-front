export const SHIFT_START_HOUR = 12; // 12 PM (Mediodía)

/**
 * Obtiene el inicio del turno para una fecha dada (por defecto ahora).
 * Si la hora actual es antes de las 12:00, el turno empezó ayer a las 12:00.
 * Si la hora actual es >= 12:00, el turno empezó hoy a las 12:00.
 */
export function getShiftStart(date = new Date()): Date {
  const currentHour = date.getHours();
  const shiftStart = new Date(date);

  if (currentHour < SHIFT_START_HOUR) {
    // Antes de las 12 PM -> el turno empezó ayer a las 12 PM
    shiftStart.setDate(shiftStart.getDate() - 1);
  }

  shiftStart.setHours(SHIFT_START_HOUR, 0, 0, 0);
  return shiftStart;
}

/**
 * Obtiene el fin del turno (24 horas después del inicio).
 */
export function getShiftEnd(date = new Date()): Date {
  const shiftStart = getShiftStart(date);
  const shiftEnd = new Date(shiftStart);
  shiftEnd.setDate(shiftEnd.getDate() + 1);
  shiftEnd.setHours(SHIFT_START_HOUR, 0, 0, 0);
  return shiftEnd;
}

/**
 * Obtiene el rango de fechas (from, to) para un turno con un offset.
 * offsetDays = 0 (Hoy), -1 (Ayer), etc.
 */
export function getShiftRange(offsetDays = 0): { from: Date; to: Date } {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + offsetDays);

  const from = getShiftStart(targetDate);
  const to = getShiftEnd(targetDate);

  return { from, to };
}

/**
 * Convierte un rango de fechas seleccionado en un calendario al rango de turnos correspondiente.
 * Cada día seleccionado representa su turno: de 12:00 PM a 12:00 PM del día siguiente.
 */
export function getCalendarShiftRange(from: Date, to?: Date): { from: Date; to: Date } {
  const shiftFrom = new Date(from);
  shiftFrom.setHours(SHIFT_START_HOUR, 0, 0, 0);

  const lastDay = to ? new Date(to) : new Date(from);
  lastDay.setDate(lastDay.getDate() + 1);
  lastDay.setHours(SHIFT_START_HOUR, 0, 0, 0);

  return { from: shiftFrom, to: lastDay };
}
