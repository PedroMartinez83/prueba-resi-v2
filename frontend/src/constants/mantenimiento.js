export const SERVICIOS_ESPECIALES_OPCIONES = [
  { value: '', label: 'Sin servicio especial' },
  { value: 'Revision de fuga', label: 'Revision de fuga' },
  { value: 'Ruido en suspension', label: 'Ruido en suspension' },
  { value: 'Limpieza de inyectores', label: 'Limpieza de inyectores' },
  { value: 'Revision de frenos', label: 'Revision de frenos' },
  { value: 'Revision de bateria', label: 'Revision de bateria' },
  { value: 'Escaneo electronico', label: 'Escaneo electronico' },
  { value: 'Revision de aire acondicionado', label: 'Revision de aire acondicionado' },
  { value: 'Revision de llantas', label: 'Revision de llantas' },
  { value: 'Ajuste de alineacion y balanceo', label: 'Ajuste de alineacion y balanceo' },
  { value: 'Otro diagnostico en taller', label: 'Otro diagnostico en taller' }
];

export const SERVICIOS_ESPECIALES_VALUES = SERVICIOS_ESPECIALES_OPCIONES
  .map((option) => option.value)
  .filter(Boolean);

export const TALLER_CATEGORIAS_OPCIONES = [
  { value: 'Automanager (Interno)', label: 'Automanager (Interno)' },
  { value: 'Laminero', label: 'Laminero' },
  { value: 'Electrico', label: 'Electrico' },
  { value: 'Aire acondicionado', label: 'Aire acondicionado' },
  { value: 'Suspension', label: 'Suspension' },
  { value: 'Detallado', label: 'Detallado' },
  { value: 'Otro', label: 'Otro' }
];
