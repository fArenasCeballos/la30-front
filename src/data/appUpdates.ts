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
    date: "18 de Agosto, 2026",
    isoDate: "2026-08-18",
    title: "Panel de Novedades & Optimización General",
    subtitle: "Mantente al tanto de todos los cambios, mejoras de rendimiento y nuevas características en tiempo real.",
    badgeText: "✨ Novedad",
    badgeType: "primary",
    gradientTheme: "sunset",
    isMajor: true,
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
