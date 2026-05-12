import React, { useState, useEffect } from 'react';
import { X, Shield, FileText, Building, Calendar, Plus, Save, AlertCircle, CheckCircle, Search  } from 'lucide-react';
import adminService from '../../services/adminService'; // 👈 Ajusta la ruta si es necesario
import { set } from 'date-fns';

const PolizasModal = ({ isOpen, onClose }) => {
  const [polizas, setPolizas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [textoBusqueda, setTextoBusqueda] = useState(''); // Lo que el usuario va tecleando
  const [busquedaActiva, setBusquedaActiva] = useState(''); // Lo que se aplica al dar Enter

  // Estado del nuevo formulario
  const [formData, setFormData] = useState({
    numero_poliza: '',
    aseguradora: '',
    fecha_vencimiento: ''
  });

  //  AGREGA ESTO DEBAJO DE TUS ESTADOS 
  const obtenerFechaMinima = () => {
    const hoy = new Date();
    hoy.setDate(hoy.getDate() + 1); // Le sumamos 1 día para que sea "mañana"
    
    // Formateamos a YYYY-MM-DD
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  //  NUEVA FUNCIÓN PARA FORMATEAR FECHAS EN LA TABLA 
  const formatearFechaBonita = (fechaISO) => {
    if (!fechaISO) return 'Sin fecha';
    
    // Partimos la fecha para evitar desfases de zona horaria
    const [year, month, day] = fechaISO.split('T')[0].split('-');
    
    // Lista de meses en español
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    // Quitamos los ceros a la izquierda del día (ej. "02" -> 2)
    const diaLimpio = parseInt(day, 10);
    const mesNombre = meses[parseInt(month, 10) - 1];
    
    return `${diaLimpio} de ${mesNombre} de ${year}`;
  };

  const fechaMinima = obtenerFechaMinima();

  // Cargar las pólizas al abrir el modal
  useEffect(() => {
    if (isOpen) {
      cargarPolizas();
    }
  }, [isOpen]);

  const cargarPolizas = async () => {
    setCargando(true);
    try {
      const respuesta = await adminService.getPolizasSeguro();
      
      // 🕵️‍♂️ El espía para que veas qué te manda el backend
      console.log("🕵️‍♂️ Respuesta de Pólizas:", respuesta);

      // 🛡️ EL ESCUDO ANTI-CRASHES: Extraemos el arreglo venga como venga
      let arregloPolizas = [];
      
      if (Array.isArray(respuesta)) {
        // Si el backend ya manda la lista directa
        arregloPolizas = respuesta;
      } else if (respuesta && Array.isArray(respuesta.data)) {
        // Si el backend lo manda dentro de "data" (muy común)
        arregloPolizas = respuesta.data;
      } else if (respuesta && Array.isArray(respuesta.polizas)) {
        // Si el backend lo manda dentro de "polizas"
        arregloPolizas = respuesta.polizas;
      }

      // Guardamos la lista segura (siempre será un arreglo)
      setPolizas(arregloPolizas);

    } catch (error) {
      console.error("Error al cargar pólizas:", error);
      setPolizas([]); // Si hay error, lo dejamos como arreglo vacío para que no truene el map
    } finally {
      setCargando(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    
    // Limpiamos los avisos antes de intentar guardar
    setErrorMsg(''); 
    setSuccessMsg('');

    try {
      await adminService.createPolizaSeguro(formData);
      
      // Si todo sale bien, limpiamos el formulario y recargamos la tabla
      setFormData({ numero_poliza: '', aseguradora: '', fecha_vencimiento: '' });
      await cargarPolizas();
      
      // 🎉 MOSTRAMOS EL AVISO DE ÉXITO
      setSuccessMsg('¡Póliza registrada correctamente!');
      
      // ⏱️ Hacemos que desaparezca después de 3 segundos
      setTimeout(() => {
        setSuccessMsg('');
      }, 3000);
      
    } catch (error) {
      console.error("Error al crear la póliza:", error);
      
      const mensajeError = error.message || String(error);
      if (mensajeError.toLowerCase().includes('llave duplicada') || mensajeError.toLowerCase().includes('numero_poliza_key')) {
        setErrorMsg('¡Atención! Ya existe una póliza registrada con este número.');
      } else {
        setErrorMsg('Ocurrió un error inesperado al guardar la póliza.');
      }
    } finally {
      setGuardando(false);
    }
  };

  //  LÓGICA DE BÚSQUEDA (Agrega esto justo antes del return) 
  const polizasFiltradas = polizas.filter(poliza => {
    if (!busquedaActiva) return true; // Si no hay búsqueda, pasan todas
    
    const termino = busquedaActiva.toLowerCase();
    const numero = (poliza.numero_poliza || '').toLowerCase();
    const aseguradora = (poliza.aseguradora || '').toLowerCase();
    
    // Retorna true si el texto buscado está en el número o en la aseguradora
    return numero.includes(termino) || aseguradora.includes(termino);
  });

  const manejarBusqueda = (e) => {
    e.preventDefault(); // Evita que la página se recargue
    setBusquedaActiva(textoBusqueda); // ¡Aplica el filtro!
  };

  const limpiarBusqueda = () => {
    setTextoBusqueda('');
    setBusquedaActiva('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl w-full max-w-3xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER DEL MODAL */}
        <div className="flex justify-between items-center p-5 border-b border-gray-800 bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Gestión de Pólizas</h2>
              <p className="text-sm text-gray-400">Agrega y visualiza los seguros vehiculares</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* CONTENIDO SCROLLEABLE */}
        <div className="overflow-y-auto p-5 space-y-8">
          
          {/* SECCIÓN 1: FORMULARIO PARA AGREGAR NUEVA PÓLIZA */}
          <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700">
            <h3 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Registrar Nueva Póliza
            </h3>

            {/*  LA ALERTA VISUAL DE ERROR  */}
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{errorMsg}</p>
              </div>
            )}

            {/*  ALERTA VERDE (ÉXITO)  */}
            {successMsg && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/50 rounded-lg flex items-start gap-3 text-green-400 text-sm transition-all duration-300">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{successMsg}</p>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Campo Número de Póliza */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> No. de Póliza *
                </label>
                <input
                  type="text"
                  required
                  value={formData.numero_poliza}
                  onChange={(e) => setFormData({...formData, numero_poliza: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Ej. 2017957"
                />
              </div>

              {/* Campo Aseguradora */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 flex items-center gap-1">
                  <Building className="w-3 h-3" /> Aseguradora *
                </label>
                <input
                  type="text"
                  required
                  value={formData.aseguradora}
                  onChange={(e) => setFormData({...formData, aseguradora: e.target.value.toUpperCase()})}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Ej. BANORTE"
                />
              </div>

              {/* Campo Fecha de Vencimiento */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Vencimiento *
                </label>
                <input
                  type="date"
                  required
                  min={fechaMinima} // Evita seleccionar fechas pasadas
                  value={formData.fecha_vencimiento}
                  onChange={(e) => setFormData({...formData, fecha_vencimiento: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  style={{ colorScheme: 'dark' }} // Truco para que el calendario se vea oscuro
                />
                {/*  EL AVISO VISUAL  */}
                <p className="text-[10px] text-blue-400 mt-1 italic">
                  * La póliza debe vencer al menos a partir de mañana.
                </p>
              </div>

              {/* Botón Guardar (Ocupa toda la fila en móvil, 1 columna en PC) */}
              <div className="md:col-span-3 flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={guardando}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {guardando ? 'Guardando...' : 'Guardar Póliza'}
                </button>
              </div>
            </form>
          </div>

          {/* SECCIÓN 2: TABLA DE PÓLIZAS EXISTENTES */}
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h3 className="text-md font-semibold text-white">Pólizas Registradas</h3>
              
              {/*  LA BARRA DE BÚSQUEDA  */}
              <form onSubmit={manejarBusqueda} className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <input
                    type="text"
                    placeholder="Buscar póliza o aseguradora..."
                    value={textoBusqueda}
                    onChange={(e) => setTextoBusqueda(e.target.value)}
                    className="w-full px-3 py-2 pl-9 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                </div>
                
                <button
                  type="submit"
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Buscar
                </button>

                {/* Botón para limpiar si hay una búsqueda activa */}
                {busquedaActiva && (
                  <button
                    type="button"
                    onClick={limpiarBusqueda}
                    className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-red-500/20 rounded-lg border border-gray-600 transition-colors"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </form>
            </div>
            
            {cargando ? (
              <div className="flex justify-center p-8 text-gray-400">Cargando pólizas...</div>
            ) : polizasFiltradas.length === 0 ? (
              <div className="text-center p-8 border border-dashed border-gray-700 rounded-xl bg-gray-800/30 text-gray-500">
                {/* Mensaje dinámico si no encuentra nada en la búsqueda */}
                {busquedaActiva 
                  ? `No se encontraron resultados para "${busquedaActiva}"` 
                  : "No hay pólizas registradas aún."}
              </div>
            ) : (
              <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-800/50">
                <table className="w-full text-left text-sm text-gray-300">
                  {/* ... tu thead se queda igualito ... */}
                  <thead className="bg-gray-800 text-xs uppercase text-gray-400 border-b border-gray-700">
                    <tr>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">No. Póliza</th>
                      <th className="px-4 py-3">Aseguradora</th>
                      <th className="px-4 py-3">Vencimiento</th>
                    </tr>
                  </thead>
                  
                  {/*  IMPORTANTE: Cambiamos polizas.map por polizasFiltradas.map  */}
                  <tbody className="divide-y divide-gray-700">
                    {polizasFiltradas.map((poliza) => (
                      <tr key={poliza.id} className="hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{poliza.id}</td>
                        <td className="px-4 py-3 font-medium text-white">{poliza.numero_poliza}</td>
                        <td className="px-4 py-3 text-blue-400">{poliza.aseguradora}</td>
                        <td className="px-4 py-3 text-gray-300 capitalize">
                          {formatearFechaBonita(poliza.fecha_vencimiento)}
                        </td>
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

export default PolizasModal;