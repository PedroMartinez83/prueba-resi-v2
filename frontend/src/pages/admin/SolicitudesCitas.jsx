import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle, Clock, Eye, RefreshCw, XCircle } from 'lucide-react';
import solicitudesService from '../../services/solicitudesService';

const ESTADO_ASISTENCIA = {
  todos: 'Todos',
  pendiente: 'Pendiente',
  true: 'Asistió',
  false: 'No asistió'
};

const SolicitudesCitas = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [citas, setCitas] = useState([]);
  const [resumen, setResumen] = useState({
    total_citas: 0,
    asistieron: 0,
    no_asistieron: 0,
    pendientes_asistencia: 0,
    citas_hoy: 0
  });
  const [filtros, setFiltros] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    asistio: 'todos'
  });

  const filtrosActivos = useMemo(() => {
    const payload = {};
    if (filtros.fecha_desde) payload.fecha_desde = filtros.fecha_desde;
    if (filtros.fecha_hasta) payload.fecha_hasta = filtros.fecha_hasta;
    if (filtros.asistio && filtros.asistio !== 'todos') payload.asistio = filtros.asistio;
    return payload;
  }, [filtros]);

  const cargarCitas = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await solicitudesService.getCitasSolicitudes(filtrosActivos);
      setCitas(response?.citas || []);
      setResumen(response?.resumen || {});
    } catch (err) {
      setError(err.message || 'No fue posible cargar la agenda de citas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCitas();
  }, []);

  const parseFechaSegura = (valor, options = {}) => {
    const { soloFecha = false } = options;
    if (!valor) return null;

    if (valor instanceof Date) {
      return Number.isNaN(valor.getTime()) ? null : valor;
    }

    if (typeof valor === 'string') {
      const limpio = valor.trim();
      if (!limpio) return null;

      // Si viene como YYYY-MM-DD, construir fecha local para evitar desfases.
      if (/^\d{4}-\d{2}-\d{2}$/.test(limpio)) {
        const [year, month, day] = limpio.split('-').map(Number);
        const localDate = new Date(year, month - 1, day, 12, 0, 0, 0);
        return Number.isNaN(localDate.getTime()) ? null : localDate;
      }

      // Para la columna de fecha (sin hora), usar solo la parte YYYY-MM-DD
      // aunque la API mande timestamp ISO completo.
      if (soloFecha) {
        const matchFecha = limpio.match(/^(\d{4}-\d{2}-\d{2})/);
        if (matchFecha) {
          const [year, month, day] = matchFecha[1].split('-').map(Number);
          const localDate = new Date(year, month - 1, day, 12, 0, 0, 0);
          return Number.isNaN(localDate.getTime()) ? null : localDate;
        }
      }

      const parsed = new Date(limpio);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(valor);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatFecha = (fecha) => {
    if (!fecha) return 'Sin fecha';
    const parsed = parseFechaSegura(fecha, { soloFecha: true });
    if (!parsed) return String(fecha);

    return parsed.toLocaleDateString('es-MX', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatFechaHora = (fecha) => {
    if (!fecha) return 'Sin registro';
    const parsed = parseFechaSegura(fecha);
    if (!parsed) return String(fecha);

    return parsed.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getBadgeAsistencia = (asistio) => {
    if (asistio === true) {
      return 'bg-green-500/20 text-green-300 border-green-500/30';
    }
    if (asistio === false) {
      return 'bg-red-500/20 text-red-300 border-red-500/30';
    }
    return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
  };

  const getTextoAsistencia = (asistio) => {
    if (asistio === true) return 'Asistió';
    if (asistio === false) return 'No asistió';
    return 'Pendiente';
  };

  const registrarAsistencia = async (solicitudId, asistio_cita) => {
    const confirmar = window.confirm(
      asistio_cita
        ? '¿Confirmas que el prospecto asistió a su cita?'
        : '¿Confirmas que el prospecto no asistió a su cita?'
    );

    if (!confirmar) return;

    const observaciones_asistencia = window.prompt(
      'Observaciones (opcional):',
      ''
    );

    try {
      setUpdatingId(solicitudId);
      await solicitudesService.registrarAsistenciaCita(solicitudId, {
        asistio_cita,
        observaciones_asistencia: observaciones_asistencia || ''
      });
      await cargarCitas();
    } catch (err) {
      setError(err.message || 'No fue posible registrar la asistencia');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Agenda de Citas</h1>
          <p className="text-gray-400">Consulta cuántas citas hay y quién asiste</p>
        </div>
        <button
          onClick={cargarCitas}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-300 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/30 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-gray-400">Total citas</p>
          <p className="text-2xl text-white font-bold">{resumen.total_citas || 0}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-gray-400">Asistieron</p>
          <p className="text-2xl text-green-300 font-bold">{resumen.asistieron || 0}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-gray-400">No asistieron</p>
          <p className="text-2xl text-red-300 font-bold">{resumen.no_asistieron || 0}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-gray-400">Pendientes</p>
          <p className="text-2xl text-yellow-300 font-bold">{resumen.pendientes_asistencia || 0}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-gray-400">Citas hoy</p>
          <p className="text-2xl text-cyan-300 font-bold">{resumen.citas_hoy || 0}</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Desde</label>
            <input
              type="date"
              value={filtros.fecha_desde}
              onChange={(e) => setFiltros((prev) => ({ ...prev, fecha_desde: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-900/60 border border-white/10 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Hasta</label>
            <input
              type="date"
              value={filtros.fecha_hasta}
              onChange={(e) => setFiltros((prev) => ({ ...prev, fecha_hasta: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-900/60 border border-white/10 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Asistencia</label>
            <select
              value={filtros.asistio}
              onChange={(e) => setFiltros((prev) => ({ ...prev, asistio: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-900/60 border border-white/10 rounded-lg text-white"
            >
              {Object.entries(ESTADO_ASISTENCIA).map(([value, label]) => (
                <option key={value} value={value} className="bg-slate-900">
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={cargarCitas}
              disabled={loading}
              className="w-full px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium disabled:opacity-60"
            >
              Filtrar
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-cyan-300" />
          <h2 className="text-lg text-white font-semibold">Listado de citas ({citas.length})</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando agenda...</div>
        ) : citas.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay citas con los filtros seleccionados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-white/10">
                  <th className="px-4 py-3">Registro</th>
                  <th className="px-4 py-3">Prospecto</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Estado solicitud</th>
                  <th className="px-4 py-3">Asistencia</th>
                  <th className="px-4 py-3">Cita</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {citas.map((cita) => (
                  <tr key={cita.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-xs text-gray-300">
                      {formatFechaHora(cita.fecha_solicitud)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium">{cita.nombre_completo}</p>
                      <p className="text-xs text-gray-400">ID #{cita.id}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      <p>{cita.telefono || 'Sin teléfono'}</p>
                      <p className="text-xs text-gray-400">{cita.email || 'Sin email'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-200">{cita.estatus_solicitud}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-md border text-xs font-semibold ${getBadgeAsistencia(cita.asistio_cita)}`}>
                        {getTextoAsistencia(cita.asistio_cita)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-200">
                      <div className="space-y-1">
                        <p className="text-white">{formatFecha(cita.fecha_cita)}</p>
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3.5 h-3.5 text-gray-500" />
                          {cita.hora_cita || '13:00'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => navigate(`/admin/solicitudes/${cita.id}`)}
                          className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30"
                          title="Ver solicitud"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => registrarAsistencia(cita.id, true)}
                          disabled={updatingId === cita.id}
                          className="p-2 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 disabled:opacity-60"
                          title="Marcar asistencia"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => registrarAsistencia(cita.id, false)}
                          disabled={updatingId === cita.id}
                          className="p-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-60"
                          title="Marcar inasistencia"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SolicitudesCitas;
