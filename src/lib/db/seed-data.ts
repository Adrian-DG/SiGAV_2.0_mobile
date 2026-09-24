function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export type SeedEvento = {
  estado: number;
  categoria: number;
  tipos: string[];
  ciudadanoPrincipal: string | null;
  vehiculoDescripcion: string | null;
  direccion: string | null;
  fechaHoraReporte: string;
  unidadFicha: string;
};

/**
 * Datos de muestra para desarrollar sin depender de un endpoint de eventos en la API (que
 * todavía no existe — ver features/events/api.ts). Se insertan una sola vez, la primera vez
 * que la app abre la base de datos local.
 */
export const SEED_EVENTOS: SeedEvento[] = [
  {
    estado: 1,
    categoria: 1,
    tipos: ['Vehículo varado', 'Batería descargada'],
    ciudadanoPrincipal: 'Juan Pérez',
    vehiculoDescripcion: 'Toyota Corolla · Rojo · A123456',
    direccion: 'Av. 27 de Febrero, esq. Winston Churchill',
    fechaHoraReporte: hoursAgo(1),
    unidadFicha: 'CA-1759',
  },
  {
    estado: 1,
    categoria: 1,
    tipos: ['Llanta ponchada'],
    ciudadanoPrincipal: 'Carla Núñez',
    vehiculoDescripcion: 'Hyundai Accent · Azul · G556123',
    direccion: 'Autopista Duarte, km 9',
    fechaHoraReporte: hoursAgo(2),
    unidadFicha: 'CA-1759',
  },
  {
    estado: 1,
    categoria: 1,
    tipos: ['Obstrucción de vía'],
    ciudadanoPrincipal: null,
    vehiculoDescripcion: null,
    direccion: 'Av. Sarasota',
    fechaHoraReporte: hoursAgo(3),
    unidadFicha: 'CA-1759',
  },
  {
    estado: 2,
    categoria: 1,
    tipos: ['Combustible agotado'],
    ciudadanoPrincipal: 'Pedro Ramírez',
    vehiculoDescripcion: 'Kia Rio · Blanco · L889012',
    direccion: 'Av. John F. Kennedy',
    fechaHoraReporte: hoursAgo(4),
    unidadFicha: 'CA-1759',
  },
  {
    estado: 2,
    categoria: 2,
    tipos: ['Accidente de tránsito', 'Colisión menor'],
    ciudadanoPrincipal: 'María Gómez',
    vehiculoDescripcion: 'Honda CR-V · Gris · B987654',
    direccion: 'Av. Winston Churchill',
    fechaHoraReporte: hoursAgo(5),
    unidadFicha: 'CA-1759',
  },
  {
    estado: 3,
    categoria: 1,
    tipos: ['Vehículo varado'],
    ciudadanoPrincipal: 'Luis Fernández',
    vehiculoDescripcion: 'Nissan Sentra · Negro · H445566',
    direccion: 'Av. Abraham Lincoln',
    fechaHoraReporte: hoursAgo(7),
    unidadFicha: 'CA-1759',
  },
  {
    estado: 3,
    categoria: 2,
    tipos: ['Accidente de tránsito'],
    ciudadanoPrincipal: 'Ana Castillo',
    vehiculoDescripcion: 'Chevrolet Spark · Amarillo · K223344',
    direccion: 'Av. Máximo Gómez',
    fechaHoraReporte: hoursAgo(9),
    unidadFicha: 'CA-1759',
  },
  {
    estado: 3,
    categoria: 1,
    tipos: ['Batería descargada'],
    ciudadanoPrincipal: 'Ramón Cruz',
    vehiculoDescripcion: 'Toyota Yaris · Rojo · M998877',
    direccion: 'Av. Tiradentes',
    fechaHoraReporte: daysAgo(1),
    unidadFicha: 'CA-1759',
  },
  {
    estado: 1,
    categoria: 2,
    tipos: ['Accidente de tránsito'],
    ciudadanoPrincipal: 'Rosa Jiménez',
    vehiculoDescripcion: 'Ford Explorer · Azul · P334455',
    direccion: 'Av. Independencia',
    fechaHoraReporte: daysAgo(2),
    unidadFicha: 'CA-1759',
  },
];
