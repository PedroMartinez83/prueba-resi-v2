import React, { useState, useEffect } from 'react';
import { X, Car, Plus, Save, AlertCircle, CheckCircle, Search } from 'lucide-react';
import adminService from '../../services/adminService';

const ModelosModal = ({ isOpen, onClose }) => {
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Estados de datos
  const [marcasExistentes, setMarcasExistentes] = useState([]);
  const [catalogoPlano, setCatalogoPlano] = useState([]); // Aquí guardaremos la lista para la tabla

  // Estados de búsqueda
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [busquedaActiva, setBusquedaActiva] = useState('');

  const [formData, setFormData] = useState({
    marca: '',
    modelo: ''
  });

  useEffect(() => {
    if (isOpen) {
      cargarCatalogo();
    }
  }, [isOpen]);

  const cargarCatalogo = async () => {
    setCargando(true);
    try {
      const data = await adminService.getOpcionesVehiculos();
      if (data?.opciones) {
        setMarcasExistentes(data.opciones.marcas || []);

        // 🪄 MAGIA: Transformamos el diccionario { "Nissan": ["Versa"] } 
        // en una lista plana para la tabla [{marca: "Nissan", modelo: "Versa"}]
        const diccionario = data.opciones.marcasModelos || {};
        const listaParaTabla = [];
        
        Object.keys(diccionario).forEach(marca => {
          diccionario[marca].forEach(modelo => {
            listaParaTabla.push({ marca, modelo });
          });
        });
        
        setCatalogoPlano(listaParaTabla);
      }
    } catch (error) {
      console.error("Error al cargar catálogo:", error);
    } finally {
      setCargando(false);
    }
  };

  // Formato: "nissan versa" -> "Nissan Versa"
  const formatearTexto = (texto) => {
    if (!texto) return '';
    return texto
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: formatearTexto(value)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await adminService.createCatalogoVehiculo({
        marca: formData.marca.trim(),
        modelo: formData.modelo.trim()
      });
      
      setSuccessMsg(`¡El modelo ${formData.modelo} de ${formData.marca} se guardó con éxito!`);
      setFormData({ marca: '', modelo: '' });
      await cargarCatalogo(); // Recargamos la tabla y las opciones
      
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      const msj = error.message || String(error);
      if (msj.toLowerCase().includes('llave duplicada') || msj.toLowerCase().includes('unique_marca_modelo')) {
        setErrorMsg('Este modelo ya se encuentra registrado para esta marca.');
      } else {
        setErrorMsg('Ocurrió un error al guardar. Intenta de nuevo.');
      }
    } finally {
      setGuardando(false);
    }
  };

  //  LÓGICA DE BÚSQUEDA PARA LA TABLA 
  const catalogoFiltrado = catalogoPlano.filter(item => {
    if (!busquedaActiva) return true;
    
    const termino = busquedaActiva.toLowerCase();
    const marca = item.marca.toLowerCase();
    const modelo = item.modelo.toLowerCase();
    
    return marca.includes(termino) || modelo.includes(termino);
  });

  const manejarBusqueda = (e) => {
    e.preventDefault();
    setBusquedaActiva(textoBusqueda);
  };

  const limpiarBusqueda = () => {
    setTextoBusqueda('');
    setBusquedaActiva('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      {/* Crecimos el modal a max-w-3xl para que quepa bien la tabla */}
      <div className="bg-gray-900 rounded-xl w-full max-w-3xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="flex justify-between items-center p-5 border-b border-gray-800 bg-gray-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Car className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Catálogo de Vehículos</h2>
              <p className="text-sm text-gray-400">Agrega y visualiza marcas y modelos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* CONTENIDO CON SCROLL */}
        <div className="overflow-y-auto p-5 space-y-8">
          
          {/* SECCIÓN 1: FORMULARIO */}
          <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700">
            <h3 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Registrar Nuevo Modelo
            </h3>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex gap-3 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" /> <p>{errorMsg}</p>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/50 rounded-lg flex gap-3 text-green-400 text-sm">
                <CheckCircle className="w-5 h-5 flex-shrink-0" /> <p>{successMsg}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Marca *</label>
                <input
                  type="text"
                  name="marca"
                  required
                  list="lista-marcas"
                  value={formData.marca}
                  onChange={handleInputChange}
                  placeholder="Elige o escribe nueva"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <datalist id="lista-marcas">
                  {marcasExistentes.map((marca, i) => (
                    <option key={i} value={marca} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Modelo *</label>
                <input
                  type="text"
                  name="modelo"
                  required
                  value={formData.modelo}
                  onChange={handleInputChange}
                  placeholder="Ej. Versa, Civic"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={guardando || !formData.marca || !formData.modelo}
                  className="w-full flex justify-center items-center gap-2 px-5 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>

          {/* SECCIÓN 2: TABLA CON BÚSQUEDA */}
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h3 className="text-md font-semibold text-white">Catálogo Actual</h3>
              
              <form onSubmit={manejarBusqueda} className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <input
                    type="text"
                    placeholder="Buscar marca o modelo..."
                    value={textoBusqueda}
                    onChange={(e) => setTextoBusqueda(e.target.value)}
                    className="w-full px-3 py-2 pl-9 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                </div>
                
                <button type="submit" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
                  Buscar
                </button>

                {busquedaActiva && (
                  <button type="button" onClick={limpiarBusqueda} className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-red-500/20 rounded-lg border border-gray-600 transition-colors" title="Limpiar búsqueda">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </form>
            </div>
            
            {cargando ? (
              <div className="flex justify-center p-8 text-gray-400">Cargando catálogo...</div>
            ) : catalogoFiltrado.length === 0 ? (
              <div className="text-center p-8 border border-dashed border-gray-700 rounded-xl bg-gray-800/30 text-gray-500">
                {busquedaActiva 
                  ? `No se encontraron resultados para "${busquedaActiva}"` 
                  : "No hay vehículos en el catálogo aún."}
              </div>
            ) : (
              <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-800/50">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-gray-800 text-xs uppercase text-gray-400 border-b border-gray-700">
                    <tr>
                      <th className="px-4 py-3">Marca</th>
                      <th className="px-4 py-3">Modelo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {catalogoFiltrado.map((item) => (
                      <tr key={`${item.marca}-${item.modelo}`} className="hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-green-400">{item.marca}</td>
                        <td className="px-4 py-3 text-white">{item.modelo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ModelosModal;