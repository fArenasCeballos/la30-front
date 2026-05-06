import { supabase } from "./supabase";

/**
 * Redimensiona una imagen en el frontend usando Canvas.
 * - Ancho máximo: 800px
 * - Calidad: 0.8 (JPEG)
 * - Mantiene proporción
 */
export async function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Error al procesar la imagen"));
          },
          "image/jpeg",
          0.8,
        );
      };
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Sube una imagen procesada a Supabase Storage con nombre único UUID.
 */
export async function uploadProductImage(
  blob: Blob,
): Promise<{ publicUrl: string; path: string }> {
  const fileExt = "jpg";
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `products/${fileName}`;

  const { error } = await supabase.storage
    .from("assets")
    .upload(filePath, blob, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  // Forzar la URL con /public/ si el SDK retorna algo distinto
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publicUrl = `${baseUrl}/storage/v1/object/public/assets/${filePath}`;

  return { publicUrl, path: filePath };
}

/**
 * Elimina una imagen del Supabase Storage dado su URL pública o path.
 */
export async function deleteProductImage(pathOrUrl: string): Promise<void> {
  if (!pathOrUrl) return;

  let path = pathOrUrl;
  // Extraer el path si es una URL completa (maneja tanto /public/assets/ como /assets/)
  if (pathOrUrl.includes("/storage/v1/object/public")) {
    const parts = pathOrUrl.split("/assets/");
    if (parts.length > 1) {
      path = parts[1];
    }
  }

  if (!path) return;

  const { error } = await supabase.storage.from("assets").remove([path]);

  if (error) {
    console.error(`Error eliminando archivo ${path}:`, error.message);
  }
}

/**
 * Genera una URL de imagen optimizada usando la API de Supabase.
 * Aprovecha el resizing al vuelo y conversión a WebP para máxima velocidad.
 */
export function getOptimizedImageUrl(
  originalUrl: string | null | undefined,
  width = 400,
  quality = 70,
): string {
  // Nota: La optimización de imágenes al vuelo (/render/image/) requiere el plan Pro de Supabase.
  // Si está devolviendo 400 Bad Request, es porque la característica no está activa.
  // Por ahora, devolvemos la URL original directamente para evitar fallos.
  return originalUrl || "";
}
