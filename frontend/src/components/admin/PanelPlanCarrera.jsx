// frontend/src/components/admin/PanelPlanCarrera.jsx
import React, { useState, useEffect } from 'react';
import { 
  Award, AlertTriangle, TrendingUp, Calendar, 
  CheckCircle, Plus, Eye, Clock, XCircle 
} from 'lucide-react';
import adminService from '../../services/adminService';

const PanelPlanCarrera = ({ conductor, onRefresh }) => {
  const [amonestaciones, setAmonestaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModalAmonestar, setShowModalAmonestar] = useState(false);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    if (conductor?.id) {
      cargarAmonestaciones();
    }
  }, [conductor?.id]);

  const cargarAmonestaciones = async () => {
    try {
      setLoading(true);
      const response = await adminService.getAmonestaciones(conductor.id);
      setAmonestaciones(response.amonestaciones || []);
    } catch (error) {
      console.error('Error al cargar amonestaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePromover = async () => {
  const categoriaInfo = getCategoriaInfo(conductor?.categoria);
  
  if (!categoriaInfo.siguiente) {
    alert('Este conductor ya alcanzó la categoría máxima');
    return;
  }
  
  if (!window.confirm(`¿Está seguro de promover a este conductor a ${categoriaInfo.siguiente}?`)) {
    return;
  }

    try {
      setPromoting(true);
      const response = await adminService.promoverASocioDueno(conductor.id);
      
      if (response.success) {
        alert(response.message);
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      console.error('Error al promover:', error);
      alert(error.message || 'Error al promover al conductor');
    } finally {
      setPromoting(false);
    }
  };

  const calcularDiasPrueba = () => {
    if (!conductor?.fecha_ingreso) return { dias: 0, progreso: 0 };
    
    const fechaIngreso = new Date(conductor.fecha_ingreso);
    const ahora = new Date();
    const diferencia = ahora - fechaIngreso;
    const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
    const progreso = Math.min((dias / 60) * 100, 100);
    
    return { dias: Math.min(dias, 60), progreso };
  };

  const getGravedadColor = (gravedad) => {
    const colores = {
      'leve': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'moderada': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'grave': 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return colores[gravedad] || colores.leve;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const { dias, progreso } = calcularDiasPrueba();
  const totalAmonestaciones = amonestaciones.length;
  const getCategoriaInfo = (categoria) => {
    const categorias = {
      'B': { nombre: 'Oro', color: 'from-yellow-500 to-amber-600', icon: '🥇', siguiente: 'Platino' },
      'Oro': { nombre: 'Oro', color: 'from-yellow-500 to-amber-600', icon: '🥇', siguiente: 'Platino' },
      'Platino': { nombre: 'Platino', color: 'from-gray-400 to-gray-600', icon: '🥈', siguiente: 'Diamante' },
      'Diamante': { nombre: 'Diamante', color: 'from-blue-400 to-cyan-600', icon: '💎', siguiente: 'Socio Dueño' },
      'Socio Dueño': { nombre: 'Socio Dueño', color: 'from-purple-500 to-pink-600', icon: '👑', siguiente: null }
    };
    return categorias[categoria] || categorias['Oro'];
  };


 const categoriaInfo = getCategoriaInfo(conductor?.categoria);
  const tieneAmonestaciones = totalAmonestaciones > 0;
  const puedePromover =
    conductor?.status === 'Aprobado' &&
    !tieneAmonestaciones &&
    conductor?.categoria !== 'Socio Dueño';

  const requisitosHabitos = [
    'Asistir a las tres revisiones para asegurar limpieza y buenas condiciones del vehículo.',
    'Pagar las rentas a tiempo sin acumular amonestaciones.',
    'Agendar el servicio mecánico oportunamente antes del servicio programado.',
    'No tener amonestaciones por carro sucio o rentas atrasadas.',
    'Mantener la documentación completa y vigente (licencia, póliza y tarjeta de circulación).'
  ];

  const ascensos = [
    {
      titulo: 'Oro → Platino',
      detalle:
        'Cumplir 90 días seguidos con limpieza, documentación completa, servicios mecánicos anticipados y pago de rentas completas.'
    },
    {
      titulo: 'Platino → Diamante',
      detalle:
        'Mantener los mismos requisitos; si el conductor elige usar uniforme, sube a Diamante. Sin uniforme permanece en Platino. Puede ascender el mes siguiente si continúa cumpliendo.'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header con Estadísticas Clave */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
       {/* Categoría Actual */}
<div className={`backdrop-blur-xl bg-gradient-to-br ${categoriaInfo.color} bg-opacity-20 rounded-2xl border border-white/20 p-6`}>
  <div className="flex items-center gap-3 mb-2">
    <span className="text-3xl">{categoriaInfo.icon}</span>
    <div className="flex-1">
      <p className="text-gray-300 text-sm">Categoría Actual</p>
      <p className="text-3xl font-bold text-white">
        {categoriaInfo.nombre}
      </p>
    </div>
  </div>
  {conductor?.fecha_ultimo_ascenso && (
    <p className="text-gray-400 text-xs mt-2">
      Último ascenso: {formatDate(conductor.fecha_ultimo_ascenso)}
    </p>
  )}
  {categoriaInfo.siguiente && (
    <div className="mt-3 pt-3 border-t border-white/10">
      <p className="text-xs text-gray-400">
        Próxima categoría: <span className="text-white font-semibold">{categoriaInfo.siguiente}</span>
      </p>
    </div>
  )}
</div>

        {/* Días de Prueba */}
        <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-6 h-6 text-cyan-400" />
            <p className="text-gray-400 text-sm">Días de Prueba</p>
          </div>
          <p className="text-3xl font-bold text-white">
            {dias} <span className="text-lg text-gray-400">/ 60</span>
          </p>
          <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
              style={{ width: `${progreso}%` }}
            />
          </div>
        </div>

        {/* Amonestaciones */}
        <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            <p className="text-gray-400 text-sm">Amonestaciones</p>
          </div>
          <p className="text-3xl font-bold text-white">
            {totalAmonestaciones} <span className="text-lg text-gray-400">/ 3</span>
          </p>
          <div className="mt-3 flex gap-1">
            {[1, 2, 3].map((num) => (
              <div 
                key={num}
                className={`flex-1 h-2 rounded-full ${
                  num <= totalAmonestaciones 
                    ? 'bg-red-500' 
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Requisitos y plan de ascenso */}
      <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-cyan-400" />
          Requisitos para hábitos y ascensos
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-gray-300 font-semibold mb-3">Formación de hábitos</p>
            <ul className="space-y-2 text-sm text-gray-300">
              {requisitosHabitos.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-gray-300 font-semibold mb-3">Ascensos del plan de carrera</p>
            <div className="space-y-3">
              {ascensos.map((ascenso, index) => (
                <div key={index} className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="w-4 h-4 text-yellow-400" />
                    <span className="text-white font-semibold text-sm">{ascenso.titulo}</span>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">{ascenso.detalle}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Acciones Principales */}
      <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
        <h3 className="text-xl font-bold text-white mb-4">Acciones del Plan de Carrera</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Botón Promover */}
          <button
            onClick={handlePromover}
            disabled={!puedePromover || promoting}
            className={`flex items-center justify-center gap-3 p-4 rounded-xl transition-all ${
              puedePromover && !promoting
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg'
                : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
            }`}
          >
            {promoting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                <span>Promoviendo...</span>
              </>
            ) : (
              <>
                <Award className="w-5 h-5" />
                <span className="font-semibold">
  {categoriaInfo.siguiente ? `Promover a ${categoriaInfo.siguiente}` : 'Máxima categoría alcanzada'}
</span>              </>
            )}
          </button>

          {/* Botón Amonestar */}
          <button
            onClick={() => setShowModalAmonestar(true)}
            className="flex items-center justify-center gap-3 p-4 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Registrar Amonestación</span>
          </button>
        </div>

        {/* Mensajes de Estado */}
        {!puedePromover && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-400">
              {totalAmonestaciones >= 3 ? (
                <p>El conductor tiene 3 amonestaciones y no puede ser promovido.</p>
              ) : conductor?.status !== 'Aprobado' ? (
                <p>El conductor debe estar <strong>Aprobado</strong> para ser promovido.</p>
              ) : (
                <p>Requisitos no cumplidos para promoción.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lista de Amonestaciones */}
      <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Historial de Amonestaciones</h3>
          <span className="px-3 py-1 rounded-full bg-white/10 text-gray-300 text-sm">
            {totalAmonestaciones} total
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-cyan-500 border-t-transparent" />
          </div>
        ) : amonestaciones.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-gray-400">Sin amonestaciones registradas</p>
            <p className="text-gray-500 text-sm mt-2">Este conductor mantiene un historial limpio</p>
          </div>
        ) : (
          <div className="space-y-3">
            {amonestaciones.map((amonestacion) => (
              <div 
                key={amonestacion.id}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getGravedadColor(amonestacion.gravedad)}`}>
                      {amonestacion.gravedad}
                    </span>
                    <span className="text-gray-400 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(amonestacion.fecha)}
                    </span>
                  </div>
                </div>
                
                <p className="text-white font-semibold mb-1">{amonestacion.motivo}</p>
                
                {amonestacion.descripcion && (
                  <p className="text-gray-400 text-sm mb-2">{amonestacion.descripcion}</p>
                )}
                
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Registrado por:</span>
                  <span className="text-gray-400">{amonestacion.registrado_por || 'Sistema'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Amonestación (lo crearemos en el siguiente paso) */}
      {showModalAmonestar && (
        <ModalAmonestacion
          conductor={conductor}
          onClose={() => setShowModalAmonestar(false)}
          onSuccess={() => {
            cargarAmonestaciones();
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
};

// Placeholder para el modal (lo crearemos después)
const ModalAmonestacion = ({ conductor, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    motivo: '',
    descripcion: '',
    gravedad: 'leve'
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.motivo.trim()) {
      alert('El motivo es obligatorio');
      return;
    }

    try {
      setSubmitting(true);
      const response = await adminService.amonestar(conductor.id, formData);
      
      if (response.success) {
        alert(response.message);
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Error:', error);
      alert(error.message || 'Error al registrar amonestación');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="backdrop-blur-xl bg-gray-800/90 rounded-2xl border border-white/20 p-6 max-w-md w-full">
        <h3 className="text-xl font-bold text-white mb-4">Registrar Amonestación</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm mb-2">Conductor</label>
            <p className="text-white font-semibold">{conductor.nombre_conductor}</p>
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-2">Gravedad *</label>
            <select
              value={formData.gravedad}
              onChange={(e) => setFormData({...formData, gravedad: e.target.value})}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <option value="leve">Leve</option>
              <option value="moderada">Moderada</option>
              <option value="grave">Grave</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-2">Motivo *</label>
            <input
              type="text"
              value={formData.motivo}
              onChange={(e) => setFormData({...formData, motivo: e.target.value})}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              placeholder="Ej: Retraso en pagos de renta"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-2">Descripción (opcional)</label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
              rows="3"
              placeholder="Detalles adicionales..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PanelPlanCarrera;