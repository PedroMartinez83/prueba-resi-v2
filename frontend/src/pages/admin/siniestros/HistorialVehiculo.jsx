// frontend/src/pages/admin/siniestros/HistorialVehiculo.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, FileWarning, Calendar, DollarSign, AlertTriangle, 
  CheckCircle, Clock, Car, User, MapPin, FileText, Download,
  TrendingUp, AlertCircle
} from 'lucide-react';
import adminService from '../../../services/adminService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const LoadingSpinner = ({ message = 'Cargando...' }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    <p className="mt-4 text-gray-400">{message}</p>
  </div>
);

const HistorialVehiculo = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vehiculo, setVehiculo] = useState(null);
  const [siniestros, setSiniestros] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      // Cargar información del vehículo
      const vehiculoResponse = await adminService.getVehiculoById(id);
      console.log('Vehículo:', vehiculoResponse);
      setVehiculo(vehiculoResponse.vehiculo || vehiculoResponse);
      
      // Cargar historial de siniestros
      const siniestrosResponse = await adminService.getSiniestrosVehiculo(id);
      console.log('Respuesta siniestros:', siniestrosResponse);
      
      // 🔧 CORRECCIÓN: Acceder correctamente a los datos
      const siniestrosData = siniestrosResponse.historial || siniestrosResponse.siniestros || [];
      setSiniestros(siniestrosData);
      
      // Calcular estadísticas desde el backend o calcularlo localmente
      if (siniestrosResponse.estadisticas) {
        // Si el backend envía estadísticas, usarlas
        const stats = siniestrosResponse.estadisticas;
        setEstadisticas({
          total: stats.total_siniestros || siniestrosData.length,
          costoTotal: parseFloat(stats.costo_total || 0),
          resueltos: siniestrosData.filter(s => s.estado === 'Resuelto').length,
          enProceso: siniestrosData.filter(s => s.estado === 'En proceso').length,
          porGravedad: {
            leve: siniestrosData.filter(s => s.gravedad === 'Leve').length,
            moderado: siniestrosData.filter(s => s.gravedad === 'Moderado').length,
            grave: siniestrosData.filter(s => s.gravedad === 'Grave').length,
            total: siniestrosData.filter(s => s.gravedad === 'Total').length
          }
        });
      } else {
        // Calcular estadísticas localmente
        calcularEstadisticas(siniestrosData);
      }
      
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const calcularEstadisticas = (siniestrosData) => {
    const total = siniestrosData.length;
    const costoTotal = siniestrosData.reduce((sum, s) => sum + (parseFloat(s.costo_final || s.costo_estimado) || 0), 0);
    const resueltos = siniestrosData.filter(s => s.estado === 'Resuelto').length;
    const enProceso = siniestrosData.filter(s => s.estado === 'En proceso').length;
    const porGravedad = {
      leve: siniestrosData.filter(s => s.gravedad === 'Leve').length,
      moderado: siniestrosData.filter(s => s.gravedad === 'Moderado').length,
      grave: siniestrosData.filter(s => s.gravedad === 'Grave').length,
      total: siniestrosData.filter(s => s.gravedad === 'Total').length
    };

    setEstadisticas({
      total,
      costoTotal,
      resueltos,
      enProceso,
      porGravedad
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount || 0);
  };

  const formatFecha = (fecha) => {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getEstadoColor = (estado) => {
    const colores = {
      'Reportado': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'En revisión': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'En proceso': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'Resuelto': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Cerrado': 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return colores[estado] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getGravedadColor = (gravedad) => {
    const colores = {
      'Leve': 'bg-green-500/20 text-green-400',
      'Moderado': 'bg-yellow-500/20 text-yellow-400',
      'Grave': 'bg-orange-500/20 text-orange-400',
      'Total': 'bg-red-500/20 text-red-400'
    };
    return colores[gravedad] || 'bg-gray-500/20 text-gray-400';
  };

  const exportarPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(0, 128, 255);
    doc.text('Historial de Siniestros por Vehiculo', 14, 20);
    
    // Información del vehículo
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Vehiculo: ${vehiculo?.NumeroVehiculo || 'N/A'}`, 14, 30);
    doc.text(`${vehiculo?.Marca || ''} ${vehiculo?.Modelo || ''} ${vehiculo?.Año || ''}`, 14, 37);
    doc.text(`Placa: ${vehiculo?.Placa || 'N/A'}`, 14, 44);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 14, 51);
    
    // Estadísticas
    doc.setFontSize(11);
    doc.text(`Total Siniestros: ${estadisticas?.total || 0}`, 14, 60);
    doc.text(`Costo Total: ${formatCurrency(estadisticas?.costoTotal || 0)}`, 14, 67);
    
    // Tabla de siniestros
    const tableData = siniestros.map(s => [
      s.folio_siniestro || 'N/A',
      formatFecha(s.fecha_incidente),
      s.tipo_siniestro || 'N/A',
      s.gravedad || 'N/A',
      s.estado || 'N/A',
      formatCurrency(s.costo_final || s.costo_estimado || 0)
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['Folio', 'Fecha', 'Tipo', 'Gravedad', 'Estado', 'Costo']],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 128, 255] }
    });
    
    doc.save(`Historial_Siniestros_${vehiculo?.NumeroVehiculo || 'vehiculo'}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) {
    return <LoadingSpinner message="Cargando historial de siniestros..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/vehiculos')}
            className="p-2 hover:bg-primary/20 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <FileWarning className="w-8 h-8 text-orange-400" />
              Historial de Siniestros
            </h1>
            <p className="text-gray-400 mt-1">
              {vehiculo?.NumeroVehiculo} • {vehiculo?.Marca} {vehiculo?.Modelo} {vehiculo?.Año}
            </p>
          </div>
        </div>
        <button
          onClick={exportarPDF}
          disabled={siniestros.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-dark font-semibold rounded-lg hover:bg-primary-light transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5" />
          Exportar PDF
        </button>
      </div>

      {/* Información del Vehículo */}
      <div className="glass rounded-lg p-6 border border-primary/20">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Car className="w-6 h-6 text-primary" />
          Información del Vehículo
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-gray-400 text-sm">Número de Vehículo</p>
            <p className="text-white font-semibold">{vehiculo?.NumeroVehiculo || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Marca y Modelo</p>
            <p className="text-white font-semibold">{vehiculo?.Marca} {vehiculo?.Modelo}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Placa</p>
            <p className="text-white font-semibold">{vehiculo?.Placa || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Estado Actual</p>
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              vehiculo?.Estado === 'Disponible' ? 'bg-green-500/20 text-green-400' :
              vehiculo?.Estado === 'Siniestro' ? 'bg-red-500/20 text-red-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              <div className="w-2 h-2 rounded-full bg-current"></div>
              {vehiculo?.Estado || 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      {estadisticas && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass rounded-lg p-4 border border-orange-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Siniestros</p>
                <p className="text-2xl font-bold text-white">{estadisticas.total}</p>
              </div>
              <div className="p-3 bg-orange-500/20 rounded-lg">
                <FileWarning className="w-6 h-6 text-orange-400" />
              </div>
            </div>
          </div>

          <div className="glass rounded-lg p-4 border border-red-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Costo Total</p>
                <p className="text-2xl font-bold text-red-400">{formatCurrency(estadisticas.costoTotal)}</p>
              </div>
              <div className="p-3 bg-red-500/20 rounded-lg">
                <DollarSign className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </div>

          <div className="glass rounded-lg p-4 border border-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Resueltos</p>
                <p className="text-2xl font-bold text-green-400">{estadisticas.resueltos}</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>

          <div className="glass rounded-lg p-4 border border-purple-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">En Proceso</p>
                <p className="text-2xl font-bold text-purple-400">{estadisticas.enProceso}</p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <Clock className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Por Gravedad */}
      {estadisticas && (
        <div className="glass rounded-lg p-6 border border-primary/20">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Distribución por Gravedad
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <p className="text-green-400 text-2xl font-bold">{estadisticas.porGravedad.leve}</p>
              <p className="text-gray-400 text-sm mt-1">Leve</p>
            </div>
            <div className="text-center p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <p className="text-yellow-400 text-2xl font-bold">{estadisticas.porGravedad.moderado}</p>
              <p className="text-gray-400 text-sm mt-1">Moderado</p>
            </div>
            <div className="text-center p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <p className="text-orange-400 text-2xl font-bold">{estadisticas.porGravedad.grave}</p>
              <p className="text-gray-400 text-sm mt-1">Grave</p>
            </div>
            <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/20">
              <p className="text-red-400 text-2xl font-bold">{estadisticas.porGravedad.total}</p>
              <p className="text-gray-400 text-sm mt-1">Pérdida Total</p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Siniestros */}
      <div className="glass rounded-lg border border-primary/20">
        <div className="p-6 border-b border-primary/20">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Registro de Siniestros ({siniestros.length})
          </h2>
        </div>
        
        {siniestros.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">Este vehículo no tiene siniestros registrados</p>
          </div>
        ) : (
          <div className="divide-y divide-primary/10">
            {siniestros.map((siniestro) => (
              <div
                key={siniestro.id}
                onClick={() => navigate(`/admin/siniestros/${siniestro.id}`)}
                className="p-6 hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-orange-500/20 rounded-lg">
                      <FileWarning className="w-6 h-6 text-orange-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">
                          Folio #{siniestro.folio_siniestro || 'Sin folio'}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getGravedadColor(siniestro.gravedad)}`}>
                          {siniestro.gravedad || 'N/A'}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getEstadoColor(siniestro.estado)}`}>
                          {siniestro.estado || 'N/A'}
                        </span>
                      </div>
                      <p className="text-gray-400 mb-2">{siniestro.tipo_siniestro || 'Sin tipo'}</p>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Calendar className="w-4 h-4" />
                          {formatFecha(siniestro.fecha_incidente)}
                        </div>
                        {siniestro.nombre_conductor && (
                          <div className="flex items-center gap-2 text-gray-400">
                            <User className="w-4 h-4" />
                            {siniestro.nombre_conductor}
                          </div>
                        )}
                        {siniestro.ubicacion && (
                          <div className="flex items-center gap-2 text-gray-400">
                            <MapPin className="w-4 h-4" />
                            {siniestro.ubicacion}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-red-400">
                      {formatCurrency(siniestro.costo_final || siniestro.costo_estimado || 0)}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {siniestro.costo_final ? 'Costo final' : 'Costo estimado'}
                    </p>
                  </div>
                </div>
                
                {siniestro.descripcion && (
                  <p className="text-gray-400 text-sm ml-16">
                    {siniestro.descripcion.length > 200 
                      ? `${siniestro.descripcion.substring(0, 200)}...` 
                      : siniestro.descripcion}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistorialVehiculo;