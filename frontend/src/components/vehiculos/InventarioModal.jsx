import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ClipboardCheck, Save, Camera, Signature, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import adminService from '../../services/adminService';

const MAX_FOTOS = 4;

const DESCRIPCION_SI_NO = [
  'Espejo lateral derecho',
  'Espejo lateral izquierdo',
  'Espejo retrovisor',
  'Tapetes',
  'Limpiadores',
  'Claxon',
  'Viseras',
  'Radio taxi',
  'Bocinas',
  'Antena',
  'Bateria (marca)',
  'Radio/CD',
  'Clima',
  'Manijas',
  'Parabrisas estrellado',
  'Medallon trasero estrellado',
  'Cristales de puertas (laterales)',
  'Encendedor',
  'Faros y luces',
  'Molduras',
  'Calaveras',
  'Defensas',
  'Parrilla delantera',
  'Llanta de refaccion',
  'Tapones de ruedas',
  'Tapon gasolina',
  'Tapon de radiador',
  'Tapon de aceite',
  'Bayoneta aceite',
  'Llave de cruz',
  'Gato',
  'Reflejantes de emergencia (senalamiento)',
  'Extinguidor',
  'Cable pasa corriente',
  'Caja de herramientas',
  'Cinturones de seguridad',
  'Placa delantera',
  'Placa trasera',
  'Botiquin de primeros auxilios'
];

const DESCRIPCION_ESTADO = [
  'Costado derecho',
  'Costado izquierdo',
  'Cofre',
  'Toldo',
  'Exterior limpio',
  'Cajuela',
  'Pintura',
  'Sistema de alarma',
  'Vestiduras',
  'Interior limpio'
];

const LLANTAS_ROWS = [
  'Delantera derecha',
  'Delantera izquierda',
  'Trasera derecha',
  'Trasera izquierda',
  'Refaccion'
];

const GASOLINA_OPTIONS = [
  { value: 'vacio', label: 'Vacio (E)', porcentaje: 0 },
  { value: 'cuarto', label: '1/4', porcentaje: 25 },
  { value: 'medio', label: '1/2', porcentaje: 50 },
  { value: 'tres_cuartos', label: '3/4', porcentaje: 75 },
  { value: 'lleno', label: 'Lleno (F)', porcentaje: 100 }
];

const LUCES_ROWS = [
  'Unidad del/izq',
  'Unidad del/der',
  'Cuarto del/izq',
  'Cuarto del/der',
  'Cuarto tras/izq',
  'Cuarto tras/der',
  'Stop/izq',
  'Stop derecho',
  'Intermitentes',
  'Reversa'
];

const LIQUIDOS_ROWS = [
  'Nivel de agua y/o refrigerante',
  'Nivel de aceite de motor',
  'Nivel de aceite hidraulico',
  'Nivel de liquido de frenos'
];

const toKey = (label) => String(label || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const dataUrlToBlob = (dataUrl) => {
  const [meta, base64] = String(dataUrl || '').split(',');
  const mimeMatch = meta?.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const byteString = atob(base64 || '');
  const buffer = new ArrayBuffer(byteString.length);
  const uint8 = new Uint8Array(buffer);
  for (let i = 0; i < byteString.length; i += 1) {
    uint8[i] = byteString.charCodeAt(i);
  }
  return new Blob([buffer], { type: mime });
};

const getEstadoBadge = (estado) => {
  if (estado === 'completado' || estado === 'borrador') return 'bg-green-500/20 text-green-300 border-green-500/30';
  return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
};

const getEstadoLabel = (estado) => {
  if (estado === 'borrador') return 'registrado';
  return estado || 'N/A';
};

const getTipoLabel = (tipo) => {
  if (tipo === 'alta_inicial') return 'Alta inicial';
  if (tipo === 'entrega_conductor') return 'Entrega a conductor';
  if (tipo === 'devolucion_conductor') return 'Devolucion de conductor';
  return tipo || 'N/A';
};

const initBooleanMap = (items, value = 'no') => (
  items.reduce((acc, item) => ({ ...acc, [toKey(item)]: value }), {})
);

const initEstadoMap = (items, value = 'bueno') => (
  items.reduce((acc, item) => ({ ...acc, [toKey(item)]: value }), {})
);

const initLlantasMap = () => (
  LLANTAS_ROWS.reduce((acc, item) => ({
    ...acc,
    [toKey(item)]: { desgaste: '', marca: '' }
  }), {})
);

const keyToLabelMap = (labels) => labels.reduce((acc, label) => {
  acc[toKey(label)] = label;
  return acc;
}, {});

const LABELS_SI_NO = keyToLabelMap(DESCRIPCION_SI_NO);
const LABELS_ESTADO = keyToLabelMap(DESCRIPCION_ESTADO);
const LABELS_LLANTAS = keyToLabelMap(LLANTAS_ROWS);
const LABELS_LUCES = keyToLabelMap(LUCES_ROWS);
const LABELS_LIQUIDOS = keyToLabelMap(LIQUIDOS_ROWS);

const getSeccionCambio = (campo = '') => {
  if (campo === 'kilometraje' || campo === 'observaciones') return 'Resumen';
  if (campo.startsWith('caracteristicas_unidad.')) return 'Caracteristicas';
  if (campo.startsWith('descripcion_si_no.')) return 'Descripcion SI/NO';
  if (campo.startsWith('descripcion_estado_general.')) return 'Estado general';
  if (campo.startsWith('llantas.')) return 'Llantas';
  if (campo.startsWith('gasolina.')) return 'Gasolina';
  if (campo.startsWith('luces.')) return 'Luces';
  if (campo.startsWith('nivel_liquidos.')) return 'Liquidos';
  return 'Otros';
};

const getEtiquetaCampo = (campo = '') => {
  if (campo === 'kilometraje') return 'Kilometraje';
  if (campo === 'observaciones') return 'Observaciones';
  const lastPart = String(campo).split('.').pop() || campo;
  return lastPart
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
};

const esCambioCritico = (campo = '') => (
  campo === 'kilometraje' ||
  campo === 'observaciones' ||
  campo.startsWith('gasolina.') ||
  campo.startsWith('llantas.')
);

const getGasolinaPorcentaje = (gasolina) => {
  if (!gasolina) return 50;
  if (typeof gasolina.porcentaje === 'number') return gasolina.porcentaje;
  return GASOLINA_OPTIONS.find((g) => g.value === gasolina.nivel)?.porcentaje ?? 50;
};

const InventarioModal = ({
  isOpen,
  onClose,
  vehiculo,
  onSaved,
  notify,
  initialSnapshotTipo = 'alta_inicial'
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inventarios, setInventarios] = useState([]);
  const [snapshotAId, setSnapshotAId] = useState('');
  const [snapshotBId, setSnapshotBId] = useState('');
  const [comparando, setComparando] = useState(false);
  const [comparacion, setComparacion] = useState(null);
  const [showComparacionModal, setShowComparacionModal] = useState(false);
  const [exportandoId, setExportandoId] = useState(null);
  const [inlineAlert, setInlineAlert] = useState(null);

  const [snapshotTipo, setSnapshotTipo] = useState('alta_inicial');
  const [fotos, setFotos] = useState([]);
  const [observaciones, setObservaciones] = useState('');

  const [caracteristicas, setCaracteristicas] = useState({
    marca: '',
    modelo: '',
    anio_tarjeta_circulacion: '',
    placas: '',
    color: '',
    poliza_seguros_vigencia: '',
    fecha_entrega: '',
    kilometraje_salida: ''
  });

  const [descripcionSiNo, setDescripcionSiNo] = useState(() => initBooleanMap(DESCRIPCION_SI_NO, 'no'));
  const [descripcionEstado, setDescripcionEstado] = useState(() => initEstadoMap(DESCRIPCION_ESTADO, 'bueno'));
  const [llantas, setLlantas] = useState(() => initLlantasMap());
  const [luces, setLuces] = useState(() => initBooleanMap(LUCES_ROWS, 'si'));
  const [liquidos, setLiquidos] = useState(() => initEstadoMap(LIQUIDOS_ROWS, 'bueno'));
  const [gasolinaNivel, setGasolinaNivel] = useState('medio');
  const [firmasMeta, setFirmasMeta] = useState({
    reviso_nombre_mecanico: '',
    recibe_nombre_arrendatario: ''
  });

  const canvasMecanicoRef = useRef(null);
  const canvasArrendatarioRef = useRef(null);
  const drawingRef = useRef({ mecanico: false, arrendatario: false });
  const lastPointRef = useRef({ mecanico: null, arrendatario: null });
  const baseFromAltaAppliedRef = useRef(false);

  const vehiculoLabel = useMemo(() => {
    if (!vehiculo) return '';
    const numero = vehiculo.NumeroVehiculo || vehiculo.numero_vehiculo || `#${vehiculo.id}`;
    const marca = vehiculo.Marca || vehiculo.marca || '';
    const modelo = vehiculo.Modelo || vehiculo.modelo || '';
    return `${numero} - ${marca} ${modelo}`.trim();
  }, [vehiculo]);

  const hasAltaInicialRegistrada = useMemo(() => (
    Boolean(vehiculo?.tiene_inventario_inicial) ||
    inventarios.some((item) => item.snapshot_tipo === 'alta_inicial')
  ), [vehiculo?.tiene_inventario_inicial, inventarios]);

  const tiposInventarioDisponibles = useMemo(() => {
    const tipos = [
      { value: 'alta_inicial', label: 'Alta inicial' },
      { value: 'entrega_conductor', label: 'Entrega a conductor' },
      { value: 'devolucion_conductor', label: 'Devolucion de conductor' }
    ];
    return tipos.filter((tipo) => (
      tipo.value !== 'alta_inicial' || !hasAltaInicialRegistrada
    ));
  }, [hasAltaInicialRegistrada]);

  const inventariosHistorial = useMemo(() => {
    if (!Array.isArray(inventarios) || inventarios.length <= 3) {
      return inventarios || [];
    }

    const ultimo = inventarios[inventarios.length - 1] || null;
    const altaInicial = inventarios.find((item) => item.snapshot_tipo === 'alta_inicial') || inventarios[0] || null;

    const usados = new Set();
    if (altaInicial?.id) usados.add(altaInicial.id);
    if (ultimo?.id) usados.add(ultimo.id);

    const candidatos = inventarios.filter((item) => !usados.has(item.id));
    const intermedio = candidatos.length > 0
      ? candidatos[Math.floor((candidatos.length - 1) / 2)]
      : null;

    const seleccion = [altaInicial, intermedio, ultimo]
      .filter(Boolean)
      .filter((item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx);

    return seleccion.sort(
      (a, b) => inventarios.findIndex((x) => x.id === a.id) - inventarios.findIndex((x) => x.id === b.id)
    );
  }, [inventarios]);

  const cambiosAgrupados = useMemo(() => {
    const grouped = {};
    (comparacion?.cambios || []).forEach((cambio) => {
      const seccion = getSeccionCambio(cambio.campo);
      if (!grouped[seccion]) grouped[seccion] = [];
      grouped[seccion].push(cambio);
    });
    return grouped;
  }, [comparacion]);

  const paintCanvasBlank = (canvas) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
  };

  const resetAllCanvases = () => {
    paintCanvasBlank(canvasMecanicoRef.current);
    paintCanvasBlank(canvasArrendatarioRef.current);
  };

  const hasSignature = (canvas) => {
    if (!canvas) return false;
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    const blankCtx = blank.getContext('2d');
    blankCtx.fillStyle = '#ffffff';
    blankCtx.fillRect(0, 0, blank.width, blank.height);
    return canvas.toDataURL() !== blank.toDataURL();
  };

  const getCanvasPoint = (canvas, event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };

  const startDraw = (type, event) => {
    const canvas = type === 'mecanico' ? canvasMecanicoRef.current : canvasArrendatarioRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasPoint(canvas, event);
    const ctx = canvas.getContext('2d');
    if (event.pointerId !== undefined && canvas.setPointerCapture) {
      canvas.setPointerCapture(event.pointerId);
    }
    drawingRef.current[type] = true;
    lastPointRef.current[type] = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
  };

  const draw = (type, event) => {
    if (!drawingRef.current[type]) return;
    const canvas = type === 'mecanico' ? canvasMecanicoRef.current : canvasArrendatarioRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasPoint(canvas, event);
    const ctx = canvas.getContext('2d');
    const last = lastPointRef.current[type];
    if (last) {
      const midX = (last.x + x) / 2;
      const midY = (last.y + y) / 2;
      ctx.quadraticCurveTo(last.x, last.y, midX, midY);
    } else {
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    lastPointRef.current[type] = { x, y };
  };

  const stopDraw = (type, event) => {
    const canvas = type === 'mecanico' ? canvasMecanicoRef.current : canvasArrendatarioRef.current;
    if (canvas && event?.pointerId !== undefined && canvas.releasePointerCapture) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // noop
      }
    }
    drawingRef.current[type] = false;
    lastPointRef.current[type] = null;
  };

  const clearSignature = (type) => {
    const canvas = type === 'mecanico' ? canvasMecanicoRef.current : canvasArrendatarioRef.current;
    paintCanvasBlank(canvas);
  };

  const drawSignatureFromDataUrl = (canvas, dataUrl) => {
    if (!canvas || !dataUrl) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#111827';
    };
    img.src = dataUrl;
  };

  const applySnapshotAsBase = (snapshot, fechaPorDefecto) => {
    if (!snapshot) return;
    const payload = snapshot?.payload_json || {};
    const caracteristicasBase = payload?.caracteristicas_unidad || {};
    const firmasBase = payload?.firmas || {};

    setCaracteristicas({
      marca: caracteristicasBase.marca || vehiculo?.Marca || '',
      modelo: caracteristicasBase.modelo || vehiculo?.Modelo || '',
      anio_tarjeta_circulacion: caracteristicasBase.anio_tarjeta_circulacion
        || String(vehiculo?.['A\u00f1o'] || vehiculo?.['AÃ±o'] || vehiculo?.anio_del_vehiculo || ''),
      placas: caracteristicasBase.placas || vehiculo?.Placa || '',
      color: caracteristicasBase.color || vehiculo?.Color || '',
      poliza_seguros_vigencia: caracteristicasBase.poliza_seguros_vigencia || (vehiculo?.PolizaVencimiento ? String(vehiculo.PolizaVencimiento).slice(0, 10) : ''),
      fecha_entrega: fechaPorDefecto,
      kilometraje_salida: String(
        caracteristicasBase.kilometraje_salida ??
        snapshot?.kilometraje ??
        vehiculo?.KilometrajeActual ??
        0
      )
    });

    setDescripcionSiNo({
      ...initBooleanMap(DESCRIPCION_SI_NO, 'no'),
      ...(payload?.descripcion_si_no || {})
    });
    setDescripcionEstado({
      ...initEstadoMap(DESCRIPCION_ESTADO, 'bueno'),
      ...(payload?.descripcion_estado_general || {})
    });

    const llantasBase = initLlantasMap();
    const llantasPayload = payload?.llantas || {};
    Object.keys(llantasBase).forEach((key) => {
      llantasBase[key] = {
        desgaste: llantasPayload?.[key]?.desgaste || '',
        marca: llantasPayload?.[key]?.marca || ''
      };
    });
    setLlantas(llantasBase);

    setLuces({
      ...initBooleanMap(LUCES_ROWS, 'si'),
      ...(payload?.luces || {})
    });
    setLiquidos({
      ...initEstadoMap(LIQUIDOS_ROWS, 'bueno'),
      ...(payload?.nivel_liquidos || {})
    });
    setGasolinaNivel(payload?.gasolina?.nivel || 'medio');
    setObservaciones(snapshot?.observaciones || payload?.observaciones || '');

    setFirmasMeta({
      reviso_nombre_mecanico: firmasBase?.reviso_nombre_mecanico || '',
      recibe_nombre_arrendatario: firmasBase?.recibe_nombre_arrendatario || ''
    });

    setTimeout(() => {
      resetAllCanvases();
      drawSignatureFromDataUrl(canvasMecanicoRef.current, firmasBase?.firma_mecanico_base64 || null);
      drawSignatureFromDataUrl(canvasArrendatarioRef.current, firmasBase?.firma_arrendatario_base64 || null);
    }, 0);
  };

  const registroASeleccionado = useMemo(
    () => inventarios.find((item) => String(item.id) === String(snapshotAId)) || null,
    [inventarios, snapshotAId]
  );

  const registroBSeleccionado = useMemo(
    () => inventarios.find((item) => String(item.id) === String(snapshotBId)) || null,
    [inventarios, snapshotBId]
  );

  const showInlineAlert = (message, type = 'error') => {
    const msg = String(message || '').trim();
    if (!msg) return;
    setInlineAlert({ message: msg, type });
    if (type !== 'error') {
      notify?.(msg, type);
    }
  };

  const refreshInventarios = async () => {
    if (!vehiculo?.id) return;
    setLoading(true);
    try {
      const response = await adminService.getInventariosVehiculo(vehiculo.id);
      const inventariosList = response?.inventarios || [];
      setInventarios(inventariosList);
      return inventariosList;
    } catch (error) {
      showInlineAlert(error.message || 'Error cargando inventarios', 'error');
      setInventarios([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !vehiculo?.id) return;

    const requestedTipo = initialSnapshotTipo || 'alta_inicial';
    const fallbackTipo = vehiculo?.tiene_inventario_inicial ? 'entrega_conductor' : 'alta_inicial';
    setSnapshotTipo(requestedTipo === 'alta_inicial' && vehiculo?.tiene_inventario_inicial
      ? fallbackTipo
      : requestedTipo);
    setFotos([]);
    setObservaciones('');
    setSnapshotAId('');
    setSnapshotBId('');
    setComparacion(null);
    setShowComparacionModal(false);
    setInlineAlert(null);
    baseFromAltaAppliedRef.current = false;
    setDescripcionSiNo(initBooleanMap(DESCRIPCION_SI_NO, 'no'));
    setDescripcionEstado(initEstadoMap(DESCRIPCION_ESTADO, 'bueno'));
    setLlantas(initLlantasMap());
    setLuces(initBooleanMap(LUCES_ROWS, 'si'));
    setLiquidos(initEstadoMap(LIQUIDOS_ROWS, 'bueno'));
    setGasolinaNivel('medio');
    setFirmasMeta({
      reviso_nombre_mecanico: '',
      recibe_nombre_arrendatario: ''
    });

    const fechaHoy = new Date().toISOString().slice(0, 10);
    setCaracteristicas({
      marca: vehiculo.Marca || '',
      modelo: vehiculo.Modelo || '',
      anio_tarjeta_circulacion: vehiculo.Año ? String(vehiculo.Año) : '',
      placas: vehiculo.Placa || '',
      color: vehiculo.Color || '',
      poliza_seguros_vigencia: vehiculo.PolizaVencimiento ? String(vehiculo.PolizaVencimiento).slice(0, 10) : '',
      fecha_entrega: fechaHoy,
      kilometraje_salida: String(vehiculo.KilometrajeActual || 0)
    });

    setTimeout(() => resetAllCanvases(), 0);
    refreshInventarios();
  }, [isOpen, vehiculo?.id, initialSnapshotTipo]);

  useEffect(() => {
    if (!hasAltaInicialRegistrada) return;
    if (snapshotTipo !== 'alta_inicial') return;
    setSnapshotTipo('entrega_conductor');
  }, [hasAltaInicialRegistrada, snapshotTipo]);

  useEffect(() => {
    if (!isOpen || !vehiculo?.id) return;
    if (baseFromAltaAppliedRef.current) return;
    if (!Array.isArray(inventarios) || inventarios.length === 0) return;

    const altaInicial = inventarios.find((item) => item.snapshot_tipo === 'alta_inicial');
    if (!altaInicial) return;

    applySnapshotAsBase(altaInicial, new Date().toISOString().slice(0, 10));
    baseFromAltaAppliedRef.current = true;
  }, [isOpen, vehiculo?.id, inventarios]);

  const onFileChange = (event) => {
    const selected = Array.from(event.target.files || []);
    const merged = [...fotos, ...selected].slice(0, MAX_FOTOS);
    setFotos(merged);
    event.target.value = '';
  };

  const removeFotoAt = (index) => {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  };

  const buildPayloadJson = () => ({
    caracteristicas_unidad: caracteristicas,
    descripcion_si_no: descripcionSiNo,
    descripcion_estado_general: descripcionEstado,
    llantas,
    gasolina: {
      nivel: gasolinaNivel,
      porcentaje: GASOLINA_OPTIONS.find((g) => g.value === gasolinaNivel)?.porcentaje ?? 50
    },
    luces,
    nivel_liquidos: liquidos,
    observaciones,
    firmas: {
      ...firmasMeta,
      firma_mecanico_base64: hasSignature(canvasMecanicoRef.current) ? canvasMecanicoRef.current.toDataURL('image/png') : null,
      firma_arrendatario_base64: hasSignature(canvasArrendatarioRef.current) ? canvasArrendatarioRef.current.toDataURL('image/png') : null
    }
  });

  const saveInventario = async () => {
    if (!vehiculo?.id) return;
    const snapshotTipoToSave = snapshotTipo;

    const kmSalida = Number(caracteristicas.kilometraje_salida);
    if (!Number.isFinite(kmSalida) || kmSalida < 0) {
      showInlineAlert('Kilometraje de salida invalido', 'error');
      return;
    }

    if (!caracteristicas.fecha_entrega) {
      showInlineAlert('Fecha de entrega es obligatoria', 'error');
      return;
    }

    if (!firmasMeta.reviso_nombre_mecanico.trim() || !firmasMeta.recibe_nombre_arrendatario.trim()) {
      showInlineAlert('Captura el nombre del mecanico y del arrendatario', 'error');
      return;
    }

    if (!hasSignature(canvasMecanicoRef.current) || !hasSignature(canvasArrendatarioRef.current)) {
      showInlineAlert('Debes capturar ambas firmas', 'error');
      return;
    }

    if (fotos.length === 0) {
      showInlineAlert('Debes agregar al menos una foto', 'error');
      return;
    }

    if (snapshotTipoToSave === 'alta_inicial' && hasAltaInicialRegistrada) {
      showInlineAlert('Este vehiculo ya tiene un inventario inicial registrado', 'error');
      return;
    }

    setSaving(true);
    try {
      setInlineAlert(null);
      const formData = new FormData();
      formData.append('snapshot_tipo', snapshotTipoToSave);
      formData.append('estado', 'completado');
      formData.append('fecha_evento', caracteristicas.fecha_entrega);
      formData.append('kilometraje', String(Math.round(kmSalida)));
      formData.append('observaciones', observaciones || '');
      formData.append('payload_json', JSON.stringify(buildPayloadJson()));

      fotos.forEach((file) => {
        formData.append('fotos', file);
      });

      await adminService.createInventarioVehiculo(vehiculo.id, formData);

      notify?.(
        snapshotTipoToSave === 'alta_inicial'
          ? 'Inventario inicial guardado'
          : snapshotTipoToSave === 'devolucion_conductor'
            ? 'Regreso del conductor guardado'
          : 'Registro de inventario guardado',
        'success'
      );

      await refreshInventarios();
      if (onSaved) {
        await Promise.resolve(onSaved());
      }

      setObservaciones('');
      setFotos([]);
      setFirmasMeta({
        reviso_nombre_mecanico: '',
        recibe_nombre_arrendatario: ''
      });
      resetAllCanvases();
    } catch (error) {
      showInlineAlert(error.message || 'No se pudo guardar el inventario', 'error');
    } finally {
      setSaving(false);
    }
  };

  const compararSnapshots = async () => {
    if (!vehiculo?.id) return;
    if (!snapshotAId || !snapshotBId) {
      showInlineAlert('Selecciona dos registros para comparar', 'error');
      return;
    }
    if (String(snapshotAId) === String(snapshotBId)) {
      showInlineAlert('Debes seleccionar dos registros distintos', 'error');
      return;
    }

    setComparando(true);
    try {
      setInlineAlert(null);
      const response = await adminService.compararInventariosVehiculo(
        vehiculo.id,
        Number(snapshotAId),
        Number(snapshotBId)
      );
      const cambiosFiltrados = (response?.cambios || []).filter(
        (cambio) => !String(cambio?.campo || '').startsWith('firmas.')
      );
      setComparacion({
        ...response,
        cambios: cambiosFiltrados,
        total_cambios: cambiosFiltrados.length
      });
      setShowComparacionModal(true);
    } catch (error) {
      showInlineAlert(error.message || 'No se pudieron comparar los registros', 'error');
      setComparacion(null);
      setShowComparacionModal(false);
    } finally {
      setComparando(false);
    }
  };

  const normalizarInventarioParaPDF = (snapshot) => {
    const payload = snapshot?.payload_json || {};
    return {
      tipo: snapshot?.snapshot_tipo || snapshotTipo,
      numero: snapshot?.snapshot_numero || 1,
      estado: snapshot?.estado || 'completado',
      fecha_evento: snapshot?.fecha_evento || caracteristicas.fecha_entrega || null,
      kilometraje: snapshot?.kilometraje ?? Number(caracteristicas.kilometraje_salida || 0),
      observaciones: snapshot?.observaciones ?? observaciones ?? '',
      caracteristicas_unidad: payload.caracteristicas_unidad || caracteristicas || {},
      descripcion_si_no: payload.descripcion_si_no || descripcionSiNo || {},
      descripcion_estado_general: payload.descripcion_estado_general || descripcionEstado || {},
      llantas: payload.llantas || llantas || {},
      gasolina: payload.gasolina || {
        nivel: gasolinaNivel,
        porcentaje: GASOLINA_OPTIONS.find((g) => g.value === gasolinaNivel)?.porcentaje ?? 50
      },
      luces: payload.luces || luces || {},
      nivel_liquidos: payload.nivel_liquidos || liquidos || {},
      firmas: payload.firmas || firmasMeta || {},
      fotos_urls_json: snapshot?.fotos_urls_json || []
    };
  };

  const exportarInventarioPDF = async (snapshot = null) => {
    try {
      const snapshotId = snapshot?.id || null;
      if (snapshotId) setExportandoId(snapshotId);

      const data = normalizarInventarioParaPDF(snapshot);
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const fechaImp = new Date().toLocaleDateString('es-MX');
      const tipoLabel = getTipoLabel(data.tipo);
      const numeroVehiculo = vehiculo?.NumeroVehiculo || vehiculo?.numero_vehiculo || `#${vehiculo?.id || ''}`;

      doc.setLineWidth(0.4);
      doc.rect(7, 7, 196, 282);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('INVENTARIO DE UNIDAD', 105, 12, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Vehiculo: ${numeroVehiculo}`, 10, 18);
      doc.text(`Tipo: ${tipoLabel}`, 10, 23);
      doc.text(`Registro: #${data.numero} (${data.estado})`, 70, 23);
      doc.text(`Fecha evento: ${data.fecha_evento ? new Date(data.fecha_evento).toLocaleDateString('es-MX') : 'N/A'}`, 130, 23);
      doc.text(`Fecha impresion: ${fechaImp}`, 160, 18);
      doc.text(`Kilometraje: ${(Number(data.kilometraje) || 0).toLocaleString('es-MX')} km`, 10, 28);

      let y = 32;

      autoTable(doc, {
        startY: y,
        theme: 'grid',
        head: [['Caracteristica', 'Valor']],
        body: [
          ['Marca', data.caracteristicas_unidad?.marca || ''],
          ['Modelo', data.caracteristicas_unidad?.modelo || ''],
          ['Anio tarjeta circulacion', data.caracteristicas_unidad?.anio_tarjeta_circulacion || ''],
          ['Placas', data.caracteristicas_unidad?.placas || ''],
          ['Color', data.caracteristicas_unidad?.color || ''],
          ['Poliza vigencia', data.caracteristicas_unidad?.poliza_seguros_vigencia || ''],
          ['Fecha entrega', data.caracteristicas_unidad?.fecha_entrega || '']
        ],
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [23, 37, 84] }
      });
      y = doc.lastAutoTable.finalY + 3;

      autoTable(doc, {
        startY: y,
        theme: 'grid',
        head: [['Descripcion (SI / NO)', 'Estado']],
        body: Object.entries(data.descripcion_si_no || {}).map(([k, v]) => [LABELS_SI_NO[k] || k, String(v || '').toUpperCase()]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [31, 41, 55] }
      });
      y = doc.lastAutoTable.finalY + 3;

      autoTable(doc, {
        startY: y,
        theme: 'grid',
        head: [['Descripcion estado general', 'Estado']],
        body: Object.entries(data.descripcion_estado_general || {}).map(([k, v]) => [LABELS_ESTADO[k] || k, String(v || '').toUpperCase()]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [55, 65, 81] }
      });
      y = doc.lastAutoTable.finalY + 3;

      const yLlantasStart = y;
      autoTable(doc, {
        startY: yLlantasStart,
        theme: 'grid',
        head: [['Llantas', 'Desgaste', 'Marca']],
        body: Object.entries(data.llantas || {}).map(([k, val]) => [
          LABELS_LLANTAS[k] || k,
          val?.desgaste || '',
          val?.marca || ''
        ]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [15, 23, 42] },
        margin: { right: 75 }
      });

      // Columna visual de gasolina al lado derecho (estilo formato físico)
      const gasolinaX = 140;
      const gasolinaY = yLlantasStart;
      const gasolinaW = 55;
      const gasolinaH = 46;
      const gasolinaPct = Math.max(0, Math.min(100, getGasolinaPorcentaje(data.gasolina)));
      doc.setDrawColor(80);
      doc.rect(gasolinaX, gasolinaY, gasolinaW, gasolinaH);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('GASOLINA', gasolinaX + gasolinaW / 2, gasolinaY + 5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('E', gasolinaX + 4, gasolinaY + gasolinaH - 6);
      doc.text('F', gasolinaX + gasolinaW - 6, gasolinaY + gasolinaH - 6);
      // Barra horizontal
      const barX = gasolinaX + 8;
      const barY = gasolinaY + gasolinaH - 10;
      const barW = gasolinaW - 16;
      doc.rect(barX, barY, barW, 3);
      doc.setFillColor(220, 38, 38);
      doc.rect(barX, barY, (barW * gasolinaPct) / 100, 3, 'F');
      // Aguja simple (lineal) para máxima compatibilidad con jsPDF
      const cx = gasolinaX + gasolinaW / 2;
      const cy = gasolinaY + 24;
      const nx = gasolinaX + 8 + ((gasolinaW - 16) * gasolinaPct) / 100;
      const ny = cy - 8;
      doc.setDrawColor(220, 38, 38);
      doc.line(cx, cy, nx, ny);
      doc.setFillColor(30, 30, 30);
      doc.circle(cx, cy, 1.2, 'F');
      doc.text(`Nivel: ${String(data.gasolina?.nivel || '').toUpperCase()}`, gasolinaX + 4, gasolinaY + gasolinaH - 1.5);
      doc.text(`${gasolinaPct}%`, gasolinaX + gasolinaW - 10, gasolinaY + gasolinaH - 1.5);

      y = Math.max(doc.lastAutoTable.finalY, gasolinaY + gasolinaH) + 3;

      autoTable(doc, {
        startY: y,
        theme: 'grid',
        head: [['Luces', 'SI/NO']],
        body: Object.entries(data.luces || {}).map(([k, v]) => [LABELS_LUCES[k] || k, String(v || '').toUpperCase()]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [67, 56, 202] }
      });
      y = doc.lastAutoTable.finalY + 3;

      if (y > 245) {
        doc.addPage();
        y = 15;
      }

      autoTable(doc, {
        startY: y,
        theme: 'grid',
        head: [['Nivel de liquidos', 'Estado']],
        body: Object.entries(data.nivel_liquidos || {}).map(([k, v]) => [LABELS_LIQUIDOS[k] || k, String(v || '').toUpperCase()]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [146, 64, 14] }
      });
      y = doc.lastAutoTable.finalY + 3;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Observaciones:', 10, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const obs = doc.splitTextToSize(data.observaciones || 'N/A', 190);
      doc.text(obs, 10, y + 4);
      y += (obs.length * 4) + 6;

      const firmaMecanico = data.firmas?.firma_mecanico_base64 || null;
      const firmaArrendatario = data.firmas?.firma_arrendatario_base64 || null;
      const nombreMecanico = data.firmas?.reviso_nombre_mecanico || 'N/A';
      const nombreArrendatario = data.firmas?.recibe_nombre_arrendatario || 'N/A';
      const totalFotos = Array.isArray(data.fotos_urls_json) ? data.fotos_urls_json.length : 0;

      autoTable(doc, {
        startY: y,
        theme: 'grid',
        head: [['Firmas y evidencia', 'Valor']],
        body: [
          ['Reviso (mecanico)', nombreMecanico],
          ['Firma mecanico capturada', firmaMecanico ? 'SI' : 'NO'],
          ['Recibe (arrendatario)', nombreArrendatario],
          ['Firma arrendatario capturada', firmaArrendatario ? 'SI' : 'NO'],
          ['Total de fotos', String(totalFotos)]
        ],
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [91, 33, 182] }
      });
      y = doc.lastAutoTable.finalY + 5;

      if (y > 235) {
        doc.addPage();
        y = 18;
      }

      const boxW = 86;
      const boxH = 28;
      const leftX = 10;
      const rightX = 110;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Firma mecanico', leftX, y - 1);
      doc.text('Firma arrendatario', rightX, y - 1);

      doc.rect(leftX, y, boxW, boxH);
      doc.rect(rightX, y, boxW, boxH);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Nombre: ${nombreMecanico}`, leftX, y + boxH + 4);
      doc.text(`Nombre: ${nombreArrendatario}`, rightX, y + boxH + 4);

      if (firmaMecanico) {
        try {
          const firmaBlob = dataUrlToBlob(firmaMecanico);
          if (firmaBlob.size > 0) {
            doc.addImage(firmaMecanico, 'PNG', leftX + 2, y + 2, boxW - 4, boxH - 4);
          }
        } catch {
          // noop
        }
      }

      if (firmaArrendatario) {
        try {
          const firmaBlob = dataUrlToBlob(firmaArrendatario);
          if (firmaBlob.size > 0) {
            doc.addImage(firmaArrendatario, 'PNG', rightX + 2, y + 2, boxW - 4, boxH - 4);
          }
        } catch {
          // noop
        }
      }

      const fileName = `Inventario_${numeroVehiculo}_${data.tipo}_S${data.numero}.pdf`.replace(/\s+/g, '_');
      doc.save(fileName);
    } catch (error) {
      showInlineAlert(error?.message || 'No se pudo exportar el PDF de inventario', 'error');
    } finally {
      setExportandoId(null);
    }
  };

  if (!isOpen || !vehiculo) return null;

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-[71] overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-7xl h-[92vh] max-h-[calc(100vh-1.5rem)] glass rounded-xl border border-primary/20 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-primary/20 bg-surface/90">
              <div>
                <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-primary" />
                  Llenar inventario
                </h3>
                <p className="text-xs text-gray-400">{vehiculoLabel}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inlineAlert && (
              <div className={`mx-4 mt-3 rounded-lg border px-3 py-2 flex items-start justify-between gap-3 ${
                inlineAlert.type === 'error'
                  ? 'bg-red-500/10 border-red-500/30 text-red-200'
                  : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-100'
              }`}>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-sm">{inlineAlert.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInlineAlert(null)}
                  className="text-xs px-2 py-1 rounded border border-white/20 hover:bg-white/10"
                >
                  Cerrar
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-4 flex-1 min-h-0">
              <div className="xl:col-span-3 p-4 overflow-y-auto min-h-0 space-y-4 border-r border-primary/10">
                <div className="glass rounded-lg border border-primary/20 p-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Tipo de registro</label>
                      <select
                        value={snapshotTipo}
                        onChange={(e) => setSnapshotTipo(e.target.value)}
                        className="w-full bg-dark/50 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm"
                      >
                        {tiposInventarioDisponibles.map((tipo) => (
                          <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Marca</label>
                      <input
                        value={caracteristicas.marca}
                        onChange={(e) => setCaracteristicas((p) => ({ ...p, marca: e.target.value }))}
                        className="w-full bg-dark/50 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Modelo</label>
                      <input
                        value={caracteristicas.modelo}
                        onChange={(e) => setCaracteristicas((p) => ({ ...p, modelo: e.target.value }))}
                        className="w-full bg-dark/50 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Tarjeta circulacion (anio)</label>
                      <input
                        value={caracteristicas.anio_tarjeta_circulacion}
                        onChange={(e) => setCaracteristicas((p) => ({ ...p, anio_tarjeta_circulacion: e.target.value }))}
                        className="w-full bg-dark/50 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Placas</label>
                      <input
                        value={caracteristicas.placas}
                        onChange={(e) => setCaracteristicas((p) => ({ ...p, placas: e.target.value }))}
                        className="w-full bg-dark/50 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Color</label>
                      <input
                        value={caracteristicas.color}
                        onChange={(e) => setCaracteristicas((p) => ({ ...p, color: e.target.value }))}
                        className="w-full bg-dark/50 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Poliza seguros vigencia</label>
                      <input
                        type="date"
                        value={caracteristicas.poliza_seguros_vigencia}
                        onChange={(e) => setCaracteristicas((p) => ({ ...p, poliza_seguros_vigencia: e.target.value }))}
                        className="w-full bg-dark/50 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Fecha de entrega</label>
                      <input
                        type="date"
                        value={caracteristicas.fecha_entrega}
                        onChange={(e) => setCaracteristicas((p) => ({ ...p, fecha_entrega: e.target.value }))}
                        className="w-full bg-dark/50 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Kilometraje salida</label>
                      <input
                        type="number"
                        min="0"
                        value={caracteristicas.kilometraje_salida}
                        onChange={(e) => setCaracteristicas((p) => ({ ...p, kilometraje_salida: e.target.value }))}
                        className="w-full bg-dark/50 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="glass rounded-lg border border-primary/20 p-3">
                  <p className="text-sm text-white mb-2">Descripcion (SI/NO)</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {DESCRIPCION_SI_NO.map((item) => {
                      const key = toKey(item);
                      return (
                        <div key={key} className="flex items-center justify-between gap-2 bg-black/20 rounded px-2 py-1.5">
                          <span className="text-xs text-gray-200">{item}</span>
                          <select
                            value={descripcionSiNo[key]}
                            onChange={(e) => setDescripcionSiNo((p) => ({ ...p, [key]: e.target.value }))}
                            className="bg-dark/60 border border-primary/20 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="si">SI</option>
                            <option value="no">NO</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="glass rounded-lg border border-primary/20 p-3">
                  <p className="text-sm text-white mb-2">Descripcion (BUENO/REGULAR/MALO)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {DESCRIPCION_ESTADO.map((item) => {
                      const key = toKey(item);
                      return (
                        <div key={key} className="flex items-center justify-between gap-2 bg-black/20 rounded px-2 py-1.5">
                          <span className="text-xs text-gray-200">{item}</span>
                          <select
                            value={descripcionEstado[key]}
                            onChange={(e) => setDescripcionEstado((p) => ({ ...p, [key]: e.target.value }))}
                            className="bg-dark/60 border border-primary/20 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="bueno">BUENO</option>
                            <option value="regular">REGULAR</option>
                            <option value="malo">MALO</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="glass rounded-lg border border-primary/20 p-3">
                  <p className="text-sm text-white mb-2">Llantas (Desgaste / Marca)</p>
                  <div className="space-y-2">
                    {LLANTAS_ROWS.map((item) => {
                      const key = toKey(item);
                      return (
                        <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                          <span className="text-xs text-gray-200">{item}</span>
                          <input
                            value={llantas[key].desgaste}
                            onChange={(e) => setLlantas((p) => ({ ...p, [key]: { ...p[key], desgaste: e.target.value } }))}
                            placeholder="Desgaste"
                            className="bg-dark/50 border border-primary/20 rounded px-2 py-1.5 text-xs text-white"
                          />
                          <input
                            value={llantas[key].marca}
                            onChange={(e) => setLlantas((p) => ({ ...p, [key]: { ...p[key], marca: e.target.value } }))}
                            placeholder="Marca"
                            className="bg-dark/50 border border-primary/20 rounded px-2 py-1.5 text-xs text-white"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="glass rounded-lg border border-primary/20 p-3">
                  <p className="text-sm text-white mb-2">Gasolina</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Nivel</label>
                      <select
                        value={gasolinaNivel}
                        onChange={(e) => setGasolinaNivel(e.target.value)}
                        className="w-full bg-dark/60 border border-primary/20 rounded px-2 py-2 text-sm text-white"
                      >
                        {GASOLINA_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="bg-black/20 rounded-lg border border-primary/10 px-3 py-2">
                      <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                        <span>E</span>
                        <span>F</span>
                      </div>
                      <div className="h-2 rounded bg-slate-700/70 overflow-hidden">
                        <div
                          className="h-2 bg-green-400 transition-all"
                          style={{ width: `${GASOLINA_OPTIONS.find((g) => g.value === gasolinaNivel)?.porcentaje ?? 50}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-lg border border-primary/20 p-3">
                  <p className="text-sm text-white mb-2">Luces (Funcionamiento SI/NO)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {LUCES_ROWS.map((item) => {
                      const key = toKey(item);
                      return (
                        <div key={key} className="flex items-center justify-between gap-2 bg-black/20 rounded px-2 py-1.5">
                          <span className="text-xs text-gray-200">{item}</span>
                          <select
                            value={luces[key]}
                            onChange={(e) => setLuces((p) => ({ ...p, [key]: e.target.value }))}
                            className="bg-dark/60 border border-primary/20 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="si">SI</option>
                            <option value="no">NO</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="glass rounded-lg border border-primary/20 p-3">
                  <p className="text-sm text-white mb-2">Nivel de liquidos (BUENO/MALO)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {LIQUIDOS_ROWS.map((item) => {
                      const key = toKey(item);
                      return (
                        <div key={key} className="flex items-center justify-between gap-2 bg-black/20 rounded px-2 py-1.5">
                          <span className="text-xs text-gray-200">{item}</span>
                          <select
                            value={liquidos[key]}
                            onChange={(e) => setLiquidos((p) => ({ ...p, [key]: e.target.value }))}
                            className="bg-dark/60 border border-primary/20 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="bueno">BUENO</option>
                            <option value="malo">MALO</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="glass rounded-lg border border-primary/20 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-white flex items-center gap-2">
                      <Camera className="w-4 h-4 text-primary" />
                      Evidencia fotografica
                    </p>
                    <span className="text-xs text-gray-400">{fotos.length}/{MAX_FOTOS}</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={onFileChange}
                    disabled={fotos.length >= MAX_FOTOS}
                    className="w-full text-xs text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-primary/20 file:text-primary file:px-3 file:py-2"
                  />
                  <div className="mt-2 space-y-1">
                    {fotos.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between text-xs text-gray-300 bg-black/20 rounded px-2 py-1">
                        <span className="truncate">{file.name}</span>
                        <button onClick={() => removeFotoAt(index)} className="text-red-300 hover:text-red-200">
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass rounded-lg border border-primary/20 p-3">
                  <p className="text-sm text-white mb-2">Observaciones</p>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={3}
                    className="w-full bg-dark/50 border border-primary/20 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>

                <div className="glass rounded-lg border border-primary/20 p-3 space-y-3">
                  <div>
                    <p className="text-sm text-white flex items-center gap-2 mb-1">
                      <Signature className="w-4 h-4 text-primary" />
                      Reviso (Nombre y firma del mecanico)
                    </p>
                    <input
                      value={firmasMeta.reviso_nombre_mecanico}
                      onChange={(e) => setFirmasMeta((p) => ({ ...p, reviso_nombre_mecanico: e.target.value }))}
                      placeholder="Nombre del mecanico"
                      className="w-full bg-dark/50 border border-primary/20 rounded-lg px-3 py-2 text-sm text-white mb-2"
                    />
                    <div className="flex items-center justify-end mb-1">
                      <button onClick={() => clearSignature('mecanico')} className="text-xs text-gray-300 hover:text-white">
                        Limpiar firma mecanico
                      </button>
                    </div>
                    <canvas
                      ref={canvasMecanicoRef}
                      width={900}
                      height={180}
                      onPointerDown={(e) => startDraw('mecanico', e)}
                      onPointerMove={(e) => draw('mecanico', e)}
                      onPointerUp={(e) => stopDraw('mecanico', e)}
                      onPointerLeave={(e) => stopDraw('mecanico', e)}
                      className="w-full h-28 bg-white rounded border border-primary/20 touch-none"
                      style={{ cursor: 'crosshair' }}
                    />
                  </div>

                  <div>
                    <p className="text-sm text-white flex items-center gap-2 mb-1">
                      <Signature className="w-4 h-4 text-primary" />
                      Recibe vehiculo (Nombre y firma del arrendatario)
                    </p>
                    <input
                      value={firmasMeta.recibe_nombre_arrendatario}
                      onChange={(e) => setFirmasMeta((p) => ({ ...p, recibe_nombre_arrendatario: e.target.value }))}
                      placeholder="Nombre del arrendatario / chofer"
                      className="w-full bg-dark/50 border border-primary/20 rounded-lg px-3 py-2 text-sm text-white mb-2"
                    />
                    <div className="flex items-center justify-end mb-1">
                      <button onClick={() => clearSignature('arrendatario')} className="text-xs text-gray-300 hover:text-white">
                        Limpiar firma arrendatario
                      </button>
                    </div>
                    <canvas
                      ref={canvasArrendatarioRef}
                      width={900}
                      height={180}
                      onPointerDown={(e) => startDraw('arrendatario', e)}
                      onPointerMove={(e) => draw('arrendatario', e)}
                      onPointerUp={(e) => stopDraw('arrendatario', e)}
                      onPointerLeave={(e) => stopDraw('arrendatario', e)}
                      className="w-full h-28 bg-white rounded border border-primary/20 touch-none"
                      style={{ cursor: 'crosshair' }}
                    />
                  </div>
                </div>

                <div className="sticky bottom-0 z-10 bg-surface/95 backdrop-blur px-2 py-2 border-t border-primary/20">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => saveInventario()}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-60 flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {snapshotTipo === 'alta_inicial' ? 'Guardar inventario inicial' : 'Guardar registro'}
                    </button>
                    <button
                      onClick={() => exportarInventarioPDF(null)}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 disabled:opacity-60 flex items-center gap-2"
                    >
                      Exportar PDF
                    </button>
                    {saving && <span className="text-xs text-gray-400 self-center">Procesando...</span>}
                  </div>
                </div>
              </div>

              <div className="p-4 overflow-y-auto min-h-0 bg-surface/30">
                <p className="text-white text-sm font-semibold mb-3">Historial de registros</p>
                {loading ? (
                  <p className="text-xs text-gray-400">Cargando...</p>
                ) : inventariosHistorial.length === 0 ? (
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Sin inventarios registrados.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {inventariosHistorial.map((item) => (
                      <div key={item.id} className="rounded-lg border border-primary/20 bg-black/20 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm text-gray-100">{getTipoLabel(item.snapshot_tipo)}</p>
                            <p className="text-[11px] text-gray-400">Registro #{item.snapshot_numero}</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getEstadoBadge(item.estado)}`}>
                            {getEstadoLabel(item.estado)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                          Fecha: {item.fecha_evento ? new Date(item.fecha_evento).toLocaleDateString('es-MX') : 'N/A'}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          Km: {(item.kilometraje || 0).toLocaleString('es-MX')}
                        </p>
                        <button
                          type="button"
                          onClick={() => exportarInventarioPDF(item)}
                          disabled={exportandoId === item.id}
                          className="mt-2 text-[10px] px-2 py-1 rounded border border-blue-400/30 text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
                        >
                          {exportandoId === item.id ? 'Exportando...' : 'PDF'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {inventarios.length >= 2 && (
                  <div className="mt-4 pt-4 border-t border-primary/20">
                    <p className="text-white text-sm font-semibold mb-2">Comparar registros</p>
                    <div className="space-y-2">
                      <select
                        value={snapshotAId}
                        onChange={(e) => setSnapshotAId(e.target.value)}
                        className="w-full bg-dark/50 border border-primary/20 rounded-lg px-2 py-2 text-xs text-white"
                      >
                        <option value="">Registro A</option>
                        {inventarios.map((item) => (
                          <option key={`a_${item.id}`} value={item.id}>
                            #{item.snapshot_numero} - {getTipoLabel(item.snapshot_tipo)} ({getEstadoLabel(item.estado)})
                          </option>
                        ))}
                      </select>
                      <select
                        value={snapshotBId}
                        onChange={(e) => setSnapshotBId(e.target.value)}
                        className="w-full bg-dark/50 border border-primary/20 rounded-lg px-2 py-2 text-xs text-white"
                      >
                        <option value="">Registro B</option>
                        {inventarios.map((item) => (
                          <option key={`b_${item.id}`} value={item.id}>
                            #{item.snapshot_numero} - {getTipoLabel(item.snapshot_tipo)} ({getEstadoLabel(item.estado)})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={compararSnapshots}
                        disabled={comparando}
                        className="w-full px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-60 text-xs font-medium"
                      >
                        {comparando ? 'Comparando...' : 'Comparar'}
                      </button>
                    </div>

                    {comparacion && (
                      <div className="mt-3 rounded-lg border border-primary/20 bg-black/20 p-2">
                        <p className="text-[11px] text-gray-300 mb-2">
                          Cambios detectados: {comparacion.total_cambios || 0}
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowComparacionModal(true)}
                          className="w-full text-[11px] px-2 py-1.5 rounded border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/20"
                        >
                          Ver comparativa completa
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showComparacionModal && (
        <>
          <div
            className="fixed inset-0 z-[72] bg-black/75 backdrop-blur-sm"
            onClick={() => setShowComparacionModal(false)}
          />
          <div className="fixed inset-0 z-[73] overflow-y-auto">
            <div className="min-h-full flex items-center justify-center p-4">
              <div className="w-full max-w-5xl max-h-[90vh] glass rounded-xl border border-primary/20 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-primary/20 bg-surface/90">
                  <div>
                    <h4 className="text-white font-semibold text-lg">Comparativa de registros</h4>
                    <p className="text-xs text-gray-400">
                      Cambios detectados: {comparacion?.total_cambios || 0}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowComparacionModal(false)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-4 py-3 border-b border-primary/15 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="rounded-lg border border-primary/20 bg-black/20 p-2">
                    <p className="text-[11px] text-gray-400">Registro A</p>
                    <p className="text-sm text-white">
                      {registroASeleccionado
                        ? `#${registroASeleccionado.snapshot_numero} - ${getTipoLabel(registroASeleccionado.snapshot_tipo)} (${getEstadoLabel(registroASeleccionado.estado)})`
                        : 'No seleccionado'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-black/20 p-2">
                    <p className="text-[11px] text-gray-400">Registro B</p>
                    <p className="text-sm text-white">
                      {registroBSeleccionado
                        ? `#${registroBSeleccionado.snapshot_numero} - ${getTipoLabel(registroBSeleccionado.snapshot_tipo)} (${getEstadoLabel(registroBSeleccionado.estado)})`
                        : 'No seleccionado'}
                    </p>
                  </div>
                </div>

                <div className="p-4 overflow-y-auto">
                  {(comparacion?.cambios || []).length === 0 ? (
                    <p className="text-sm text-green-300">Sin diferencias entre los registros seleccionados.</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(cambiosAgrupados).map(([seccion, cambios]) => (
                        <div key={seccion} className="rounded-lg border border-primary/20 p-3 bg-black/20">
                          <p className="text-sm text-primary font-semibold mb-2">{seccion}</p>
                          <div className="space-y-2">
                            {cambios.map((cambio, idx) => (
                              <div
                                key={`${cambio.campo}_${idx}`}
                                className={`rounded border p-3 ${
                                  esCambioCritico(cambio.campo)
                                    ? 'border-orange-400/40 bg-orange-500/10'
                                    : 'border-primary/15'
                                }`}
                              >
                                <p className={`text-sm ${
                                  esCambioCritico(cambio.campo)
                                    ? 'text-orange-200 font-semibold'
                                    : 'text-cyan-200'
                                }`}
                                >
                                  {getEtiquetaCampo(cambio.campo)}
                                  {esCambioCritico(cambio.campo) ? ' (critico)' : ''}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                  <div className="rounded bg-black/25 p-2 border border-white/5">
                                    <p className="text-[11px] text-gray-400">Valor A</p>
                                    <p className="text-xs text-gray-200 break-words">
                                      {typeof cambio.valor_anterior === 'object'
                                        ? JSON.stringify(cambio.valor_anterior)
                                        : String(cambio.valor_anterior ?? '')}
                                    </p>
                                  </div>
                                  <div className="rounded bg-black/25 p-2 border border-white/5">
                                    <p className="text-[11px] text-gray-400">Valor B</p>
                                    <p className="text-xs text-gray-100 break-words">
                                      {typeof cambio.valor_nuevo === 'object'
                                        ? JSON.stringify(cambio.valor_nuevo)
                                        : String(cambio.valor_nuevo ?? '')}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default InventarioModal;
