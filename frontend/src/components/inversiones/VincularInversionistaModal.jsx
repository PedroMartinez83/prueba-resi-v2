import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Link, User, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const VincularInversionistaModal = ({ inversion, onClose, onSuccess }) => {
  const [inversionistas, setInversionistas] = useState([]);
  const [inversionistaSeleccionado, setInversionistaSeleccionado] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInversionistas, setLoadingInversionistas] = useState(true);

  useEffect(() => {
    fetchInversionistas();
  }, []);

  const fetchInversionistas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/inversionistas`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setInversionistas(data.inversionistas || []);
      }
    } catch (error) {
      console.error('Error cargando inversionistas:', error);
    } finally {
      setLoadingInversionistas(false);
    }
  };

  const handleVincular = async () => {
    if (!inversionistaSeleccionado) {
      alert('Por favor selecciona un inversionista');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_BASE_URL}/admin/inversiones/${inversion.id_inversion}/vincular-inversionista`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inversionista_id: parseInt(inversionistaSeleccionado)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al vincular');
      }

      alert('✅ Inversionista vinculado exitosamente');
      onSuccess();
      onClose();

    } catch (error) {
      console.error('Error:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="glass rounded-2xl border border-white/10 w-full max-w-2xl">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-white">Vincular Inversionista</h3>
              <p className="text-gray-400 text-sm mt-1">
                Asigna un inversionista a esta inversión
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Selector de Inversionista */}
          <div>
            <label className="block text-white font-medium mb-2">
              Seleccionar Inversionista *
            </label>
            {loadingInversionistas ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500"></div>
              </div>
            ) : (
              <select
                value={inversionistaSeleccionado}
                onChange={(e) => setInversionistaSeleccionado(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20"
              >
                <option value="">-- Seleccionar Inversionista --</option>
                {inversionistas
                  .filter(inv => inv.status === 'Activo')
                  .map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.nombre} - {inv.email}
                    </option>
                  ))}
              </select>
            )}
          </div>

          {/* Inversionista Seleccionado */}
          {inversionistaSeleccionado && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-green-400 mt-0.5" />
                <div>
                  <p className="text-green-400 font-medium mb-1">
                    Inversionista seleccionado
                  </p>
                  <p className="text-white text-sm font-bold">
                    {inversionistas.find(i => i.id === parseInt(inversionistaSeleccionado))?.nombre}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {inversionistas.find(i => i.id === parseInt(inversionistaSeleccionado))?.email}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Información Adicional */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-yellow-400 text-sm font-medium mb-2">
                  ¿Qué sucederá al vincular?
                </p>
                <ul className="text-gray-300 text-sm space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>Se asignará el inversionista a esta inversión</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>Se generará el calendario de pagos automáticamente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>Se actualizará el monto total invertido del inversionista</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>Los datos financieros se mantendrán intactos</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-all font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleVincular}
              disabled={loading || !inversionistaSeleccionado}
              className={`flex-1 px-6 py-3 rounded-lg transition-all flex items-center justify-center gap-2 font-bold ${
                inversionistaSeleccionado && !loading
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:shadow-lg hover:shadow-cyan-500/30 transform hover:scale-105'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Vinculando...
                </>
              ) : (
                <>
                  <Link className="w-5 h-5" />
                  Vincular Inversionista
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
};

export default VincularInversionistaModal;
