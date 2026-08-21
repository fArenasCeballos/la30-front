import pkg from "../../package.json";

export type UpdateCategory = "feature" | "improvement" | "fix" | "system";

export interface UpdateItem {
  title: string;
  description: string;
  category: UpdateCategory;
  highlight?: boolean;
}

export interface AppUpdate {
  id: string;
  version: string;
  date: string; // Formato legible ej: "18 de Agosto, 2026"
  isoDate: string; // Para ordenamiento "YYYY-MM-DD"
  title: string;
  subtitle: string;
  badgeText: string;
  badgeType: "primary" | "emerald" | "amber" | "purple" | "rose";
  gradientTheme: "sunset" | "ocean" | "emerald" | "purple" | "midnight";
  isMajor?: boolean;
  summary: string;
  items: UpdateItem[];
  author?: string;
}

export const APP_UPDATES: AppUpdate[] = [
  {
    id: `update-v${pkg.version}`,
    version: `v${pkg.version}`,
    date: "21 de Agosto, 2026",
    isoDate: "2026-08-21",
    title: "Seguridad de Base de Datos & Blindaje de Roles",
    subtitle: "Restricción de permisos RPC por roles, protección antiabuso y rate limiting en endpoints públicos.",
    badgeText: `🛡️ v${pkg.version}`,
    badgeType: "primary",
    gradientTheme: "midnight",
    isMajor: false,
    summary: "Se reforzó la capa de seguridad en PostgreSQL revocando accesos generales a PUBLIC y asignando permisos explícitos para roles de la plataforma (admin, caja, mesero, cocina, bodega). Las funciones públicas cuentan con rate-limiting y validación anti-tampering.",
    author: "Equipo de Desarrollo",
    items: [
      {
        title: "Blindaje de RPCs por Rol y Privilegios Explícitos",
        description: "Restricción de ejecución a roles autorizados (admin, caja, mesero, cocina, bodega) con validación estricta de identidad.",
        category: "system",
        highlight: true,
      },
      {
        title: "Protección Antiabuso & Rate Limiting en Funciones Públicas",
        description: "Control de frecuencia de solicitudes y mitigación de fuerza bruta en cupones y pedidos de la app de clientes.",
        category: "feature",
        highlight: true,
      },
      {
        title: "Recálculo Seguro de Precios (Anti-Tampering)",
        description: "Verificación obligatoria de precios en base de datos al generar pedidos para evitar alteraciones en el cliente.",
        category: "improvement",
      },
      {
        title: "Search Path Fijo y Sanitización Estricta",
        description: "Configuración SET search_path = public, pg_temp y sanitización de entradas en todas las funciones SECURITY DEFINER.",
        category: "system",
      },
    ],
  },
  {
    id: "update-2026-08-20-v2-1-18",
    version: "v2.1.18",
    date: "20 de Agosto, 2026",
    isoDate: "2026-08-20",
    title: "Liquidación de Domiciliarios & Filtro de Sedes",
    subtitle: "Módulo oficial de liquidación por turnos de 12 a 12, tirilla térmica de fletes y filtro por sedes en Reportería.",
    badgeText: "🚀 v2.1.18",
    badgeType: "purple",
    gradientTheme: "purple",
    isMajor: true,
    summary: "Se implementó el módulo completo de liquidación de domiciliarios por turnos oficiales de 12 PM a 12 PM, cálculo exacto de fletes (zonas de mapa o manual), cobro de efectivo, balance neto y tirilla térmica individual. Además, se integró el selector de sedes en Reportería con distinción Caja vs Domicilio.",
    author: "Equipo de Desarrollo",
    items: [
      {
        title: "Módulo de Liquidación de Domiciliarios (12 PM - 12 PM)",
        description: "Accesible para Cajero y Administrador con desglose de pedidos entregados, cobro de efectivo, cálculo de fletes y balance final.",
        category: "feature",
        highlight: true,
      },
      {
        title: "Tirilla Térmica de Liquidación (80mm)",
        description: "Impresión de comprobante individual por repartidor con resumen de fletes a pagar, efectivo en mano y espacio para firmas de constancia.",
        category: "feature",
        highlight: true,
      },
      {
        title: "Flujo Directo de Cierre en Domicilios",
        description: "Al ejecutar el cierre de turno se imprime la tirilla general y se abre automáticamente el módulo de liquidación de repartidores.",
        category: "improvement",
        highlight: true,
      },
      {
        title: "Filtro de Sedes en Reportería",
        description: "Alterna fácilmente entre consolidado General (Todas las sedes), Restaurante, Tráiler y Domicilios en reportes y exportación XLSX.",
        category: "feature",
        highlight: true,
      },
      {
        title: "Asignación Ágil de Repartidores",
        description: "Selector de domiciliario en tarjetas de pedidos y sección de asignación en vivo para pedidos completados sin repartidor.",
        category: "improvement",
      },
    ],
  },
  {
    id: "update-2026-08-18-v2-1-17",
    version: "v2.1.17",
    date: "18 de Agosto, 2026",
    isoDate: "2026-08-18",
    title: "Panel de Novedades & Optimización General",
    subtitle: "Mantente al tanto de todos los cambios, mejoras de rendimiento y nuevas características en tiempo real.",
    badgeText: "✨ Novedad",
    badgeType: "primary",
    gradientTheme: "sunset",
    isMajor: false,
    summary: "Se incorpora el sistema de visualización de cambios y posters de actualización para que el equipo administrativo siempre esté enterado de las últimas implementaciones del sistema.",
    author: "Equipo de Desarrollo",
    items: [
      {
        title: "Nuevo Módulo de Novedades & Posters",
        description: "Visualización estética de las últimas actualizaciones, detalles de cambios y registro histórico de versiones directamente en el panel de control.",
        category: "feature",
        highlight: true,
      },
      {
        title: "Indicador de Actualizaciones No Leídas",
        description: "Notificación inteligente con pulso visual en la cabecera del panel que te avisa cuando se publica una nueva actualización.",
        category: "improvement",
        highlight: true,
      },
      {
        title: "Optimización de Sincronización en Vivo",
        description: "Mejoras en el refresco de órdenes y métricas financieras para mayor velocidad y menor consumo de datos.",
        category: "system",
      },
      {
        title: "Ajustes en Tarjetas de Métricas",
        description: "Mejor legibilidad y contraste en las cifras de ingresos por método de pago y tickets promedio.",
        category: "improvement",
      },
    ],
  },
  {
    id: "update-2026-08-10-v2-1-10",
    version: "v2.1.10",
    date: "10 de Agosto, 2026",
    isoDate: "2026-08-10",
    title: "Gestión Avanzada de Domicilios & Zonas",
    subtitle: "Herramientas de polígonos en mapa y cálculo dinámico de tarifas de entrega.",
    badgeText: "🚀 Actualización",
    badgeType: "purple",
    gradientTheme: "ocean",
    summary: "Mayor precisión en la asignación de domiciliarios y cobertura geográfica de pedidos por sede.",
    author: "Equipo de Desarrollo",
    items: [
      {
        title: "Editor de Zonas con Leaflet",
        description: "Trazado interactivo de áreas de cobertura para domicilios con tarifas personalizadas por polígono.",
        category: "feature",
        highlight: true,
      },
      {
        title: "Control de Despachos",
        description: "Seguimiento en tiempo real de pedidos en ruta con confirmación directa para domiciliarios.",
        category: "improvement",
      },
      {
        title: "Corrección en Filtros de Reportes",
        description: "Solucionado desfase en el corte de turnos nocturnos para reportes consolidados.",
        category: "fix",
      },
    ],
  },
  {
    id: "update-2026-08-01-v2-0-0",
    version: "v2.0.0",
    date: "1 de Agosto, 2026",
    isoDate: "2026-08-01",
    title: "Lanzamiento La 30 Sistema Integral v2",
    subtitle: "Rediseño completo de la interfaz, arquitectura reactiva y soporte multisucursal.",
    badgeText: "🎉 Gran Lanzamiento",
    badgeType: "emerald",
    gradientTheme: "emerald",
    isMajor: true,
    summary: "Nueva generación de la plataforma con punto de venta Kiosko, KDS en cocina, administración centralizada e integración con Siigo.",
    author: "Equipo de Desarrollo",
    items: [
      {
        title: "Sistema Multi-Sede Completo",
        description: "Cambio y aislamiento fluido entre sedes con control de inventario y caja independiente.",
        category: "feature",
        highlight: true,
      },
      {
        title: "KDS Pantalla de Cocina",
        description: "Organización de comandas con tiempos de preparación y alertas sonoras.",
        category: "feature",
      },
      {
        title: "Facturación Electrónica Siigo",
        description: "Generación automática y manual de facturas electrónicas desde el módulo de caja.",
        category: "feature",
      },
    ],
  },
];

export const LATEST_UPDATE_ID =
  APP_UPDATES[0]?.id || `update-v${pkg.version}`;
