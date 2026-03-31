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

    // 3. Limpiar cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    // 4. Limpiar indexedDB (para Supabase/QueryClient)
    try {
      if (window.indexedDB && window.indexedDB.databases) {
        window.indexedDB.databases().then((dbs) => {
          dbs.forEach((db) => {
            if (db.name) window.indexedDB.deleteDatabase(db.name);
          });
        });
      }
    } catch (e) {
      console.error("Error cleaning indexedDB:", e);
    }
  } catch (err) {
    console.error("Error al limpiar datos locales:", err);
  }

  // 4. Forzar recarga desde el servidor ignorando la caché
  window.location.href = window.location.origin + "/login?reset=true";
};
