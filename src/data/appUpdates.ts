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
    date: "26 de Agosto, 2026",
    isoDate: "2026-08-26",
    title: "Nombre del Domiciliario en Facturas y Comandas Optimizadas en Domicilios",
    subtitle: "Inclusión del primer nombre del repartidor en facturas de clientes y unificación de comanda única de cocina organizada por categorías.",
    badgeText: `🛵 v${pkg.version}`,
    badgeType: "purple",
    gradientTheme: "purple",
    isMajor: false,
    summary: "Se integró la visualización del primer nombre del domiciliario asignado en todas las facturas y comprobantes del módulo de domicilios. Además, se optimizó la tirilla de cocina para domicilios imprimiendo una sola comanda continua organizada por categorías y sin la dirección de entrega para mayor agilidad operativa.",
    author: "Equipo de Desarrollo",
    items: [
      {
        title: "Primer Nombre del Domiciliario en Facturas",
        description: "Las facturas impresas y reimpresas para clientes en el store de domicilios ahora muestran el primer nombre del domiciliario asignado.",
        category: "feature",
        highlight: true,
      },
      {
        title: "Comanda Única de Cocina para Domicilios",
        description: "En el store de domicilios se genera una sola comanda continua por pedido con los productos organizados por categoría.",
        category: "improvement",
        highlight: true,
      },
      {
        title: "Depuración de Datos en Comandas",
        description: "Se retiró la dirección de entrega de las comandas de cocina para enfocar la lectura exclusivamente en preparación, cliente y notas.",
        category: "improvement",
        highlight: false,
      },
    ],
  },
  {
    id: "update-2026-08-26-v2-1-23",
    version: "v2.1.23",
    date: "26 de Agosto, 2026",
    isoDate: "2026-08-26",
    title: "Aislamiento y Enrutamiento Estricto de Notificaciones por Tienda",
    subtitle: "Filtrado granular de alertas sonoras, campana y notificaciones para Kiosko, Caja y Domicilios en Restaurante, Domicilios y Tráiler.",
    badgeText: "🔔 v2.1.23",
    badgeType: "primary",
    gradientTheme: "ocean",
    isMajor: false,
    summary: "Se reforzó el sistema de notificaciones en tiempo real para garantizar un aislamiento estricto por tienda activa. Las alertas y avisos generados en la tienda Domicilios aparecen exclusivamente en Domicilios, las de Restaurante en Restaurante, y las de Tráiler en Tráiler, evitando contaminación cruzada de notificaciones entre puntos de venta.",
    author: "Equipo de Desarrollo",
    items: [
      {
        title: "Aislamiento Estricto de Notificaciones por Tienda",
        description: "Enrutamiento inteligente que discrimina pedidos de Kiosko, Caja y Domicilios según la sede activa (Restaurante, Domicilios o Tráiler).",
        category: "fix",
        highlight: true,
      },
      {
        title: "Filtrado de Sonido y Campana en Tiempo Real",
        description: "Las alertas sonoras y el contador de notificaciones no leídas solo se disparan para eventos correspondientes al punto de venta activo del usuario.",
        category: "improvement",
        highlight: true,
      },
      {
        title: "Etiquetado de Alertas de Stock por Sede",
        description: "Las advertencias de insumos bajos o críticos ahora incluyen la sede emisora para una auditoría clara y sin confusiones.",
        category: "improvement",
        highlight: false,
      },
    ],
  },
  {
    id: "update-2026-08-26-v2-1-22",
    version: "v2.1.22",
    date: "26 de Agosto, 2026",
    isoDate: "2026-08-26",
    title: "Máxima Nitidez y Alto Contraste en Impresión Térmica",
    subtitle: "Corrección integral de textos tenues, refuerzo tipográfico en negrita pura y bordes definidos para facturas y comandas.",
    badgeText: "🖨️ v2.1.22",
    badgeType: "emerald",
    gradientTheme: "emerald",
    isMajor: false,
    summary: "Se corrigió el problema de impresión tenue en tickets térmicos de venta a la mesa, domicilios, comandas de cocina, facturas finales y consumo interno. Se estandarizó el uso de tipografía con alto grosor de trazo (negrita pura), cantidades y precios destacados, líneas divisorias reforzadas y desactivación de suavizado antialias difuminado para impresoras POS de 80mm.",
    author: "Equipo de Desarrollo",
    items: [
      {
        title: "Nitidez Total en Facturas y Comandas",
        description: "Todos los campos de cliente, dirección, teléfono, cajero, fechas y números de mesa/domicilio ahora imprimen en negro sólido sin escala de grises.",
        category: "fix",
        highlight: true,
      },
      {
        title: "Precios y Cantidades en Negrita Pura",
        description: "Las cantidades y valores unitarios en la tabla de ítems cuentan con peso tipográfico reforzado para evitar impresiones tenues en cabezales térmicos.",
        category: "improvement",
        highlight: true,
      },
      {
        title: "Líneas Divisorias y Recuadros Definidos",
        description: "Aumento de grosor en separadores punteados y bordes de notas/domicilio para una delimitación limpia en papel térmico.",
        category: "improvement",
        highlight: false,
      },
      {
        title: "Plantillas de Consumo Interno y Cierre",
        description: "Homologación de contraste y legibilidad para comprobantes de colaboradores, cuentas de cobro y liquidaciones.",
        category: "improvement",
        highlight: false,
      },
    ],
  },
  {
    id: "update-2026-08-26-v2-1-21",
    version: "v2.1.21",
    date: "26 de Agosto, 2026",
    isoDate: "2026-08-26",
    title: "Optimización Térmica en Domicilios, Liquidaciones & Rediseño de Pago Mixto",
    subtitle: "Impresión térmica calibrada a 72mm sin cortes de márgenes, tirilla de liquidación nítida y flujo de pago mixto con totalizador en vivo.",
    badgeText: "🚀 v2.1.21",
    badgeType: "purple",
    gradientTheme: "purple",
    isMajor: false,
    summary: "Se calibraron las plantillas de impresión térmica a 72mm efectivo con forzado de contraste negro puro al 100% para evitar cortes laterales y letras tenues en facturas, comandas y cierres. Se renovó la tirilla de liquidación de domiciliarios con balance financiero claro. Además, se separó el flujo de Pago Mixto para abonar directamente al total con cálculo en tiempo real de saldo restante, y se eliminaron líneas de descuento innecesarias.",
    author: "Equipo de Desarrollo",
    items: [
      {
        title: "Flujo Independiente de Pago Mixto",
        description: "Permite combinar Efectivo, Tarjeta y Transferencia sobre el total del pedido con totalizador en vivo de saldo restante sin requerir selección de productos.",
        category: "feature",
        highlight: true,
      },
      {
        title: "Calibración Térmica de 72mm & Negro Puro",
        description: "Ajuste de ancho efectivo y eliminación de dithering gris en facturas, comandas de cocina y cierres de turno para impresoras estándar de 80mm.",
        category: "improvement",
        highlight: true,
      },
      {
        title: "Tirilla de Liquidación de Domiciliarios",
        description: "Estructura térmica limpia con detalle de pedidos, fletes, método de cobro, balance neto con caja y líneas de firma.",
        category: "improvement",
        highlight: true,
      },
      {
        title: "Limpieza de Facturas & Accesibilidad",
        description: "Eliminación de la fila de descuento innecesaria ($0) y resolución de títulos accesibles en modales de cobro.",
        category: "fix",
        highlight: false,
      },
    ],
  },
  {
    id: "update-2026-08-25-v2-1-20",
    version: "v2.1.20",
    date: "25 de Agosto, 2026",
    isoDate: "2026-08-25",
    title: "Acceso Multi-Sede por Colaborador & Rediseño de Consumo Interno",
    subtitle: "Navegación fluida entre tiendas asignadas para colaboradores y optimización total del carrito de Consumo Interno.",
    badgeText: "🚀 v2.1.20",
    badgeType: "primary",
    gradientTheme: "sunset",
    isMajor: false,
    summary: "Se implementó la navegación multi-tienda para usuarios con acceso global o múltiples sedes asignadas (ej. Tráiler y Domicilios). Además, se optimizó el módulo de Consumo Interno con panel de carrito responsive (escritorio y móvil), integración con personalizador de productos y desglose de descuentos.",
    author: "Equipo de Desarrollo",
    items: [
      {
        title: "Navegación y Switcher Multi-Tienda para Colaboradores",
        description: "Los usuarios con acceso a 2 o más tiendas ahora pueden alternar fácilmente entre sus sedes asignadas desde el botón de tienda en la barra superior.",
        category: "feature",
        highlight: true,
      },
      {
        title: "Gestión Granular de Tiendas en Usuarios",
        description: "Opción de Acceso Global o selección múltiple de sedes por colaborador con persistencia directa en base de datos.",
        category: "improvement",
        highlight: true,
      },
      {
        title: "POS de Consumo Interno Estilo Kiosko y Caja",
        description: "Rediseño del flujo de toma de pedidos con panel de carrito lateral en escritorio, cajón deslizable en móviles, personalizador de ítems y desglose claro de ahorros.",
        category: "feature",
        highlight: true,
      },
    ],
  },
  {
    id: "update-2026-08-21-v2-1-19",
    version: "v2.1.19",
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
