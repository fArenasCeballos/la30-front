export const SHIFT_START_HOUR = 16; // 4:00 PM — inicio del turno
export const SHIFT_END_HOUR = 4;    // 4:00 AM del día siguiente — fin del turno

/**
 * Obtiene el inicio del turno para una fecha dada (por defecto ahora).
 * El turno va de 4:00 PM a 4:00 AM del día siguiente.
 * Si la hora actual es antes de las 4:00 AM, el turno empezó ayer a las 4:00 PM.
 * Si la hora actual está entre 4:00 AM y 4:00 PM, el turno del día aún no comienza
 * (pertenece al turno anterior → ayer a las 4 PM).
 * Si la hora actual es >= 4:00 PM, el turno empezó hoy a las 4:00 PM.
 */
export function getShiftStart(date = new Date()): Date {
  const currentHour = date.getHours();
  const shiftStart = new Date(date);

  if (currentHour < SHIFT_START_HOUR) {
    // Antes de las 4 PM → el turno empezó ayer a las 4 PM
    shiftStart.setDate(shiftStart.getDate() - 1);
  }

  shiftStart.setHours(SHIFT_START_HOUR, 0, 0, 0);
  return shiftStart;
}

/**
 * Obtiene el fin del turno: 4:00 AM del día siguiente al inicio del turno.
 */
export function getShiftEnd(date = new Date()): Date {
  const shiftStart = getShiftStart(date);
  const shiftEnd = new Date(shiftStart);
  shiftEnd.setDate(shiftEnd.getDate() + 1);
  shiftEnd.setHours(SHIFT_END_HOUR, 0, 0, 0);
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
 * Cada día seleccionado representa su turno: desde las 4:00 PM del día hasta las 4:00 AM del día siguiente.
 *
 * Ej: Si selecciona 1 de Mayo al 3 de Mayo:
 *   from → 1 de Mayo a las 16:00
 *   to   → 4 de Mayo a las 04:00 (fin del turno del 3 de mayo)
 */
export function getCalendarShiftRange(from: Date, to?: Date): { from: Date; to: Date } {
  const shiftFrom = new Date(from);
  shiftFrom.setHours(SHIFT_START_HOUR, 0, 0, 0); // 4:00 PM del primer día

  const lastDay = to ? new Date(to) : new Date(from);
  lastDay.setDate(lastDay.getDate() + 1);          // día siguiente al último seleccionado
  lastDay.setHours(SHIFT_END_HOUR, 0, 0, 0);       // 4:00 AM

  return { from: shiftFrom, to: lastDay };
}
