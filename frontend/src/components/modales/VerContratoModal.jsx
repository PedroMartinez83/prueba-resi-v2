import { useState, useEffect } from 'react';
import { X, FileText, Upload, Eye, Calendar, User, AlertCircle, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const VerContratoModal = ({ isOpen, onClose, vehiculo }) => {
  const [loading, setLoading] = useState(false);
  const [asignacion, setAsignacion] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [mostrarVisorPDF, setMostrarVisorPDF] = useState(false);

  useEffect(() => {
    if (isOpen && vehiculo) {
      cargarAsignacion();
    }
  }, [isOpen, vehiculo]);

  const cargarAsignacion = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/admin/asignaciones/activa/${vehiculo.id}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      const data = await response.json();
      if (data.success && data.asignacion) {
        setAsignacion(data.asignacion);
      } else {
        setAsignacion(null);
      }
    } catch (error) {
      console.error('Error al cargar asignación:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('❌ Solo se permiten archivos PDF');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('❌ El archivo no debe superar 5MB');
      return;
    }

    try {
      setUploadingFile(true);
      const formData = new FormData();
      formData.append('contrato', file);
      
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/admin/asignaciones/${asignacion.id}/contrato`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        }
      );

      const data = await response.json();
      
      if (data.success) {
        alert('✅ Contrato subido exitosamente');
        cargarAsignacion();
      } else {
        alert('❌ Error al subir contrato: ' + data.message);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al subir archivo');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleVerContrato = () => {
    setMostrarVisorPDF(true);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start md:items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-white/20 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 p-4 sm:p-6 flex justify-between items-center rounded-t-xl">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                <FileText className="w-6 h-6" />
                Contrato de Asignación
              </h2>
              <p className="text-blue-100 text-sm">
                Vehículo {vehiculo?.NumeroVehiculo || vehiculo?.numero_vehiculo}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-all"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 space-y-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-400">Cargando información...</p>
              </div>
            ) : !asignacion ? (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-white font-semibold mb-2">Sin Asignación Activa</p>
                <p className="text-gray-400 text-sm">
                  Este vehículo no tiene un conductor asignado actualmente
                </p>
              </div>
            ) : (
              <>
                {/* Info de Asignación */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h3 className="text-white font-semibold mb-4">Información de la Asignación</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Conductor</p>
                      <p className="text-white font-semibold flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {asignacion.nombre_conductor}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Fecha de Asignación</p>
                      <p className="text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {formatDate(asignacion.fecha_inicio)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Renta Diaria</p>
                      <p className="text-white font-bold text-lg">
                        {formatCurrency(asignacion.renta_diaria)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Abono Póliza/Mant.</p>
                      <p className="text-white font-bold text-lg">
                        {formatCurrency(asignacion.abono_poliza_mantenimiento)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Estado del Contrato */}
                <div className={`rounded-lg p-4 border ${
                  asignacion.url_contrato_digital 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-yellow-500/10 border-yellow-500/30'
                }`}>
                  <div className="flex items-center gap-3">
                    {asignacion.url_contrato_digital ? (
                      <>
                        <CheckCircle className="w-6 h-6 text-green-400" />
                        <div className="flex-1">
                          <p className="text-white font-semibold">Contrato Digital Disponible</p>
                          <p className="text-gray-400 text-sm">El contrato está firmado y almacenado</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-6 h-6 text-yellow-400" />
                        <div className="flex-1">
                          <p className="text-white font-semibold">Sin Contrato Digital</p>
                          <p className="text-gray-400 text-sm">Sube el contrato firmado en formato PDF</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="space-y-3">
                  {asignacion.url_contrato_digital ? (
                    <>
                      <button
                        onClick={handleVerContrato}
                        className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                      >
                        <Eye className="w-5 h-5" />
                        Ver Contrato Digital
                      </button>

                      <label className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/20">
                        <Upload className="w-5 h-5" />
                        {uploadingFile ? 'Subiendo...' : 'Reemplazar Contrato'}
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={handleFileUpload}
                          disabled={uploadingFile}
                          className="hidden"
                        />
                      </label>
                    </>
                  ) : (
                    <label className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer">
                      <Upload className="w-5 h-5" />
                      {uploadingFile ? 'Subiendo...' : 'Subir Contrato PDF'}
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileUpload}
                        disabled={uploadingFile}
                        className="hidden"
                      />
                    </label>
                  )}

                  <button
                    onClick={onClose}
                    className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all"
                  >
                    Cerrar
                  </button>
                </div>

                {/* Nota informativa */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-blue-400 text-sm">
                    <strong>💡 Nota:</strong> El contrato digital se almacena de forma segura en Cloudinary y puede ser consultado en cualquier momento.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 🆕 VISOR DE PDF MODAL */}
      {mostrarVisorPDF && asignacion?.url_contrato_digital && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start md:items-center justify-center z-[60] p-4 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 rounded-xl border border-white/20 w-full max-w-5xl h-[85vh] sm:h-[90vh] flex flex-col">
            {/* Header del visor */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center rounded-t-xl">
              <h3 className="text-white font-bold">Vista Previa del Contrato</h3>
              <div className="flex gap-2">
                <a
                  href={asignacion.url_contrato_digital}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition-all"
                >
                  Abrir en nueva pestaña
                </a>
                <button
                  onClick={() => setMostrarVisorPDF(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
            
            {/* PDF embebido */}
            <div className="flex-1 bg-white p-2 rounded-b-xl overflow-hidden">
              <iframe
  src={`https://docs.google.com/viewer?url=${encodeURIComponent(asignacion.url_contrato_digital)}&embedded=true`}
  className="w-full h-full rounded"
  title="Contrato PDF"
  allow="fullscreen"
/>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VerContratoModal;
