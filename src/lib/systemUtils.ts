/**
 * Utilidades para el mantenimiento y recuperación del sistema.
 */

/**
 * Realiza una limpieza profunda de los datos locales del navegador
 * y recarga la aplicación. Útil para solucionar problemas de sesión corrupta
 * o caché desactualizada.
 */
export const forceSystemReset = () => {
  console.warn("Iniciando restablecimiento forzado del sistema...");

  try {
    // 1. Limpiar LocalStorage (Donde Supabase guarda la sesión)
    window.localStorage.clear();

    // 2. Limpiar SessionStorage
    window.sessionStorage.clear();

    // 3. Intentar limpiar cookies (opcional, solo del dominio actual)
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
  } catch (err) {
    console.error("Error al limpiar datos locales:", err);
  }

  // 4. Forzar recarga desde el servidor ignorando la caché
  window.location.href = window.location.origin + "/login?reset=true";
};
