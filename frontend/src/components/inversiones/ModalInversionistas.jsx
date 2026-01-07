import React, { useState, useEffect } from 'react';
import { X, UserPlus, Search, Building, User, Phone, Mail, CreditCard } from 'lucide-react';
import adminService from '../../services/adminService';

const ModalInversionistas = ({ isOpen, onClose, onSelect }) => {
  const [tab, setTab] = useState('seleccionar'); // 'seleccionar' o 'crear'
  const [inversionistas, setInversionistas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [inversionistaSeleccionado, setInversionistaSeleccionado] = useState(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    whatsapp: '',
    rfc: '',
    direccion: '',
    banco: '',
    cuenta_bancaria: '',
    clabe: '',
    tipo_inversionista: 'Individual',
    tasa_rendimiento: 1.56,
    monto_minimo_inversion: 50000
  });

  useEffect(() => {
    if (isOpen) {
      cargarInversionistas();
    }
  }, [isOpen]);

  const cargarInversionistas = async () => {
    setLoading(true);
    try {
      const response = await adminService.getOpcionesInversionistas();
      if (response.success && response.inversionistas) {
        setInversionistas(response.inversionistas);
      } else if (response.inversionistas) {
        setInversionistas(response.inversionistas);
      }
    } catch (error) {
      console.error('Error cargando inversionistas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearInversionista = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await adminService.createInversionista(formData);
      if (response.success) {
        onSelect(response.inversionista);
        onClose();
      }
    } catch (error) {
      console.error('Error creando inversionista:', error);
      alert('Error al crear inversionista: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const inversionistasFiltrados = inversionistas.filter(inv => 
    inv.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-dark glass rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden border border-primary/30">
        {/* Header */}
        <div className="sticky top-0 bg-dark/95 backdrop-blur-sm p-6 border-b border-primary/20 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Gestión de Inversionista</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setTab('seleccionar')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                tab === 'seleccionar' 
                  ? 'bg-primary text-dark' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Seleccionar Existente
            </button>
            <button
              onClick={() => setTab('crear')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                tab === 'crear' 
                  ? 'bg-primary text-dark' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Crear Nuevo
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 180px)' }}>
          {tab === 'seleccionar' ? (
            <div className="space-y-4">
              {/* Buscador */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Lista de inversionistas */}
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : inversionistasFiltrados.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No hay inversionistas registrados
                </div>
              ) : (
                <div className="grid gap-3">
                  {inversionistasFiltrados.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => setInversionistaSeleccionado(inv)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        inversionistaSeleccionado?.id === inv.id
                          ? 'bg-primary/20 border-primary'
                          : 'bg-gray-800/50 border-gray-700 hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{inv.nombre}</p>
                            <p className="text-gray-400 text-sm">{inv.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-primary font-medium">
                            {inv.tasa_rendimiento || 1.56}% mensual
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCrearInversionista} className="space-y-6">
              {/* Información Personal */}
              <div className="glass rounded-lg p-4 border border-gray-700">
                <h3 className="font-semibold text-primary mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Información Personal
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      value={formData.nombre}
                      onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      value={formData.telefono}
                      onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Mismo que teléfono si aplica"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      RFC
                    </label>
                    <input
                      type="text"
                      value={formData.rfc}
                      onChange={(e) => setFormData({...formData, rfc: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Tipo de Inversionista
                    </label>
                    <select
                      value={formData.tipo_inversionista}
                      onChange={(e) => setFormData({...formData, tipo_inversionista: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="Individual">Individual</option>
                      <option value="Empresa">Empresa</option>
                      <option value="Sociedad">Sociedad</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Información Bancaria */}
              <div className="glass rounded-lg p-4 border border-gray-700">
                <h3 className="font-semibold text-primary mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Información Bancaria
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Banco
                    </label>
                    <input
                      type="text"
                      value={formData.banco}
                      onChange={(e) => setFormData({...formData, banco: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Cuenta Bancaria
                    </label>
                    <input
                      type="text"
                      value={formData.cuenta_bancaria}
                      onChange={(e) => setFormData({...formData, cuenta_bancaria: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-400 mb-1">
                      CLABE
                    </label>
                    <input
                      type="text"
                      value={formData.clabe}
                      onChange={(e) => setFormData({...formData, clabe: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Parámetros de Inversión */}
              <div className="glass rounded-lg p-4 border border-gray-700">
                <h3 className="font-semibold text-primary mb-4">Parámetros de Inversión</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Tasa de Rendimiento Mensual (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tasa_rendimiento}
                      onChange={(e) => setFormData({...formData, tasa_rendimiento: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Monto Mínimo de Inversión
                    </label>
                    <input
                      type="number"
                      value={formData.monto_minimo_inversion}
                      onChange={(e) => setFormData({...formData, monto_minimo_inversion: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-primary text-dark font-semibold rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50"
              >
                {loading ? 'Creando...' : 'Crear Inversionista'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        {tab === 'seleccionar' && (
          <div className="sticky bottom-0 bg-dark/95 p-4 border-t border-gray-700 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (inversionistaSeleccionado) {
                  onSelect(inversionistaSeleccionado);
                  onClose();
                }
              }}
              disabled={!inversionistaSeleccionado}
              className="px-4 py-2 bg-primary text-dark font-semibold rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50"
            >
              Seleccionar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalInversionistas;