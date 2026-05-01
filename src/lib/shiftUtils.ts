export const SHIFT_START_HOUR = 16; // 4 PM

/**
 * Obtiene el inicio del turno para una fecha dada (por defecto ahora).
 * Si la hora de la fecha es antes de las 16:00, el turno empezó ayer a las 16:00.
 * Si la hora de la fecha es después de las 16:00, el turno empezó hoy a las 16:00.
 */
export function getShiftStart(date = new Date()): Date {
  const currentHour = date.getHours();
  const shiftStart = new Date(date);
  
  if (currentHour < SHIFT_START_HOUR) {
    // Si es antes de las 4pm, el turno empezó ayer
    shiftStart.setDate(shiftStart.getDate() - 1);
  }
  
  shiftStart.setHours(SHIFT_START_HOUR, 0, 0, 0);
  return shiftStart;
}

/**
 * Obtiene el fin del turno (12 horas después del inicio, es decir, 4 AM del día siguiente).
 */
export function getShiftEnd(date = new Date()): Date {
  const shiftStart = getShiftStart(date);
  const shiftEnd = new Date(shiftStart);
  shiftEnd.setDate(shiftEnd.getDate() + 1);
  shiftEnd.setHours(4, 0, 0, 0);
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
 * Ej: Si selecciona 1 de Mayo al 3 de Mayo:
 * from -> 1 de Mayo a las 16:00
 * to -> 4 de Mayo a las 04:00 (fin del turno del 3 de mayo)
 */
export function getCalendarShiftRange(from: Date, to?: Date): { from: Date; to: Date } {
  const shiftFrom = new Date(from);
  shiftFrom.setHours(SHIFT_START_HOUR, 0, 0, 0);
  
  const shiftTo = to ? new Date(to) : new Date(from);
  shiftTo.setDate(shiftTo.getDate() + 1);
  shiftTo.setHours(4, 0, 0, 0);
  
  return { from: shiftFrom, to: shiftTo };
}
