// frontend/src/services/adminService.js

/**
 * Servicio para manejar todas las operaciones administrativas
 * @module adminService
 */

import { API_BASE_URL } from './api';

class AdminService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Método auxiliar para hacer peticiones con autenticación
   * @private
   * @param {string} endpoint - Endpoint relativo a la API
   * @param {Object} options - Opciones de fetch
   * @returns {Promise<any>} Respuesta parseada
   */
  async fetchWithAuth(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('No hay sesión activa');
    }
    
    const url = `${this.baseURL}${endpoint}`;
    const isFormData = options.body instanceof FormData;

    // Construir headers dinámicamente según el tipo de payload
    const headers = {
      ...(isFormData ? {} : this.defaultHeaders),
      'Authorization': `Bearer ${token}`,
      ...options.headers
    };

    // Si es FormData, eliminar cualquier Content-Type para que el navegador
    // genere el boundary correcto automáticamente.
    if (isFormData) {
      Object.keys(headers).forEach(key => {
        if (key.toLowerCase() === 'content-type') {
          delete headers[key];
        }
      });
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Manejar respuestas no exitosas
    if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          throw new Error('Sesión expirada');
        }
        
        // 🟢 MEJORA: Intentamos leer el JSON del error
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          // Si no es JSON (ej. error 500 de nginx), dejamos el objeto vacío
        }

        // Buscamos el mensaje en 'message', 'error' o usamos el status text por defecto
        const mensajeFinal = errorData.message || errorData.error || `Error ${response.status}: ${response.statusText}`;
        
        throw new Error(mensajeFinal);
      }

      // Manejar respuestas vacías (204 No Content)
      if (response.status === 204) {
        return { success: true };
      }

      return await response.json();
    } catch (error) {
      // Re-lanzar errores de red o parsing
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error('Error de conexión. Verifica tu conexión a internet.');
      }
      throw error;
    }
  }

  // ============= VEHÍCULOS =============
  
  /**
   * Obtiene todos los vehículos
   * @returns {Promise<Object>} Lista de vehículos
   */
  async getVehiculos() {
    try {
      const data = await this.fetchWithAuth('/admin/vehiculos');
      console.log('Vehículos obtenidos:', data);
      return data;
    } catch (error) {
      console.error('Error al obtener vehículos:', error);
      throw error;
    }
  }

  /**
   * Obtiene un vehículo por ID
   * @param {string|number} id - ID del vehículo
   * @returns {Promise<Object>} Datos del vehículo
   */
  async getVehiculoById(id) {
    if (!id) throw new Error('ID de vehículo requerido');
    
    try {
      const data = await this.fetchWithAuth(`/admin/vehiculos/${id}`);
      return data;
    } catch (error) {
      console.error('Error al obtener vehículo:', error);
      throw error;
    }
  }

  /**
   * Crea un nuevo vehículo
   * @param {Object} vehiculoData - Datos del vehículo
   * @returns {Promise<Object>} Vehículo creado
   */
  async createVehiculo(vehiculoData) {
    if (!vehiculoData) throw new Error('Datos del vehículo requeridos');
    
    try {
      console.log('Enviando datos del vehículo:', vehiculoData);
      const data = await this.fetchWithAuth('/admin/vehiculos', {
        method: 'POST',
        body: JSON.stringify(vehiculoData)
      });
      return data;
    } catch (error) {
      console.error('Error al crear vehículo:', error);
      throw error;
    }
  }

  /**
   * Actualiza un vehículo existente
   * @param {string|number} id - ID del vehículo
   * @param {Object} vehiculoData - Datos actualizados
   * @returns {Promise<Object>} Vehículo actualizado
   */
  async updateVehiculo(id, vehiculoData) {
    if (!id) throw new Error('ID de vehículo requerido');
    if (!vehiculoData) throw new Error('Datos del vehículo requeridos');
    
    try {
      console.log('Actualizando vehículo:', id, vehiculoData);
      const data = await this.fetchWithAuth(`/admin/vehiculos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(vehiculoData)
      });
      return data;
    } catch (error) {
      console.error('Error al actualizar vehículo:', error);
      throw error;
    }
  }

  /**
   * Elimina un vehículo
   * @param {string|number} id - ID del vehículo
   * @returns {Promise<Object>} Confirmación de eliminación
   */
  async deleteVehiculo(id) {
    if (!id) throw new Error('ID de vehículo requerido');
    
    try {
      const data = await this.fetchWithAuth(`/admin/vehiculos/${id}`, {
        method: 'DELETE'
      });
      return data;
    } catch (error) {
      console.error('Error al eliminar vehículo:', error);
      throw error;
    }
  }

  /**
   * Obtiene opciones para los selects de vehículos
   * @returns {Promise<Object>} Opciones disponibles
   */
  async getOpcionesVehiculos() {
    try {
      const data = await this.fetchWithAuth('/admin/vehiculos/opciones');
      console.log('Opciones obtenidas:', data);
      return data;
    } catch (error) {
      console.error('Error al obtener opciones:', error);
      // Retornar opciones por defecto en caso de error
      return {
        tipoSocio: ['SD', 'SI', 'SA'],
        status: ['Activo', 'Inactivo', 'Temporal'],
        tipoVehiculo: ['Sedan', 'SUV', 'Pickup', 'Van', 'Hatchback'],
        tipoCombustible: ['Gasolina', 'Diesel', 'Híbrido', 'Eléctrico'],
        color: ['Blanco', 'Negro', 'Gris', 'Plata', 'Rojo', 'Azul', 'Verde', 'Otro'],
        estado: ['Disponible', 'Rentado', 'Mantenimiento', 'Siniestro', 'Baja'],
        marcas: [],
        modelos: []
      };
    }
  }

  // ============= INVERSIONISTAS =============

  /**
   * Obtiene todos los inversionistas
   * @returns {Promise<Object>} Lista de inversionistas
   */
  async getInversionistas() {
    try {
      const data = await this.fetchWithAuth('/admin/inversionistas');
      return data;
    } catch (error) {
      console.error('Error al obtener inversionistas:', error);
      throw error;
    }
  }
/**
 * Crea una inversión completa con el nuevo flujo
 * @param {Object} datosInversion - Datos de la inversión completa
 * @returns {Promise<Object>} Inversión creada
 */
async crearInversionCompleta(datosInversion) {
  if (!datosInversion) throw new Error('Datos de inversión requeridos');
  
  try {
    const data = await this.fetchWithAuth('/admin/inversiones/crear-completa', {
      method: 'POST',
      body: JSON.stringify(datosInversion)
    });
    return data;
  } catch (error) {
    console.error('Error al crear inversión completa:', error);
    throw error;
  }
}
  /**
   * Obtiene opciones de inversionistas para selects
   * @returns {Promise<Object>} Opciones de inversionistas
   */
  async getOpcionesInversionistas() {
    try {
      const data = await this.fetchWithAuth('/admin/inversionistas/opciones');
      return data;
    } catch (error) {
      console.error('Error al obtener opciones de inversionistas:', error);
      return {
        inversionistas: [],
        tasas_rendimiento: [1.0, 1.25, 1.5, 1.56, 1.75, 2.0],
        tipos_inversionista: ['Individual', 'Empresa', 'Sociedad']
      };
    }
  }

  /**
   * Crea un nuevo inversionista
   * @param {Object} inversionistaData - Datos del inversionista
   * @returns {Promise<Object>} Inversionista creado
   */
  async createInversionista(inversionistaData) {
    if (!inversionistaData) throw new Error('Datos del inversionista requeridos');
    
    try {
      const data = await this.fetchWithAuth('/admin/inversionistas', {
        method: 'POST',
        body: JSON.stringify(inversionistaData)
      });
      return data;
    } catch (error) {
      console.error('Error al crear inversionista:', error);
      throw error;
    }
  }

  /**
   * Obtiene dashboard de un inversionista
   * @param {string|number} id - ID del inversionista
   * @returns {Promise<Object>} Dashboard del inversionista
   */
  async getInversionistaDashboard(id) {
    if (!id) throw new Error('ID de inversionista requerido');
    
    try {
      const data = await this.fetchWithAuth(`/admin/inversionistas/${id}/dashboard`);
      return data;
    } catch (error) {
      console.error('Error al obtener dashboard:', error);
      throw error;
    }
  }

  // ============= INVERSIONES =============

  /**
   * Calcula una inversión sin guardar
   * @param {Object} datosCalculo - Datos para calcular
   * @returns {Promise<Object>} Cálculos de inversión
   */
  async calcularInversion(datosCalculo) {
    if (!datosCalculo) throw new Error('Datos de cálculo requeridos');
    
    try {
      const data = await this.fetchWithAuth('/admin/inversiones/calcular', {
        method: 'POST',
        body: JSON.stringify(datosCalculo)
      });
      return data;
    } catch (error) {
      console.error('Error al calcular inversión:', error);
      throw error;
    }
  }

  /**
   * Crea una inversión para un vehículo
   * @param {Object} inversionData - Datos de la inversión
   * @returns {Promise<Object>} Inversión creada
   */
  async crearInversionVehiculo(inversionData) {
    if (!inversionData) throw new Error('Datos de inversión requeridos');
    
    try {
      const data = await this.fetchWithAuth('/admin/inversiones/vehiculo', {
        method: 'POST',
        body: JSON.stringify(inversionData)
      });
      return data;
    } catch (error) {
      console.error('Error al crear inversión:', error);
      throw error;
    }
  }

  /**
   * Obtiene inversiones de un vehículo
   * @param {string} numeroSerie - Número de serie del vehículo
   * @returns {Promise<Object>} Inversiones del vehículo
   */
  async getInversionesByVehiculo(numeroSerie) {
    
    if (!numeroSerie) throw new Error('Número de serie requerido');
    
    try {
      const data = await this.fetchWithAuth(`/admin/inversiones/vehiculo/${numeroSerie}`);
      return data;
    } catch (error) {
      console.error('Error al obtener inversiones del vehículo:', error);
      throw error;
    }
  }
/**
   * Calcula inversión modelo SI Legado
   * @param {Object} datosCalculo - Datos para calcular
   * @returns {Promise<Object>} Cálculos de inversión SI Legado
   */
  async calcularInversionSILegado(datosCalculo) {
    if (!datosCalculo) throw new Error('Datos de cálculo requeridos');
    
    try {
      const data = await this.fetchWithAuth('/admin/inversiones/calcular/si-legado', {
        method: 'POST',
        body: JSON.stringify(datosCalculo)
      });
      return data;
    } catch (error) {
      console.error('Error al calcular inversión SI Legado:', error);
      throw error;
    }
  }

  /**
   * Calcula inversión modelo AutoManager
   * @param {Object} datosCalculo - Datos para calcular
   * @returns {Promise<Object>} Cálculos de inversión AutoManager
   */
  async calcularInversionAutoManager(datosCalculo) {
    if (!datosCalculo) throw new Error('Datos de cálculo requeridos');
    
    try {
      const data = await this.fetchWithAuth('/admin/inversiones/calcular/automanager', {
        method: 'POST',
        body: JSON.stringify(datosCalculo)
      });
      return data;
    } catch (error) {
      console.error('Error al calcular inversión AutoManager:', error);
      throw error;
    }
  }

  /**
   * Obtiene el multiplicador actual del sistema
   * @returns {Promise<Object>} Multiplicador actual
   */
  async getMultiplicadorSistema() {
    try {
      const data = await this.fetchWithAuth('/admin/inversiones/parametros/multiplicador');
      return data;
    } catch (error) {
      console.error('Error al obtener multiplicador:', error);
      throw error;
    }
  }

  /**
   * Actualiza el multiplicador del sistema (solo super admin)
   * @param {number} nuevoValor - Nuevo valor del multiplicador
   * @returns {Promise<Object>} Confirmación de actualización
   */
  async updateMultiplicadorSistema(nuevoValor) {
    if (!nuevoValor) throw new Error('Nuevo valor requerido');
    
    try {
      const data = await this.fetchWithAuth('/admin/inversiones/parametros/multiplicador', {
        method: 'PUT',
        body: JSON.stringify({ nuevoValor })
      });
      return data;
    } catch (error) {
      console.error('Error al actualizar multiplicador:', error);
      throw error;
    }
  }
  // ============= CONDUCTORES =============
  
  /**
   * Obtiene todos los conductores
   * @returns {Promise<Object>} Lista de conductores
   */
  async getConductores() {
    try {
      const data = await this.fetchWithAuth('/admin/conductores');
      return data;
    } catch (error) {
      console.error('Error al obtener conductores:', error);
      throw error;
    }
  }
// Obtener vehículos disponibles (sin conductor asignado)
async getVehiculosDisponibles() {
  const response = await this.fetchWithAuth('/admin/vehiculos/disponibles');
  return response;
}

async asignarVehiculo(conductorId, vehiculoId, data) {
  const response = await this.fetchWithAuth(`/admin/conductores/${conductorId}/asignar-vehiculo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      vehiculoId: vehiculoId,
      rentaDiaria: data.rentaDiaria,
      abonoPoliza: data.abonoPoliza,
      fechaInicio: data.fechaInicio
    })
  });
  return response;
}

async desasignarVehiculo(conductorId) {
  const response = await this.fetchWithAuth(`/admin/conductores/${conductorId}/desasignar-vehiculo`, {
    method: 'DELETE'
  });
  return response;
}

async cambiarStatusConductor(conductorId, status, motivo = null) {
  const response = await this.fetchWithAuth(`/admin/conductores/${conductorId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status,
      motivo
    })
  });
  return response;
}
  /**
   * Obtiene un conductor por ID
   * @param {string|number} id - ID del conductor
   * @returns {Promise<Object>} Datos del conductor
   */
  async getConductorById(id) {
    if (!id) throw new Error('ID de conductor requerido');
    
    try {
      const data = await this.fetchWithAuth(`/admin/conductores/${id}`);
      return data;
    } catch (error) {
      console.error('Error al obtener conductor:', error);
      throw error;
    }
  }

  /**
 * Crea un nuevo conductor
 * @param {FormData|Object} conductorData - Datos del conductor (puede ser FormData para archivos o JSON)
 * @returns {Promise<Object>} Conductor creado
 */
 async createConductor(conductorData) {
    if (!conductorData) throw new Error('Datos del conductor requeridos');
    const isFormData = conductorData instanceof FormData;

    try {
      const payload = isFormData 
        ? conductorData 
        : JSON.stringify(conductorData);

      const data = await this.fetchWithAuth('/admin/conductores', {
        method: 'POST',
        body: payload,
        headers: isFormData ? {} : { 'Content-Type': 'application/json' }
      });

      return data;
    } catch (error) {
      console.error('Error al crear conductor:', error);
      throw error;
    }
  }

  /**
   * Actualiza un conductor existente
   * @param {string|number} id - ID del conductor
   * @param {Object} conductorData - Datos actualizados
   * @returns {Promise<Object>} Conductor actualizado
   */
  async updateConductor(id, conductorData) {
    if (!id) throw new Error('ID de conductor requerido');
    if (!conductorData) throw new Error('Datos del conductor requeridos');
    
    try {
      const isFormData = conductorData instanceof FormData;
      const payload = isFormData 
        ? conductorData 
        : JSON.stringify(conductorData);

      const data = await this.fetchWithAuth(`/admin/conductores/${id}`, {
        method: 'PUT',
        body: payload,
        headers: isFormData ? {} : { 'Content-Type': 'application/json' }
      });
      return data;
    } catch (error) {
      console.error('Error al actualizar conductor:', error);
      throw error;
    }
  }

  /**
   * Elimina un conductor
   * @param {string|number} id - ID del conductor
   * @returns {Promise<Object>} Confirmación de eliminación
   */
  async deleteConductor(id) {
    if (!id) throw new Error('ID de conductor requerido');
    
    try {
      const data = await this.fetchWithAuth(`/admin/conductores/${id}`, {
        method: 'DELETE'
      });
      return data;
    } catch (error) {
      console.error('Error al eliminar conductor:', error);
      throw error;
    }
  }

  // --- 👇 ¡AQUÍ ESTÁ LA NUEVA FUNCIÓN QUE DEBES AÑADIR! 👇 ---
  // --- (Pégala dentro de la clase 'AdminService', junto a las otras) ---

  /**
   * (NUEVA) Crea una cuenta de acceso (usuario) para un conductor existente.
   * @param {string|number} conductorId - ID del conductor
   * @returns {Promise<Object>} Respuesta con { success, email, password_temporal }
   */
  async crearAccesoConductor(conductorId) {
    if (!conductorId) throw new Error('ID de conductor requerido');
    
    try {
      // Llamamos a fetchWithAuth que es nuestra 'api' interna
      const response = await this.fetchWithAuth(`/admin/conductores/${conductorId}/crear-acceso`, {
        method: 'POST' // Hacemos una petición POST
      });
      return response; // fetchWithAuth ya parsea el JSON
    } catch (error) {
      console.error('Error al crear acceso para el conductor:', error.message);
      // Pasa el mensaje de error del backend si existe
      throw new Error(error.message || 'Error en el servidor al crear acceso');
    }
  }

  // --- 👆 FIN DE LA FUNCIÓN NUEVA 👆 ---


  // ============= PAGOS DE RENTAS (NUEVA LÓGICA) =============
  
  /**
   * Obtiene todos los pagos de rentas con filtros
   * @param {Object} filtros - Filtros opcionales
   * @returns {Promise<Object>} Lista de pagos paginada
   */
  async getPagosRentas(filtros = {}) {
    try {
      const params = new URLSearchParams();
      
      Object.keys(filtros).forEach(key => {
        if (filtros[key] !== '' && filtros[key] !== null && filtros[key] !== undefined) {
          params.append(key, filtros[key]);
        }
      });
      
      const queryString = params.toString();
      const endpoint = queryString ? `/admin/pagos-rentas?${queryString}` : '/admin/pagos-rentas';
      
      const data = await this.fetchWithAuth(endpoint);
      return data;
    } catch (error) {
      console.error('Error al obtener pagos de rentas:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de pagos de rentas
   * @param {Object} filtros - Filtros de fecha opcionales
   * @returns {Promise<Object>} Estadísticas
   */
  async getEstadisticasPagosRentas(filtros = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filtros.fecha_desde) params.append('fecha_desde', filtros.fecha_desde);
      if (filtros.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta);
      
      const queryString = params.toString();
      const endpoint = queryString 
        ? `/admin/pagos-rentas/estadisticas?${queryString}` 
        : '/admin/pagos-rentas/estadisticas';
      
      const data = await this.fetchWithAuth(endpoint);
      return data;
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      throw error;
    }
  }

  /**
   * Obtiene opciones para filtros de pagos
   * @returns {Promise<Object>} Opciones disponibles
   */
  async getOpcionesPagosRentas() {
    try {
      const data = await this.fetchWithAuth('/admin/pagos-rentas/opciones');
      return data;
    } catch (error) {
      console.error('Error al obtener opciones:', error);
      return {
        success: false,
        opciones: {
          conductores: [],
          vehiculos: [],
          metodos_pago: ['Efectivo', 'Transferencia', 'Stripe', 'Tarjeta'],
          estados: ['Pendiente', 'Confirmado', 'Rechazado'],
          tipos_socio: ['SD', 'SI', 'SA']
        }
      };
    }
  }

  /**
   * Valida un pago en efectivo
   * @param {number} pagoId - ID del pago
   * @param {Object} datos - Datos adicionales (observaciones)
   * @returns {Promise<Object>} Pago validado
   */
  async validarPagoRenta(pagoId, datos = {}) {
    if (!pagoId) throw new Error('ID de pago requerido');
    
    try {
      const response = await this.fetchWithAuth(`/admin/pagos-rentas/${pagoId}/validar`, {
        method: 'PUT',
        body: JSON.stringify(datos)
      });
      return response;
    } catch (error) {
      console.error('Error al validar pago:', error);
      throw error;
    }
  }

  /**
   * Rechaza un pago
   * @param {number} pagoId - ID del pago
   * @param {string} motivo - Motivo del rechazo
   * @returns {Promise<Object>} Confirmación
   */
  async rechazarPagoRenta(pagoId, motivo) {
    if (!pagoId) throw new Error('ID de pago requerido');
    if (!motivo) throw new Error('Motivo de rechazo requerido');
    
    try {
      const response = await this.fetchWithAuth(`/admin/pagos-rentas/${pagoId}/rechazar`, {
        method: 'PUT',
        body: JSON.stringify({ motivo_rechazo: motivo })
      });
      return response;
    } catch (error) {
      console.error('Error al rechazar pago:', error);
      throw error;
    }
  }

  /**
   * Edita un pago de renta
   * @param {number} pagoId - ID del pago
   * @param {Object} datos - Datos a actualizar
   * @returns {Promise<Object>} Pago actualizado
   */
  async editarPagoRenta(pagoId, datos) {
    if (!pagoId) throw new Error('ID de pago requerido');
    
    try {
      const response = await this.fetchWithAuth(`/admin/pagos-rentas/${pagoId}/editar`, {
        method: 'PUT',
        body: JSON.stringify(datos)
      });
      return response;
    } catch (error) {
      console.error('Error al editar pago:', error);
      throw error;
    }
  }

  /**
   * Elimina un pago de renta
   * @param {number} pagoId - ID del pago
   * @returns {Promise<Object>} Confirmación
   */
async eliminarPagoRenta(id, motivo) {
  try {
    const data = await this.fetchWithAuth(`/admin/pagos-rentas/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json' // Importante para enviar JSON
      },
      // Enviamos el objeto con la propiedad "motivo"
      body: JSON.stringify({ motivo: motivo }) 
    });
    return data;
  } catch (error) {
    throw error;
  }
}

  /**
   * Obtiene historial de pagos de un conductor
   * @param {number} conductorId - ID del conductor
   * @returns {Promise<Object>} Historial de pagos
   */
  async getHistorialPagosConductor(conductorId) {
    if (!conductorId) throw new Error('ID de conductor requerido');
    
    try {
      const data = await this.fetchWithAuth(`/admin/pagos-rentas/conductor/${conductorId}/historial`);
      return data;
    } catch (error) {
      console.error('Error al obtener historial:', error);
      throw error;
    }
  }

  /**
   * Obtiene la siguiente fecha pendiente de pago de un conductor
   * @param {number} conductorId - ID del conductor
   * @returns {Promise<Object>} Información del siguiente pago pendiente
   */
  async getSiguientePagoPendiente(conductorId) {
    if (!conductorId) throw new Error('ID de conductor requerido');

    try {
      const data = await this.fetchWithAuth(`/admin/pagos-rentas/conductor/${conductorId}/siguiente-pendiente`);
      return data;
    } catch (error) {
      console.error('Error al obtener siguiente pago pendiente:', error);
      throw error;
    }
  }
// frontend/src/services/adminService.js

// ============= SINIESTROS =============

/**
 * Obtiene todos los siniestros
 * @param {Object} filtros - Filtros opcionales
 * @returns {Promise<Object>} Lista de siniestros
 */
async getSiniestros(filtros = {}) {
  try {
    const params = new URLSearchParams();
    
    Object.keys(filtros).forEach(key => {
      if (filtros[key] !== '' && filtros[key] !== null && filtros[key] !== undefined) {
        params.append(key, filtros[key]);
      }
    });
    
    const queryString = params.toString();
    const endpoint = queryString ? `/admin/siniestros?${queryString}` : '/admin/siniestros';
    
    const data = await this.fetchWithAuth(endpoint);
    return data;
  } catch (error) {
    console.error('Error al obtener siniestros:', error);
    throw error;
  }
}

/**
 * Obtiene un siniestro por ID
 * @param {string|number} id - ID del siniestro
 * @returns {Promise<Object>} Datos del siniestro
 */
async getSiniestroById(id) {
  if (!id) throw new Error('ID de siniestro requerido');
  
  try {
    const data = await this.fetchWithAuth(`/admin/siniestros/${id}`);
    return data;
  } catch (error) {
    console.error('Error al obtener siniestro:', error);
    throw error;
  }
}

/**
 * Obtiene historial de siniestros de un vehículo
 * @param {string|number} vehiculoId - ID del vehículo
 * @returns {Promise<Object>} Historial de siniestros
 */
async getSiniestrosVehiculo(vehiculoId) {
  if (!vehiculoId) throw new Error('ID de vehículo requerido');
  
  try {
    const data = await this.fetchWithAuth(`/admin/siniestros/vehiculo/${vehiculoId}/historial`);
    return data;
  } catch (error) {
    console.error('Error al obtener siniestros del vehículo:', error);
    throw error;
  }
}

/**
 * Obtiene historial de siniestros de un conductor
 * @param {string|number} conductorId - ID del conductor
 * @returns {Promise<Object>} Historial de siniestros
 */
async getSiniestrosConductor(conductorId) {
  if (!conductorId) throw new Error('ID de conductor requerido');
  
  try {
    const data = await this.fetchWithAuth(`/admin/siniestros/conductor/${conductorId}/historial`);
    return data;
  } catch (error) {
    console.error('Error al obtener siniestros del conductor:', error);
    throw error;
  }
}

/**
 * Crea un nuevo siniestro
 * @param {FormData} formData - Datos del siniestro con archivos
 * @returns {Promise<Object>} Siniestro creado
 */
async createSiniestro(formData) {
  if (!formData) throw new Error('Datos del siniestro requeridos');
  
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${this.baseURL}/admin/siniestros`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // NO incluir Content-Type para FormData
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al crear siniestro');
    }

    return await response.json();
  } catch (error) {
    console.error('Error al crear siniestro:', error);
    throw error;
  }
}

/**
 * Actualiza un siniestro existente
 * @param {string|number} id - ID del siniestro
 * @param {Object} siniestroData - Datos actualizados
 * @returns {Promise<Object>} Siniestro actualizado
 */
async updateSiniestro(id, siniestroData) {
  if (!id) throw new Error('ID de siniestro requerido');
  if (!siniestroData) throw new Error('Datos del siniestro requeridos');
  
  try {
    const data = await this.fetchWithAuth(`/admin/siniestros/${id}`, {
      method: 'PUT',
      body: JSON.stringify(siniestroData)
    });
    return data;
  } catch (error) {
    console.error('Error al actualizar siniestro:', error);
    throw error;
  }
}

/**
 * Elimina un siniestro
 * @param {string|number} id - ID del siniestro
 * @returns {Promise<Object>} Confirmación de eliminación
 */
async deleteSiniestro(id) {
  if (!id) throw new Error('ID de siniestro requerido');
  
  try {
    const data = await this.fetchWithAuth(`/admin/siniestros/${id}`, {
      method: 'DELETE'
    });
    return data;
  } catch (error) {
    console.error('Error al eliminar siniestro:', error);
    throw error;
  }
}

/**
 * Obtiene estadísticas de siniestros
 * @param {Object} filtros - Filtros de fecha opcionales
 * @returns {Promise<Object>} Estadísticas
 */
async getEstadisticasSiniestros(filtros = {}) {
  try {
    const params = new URLSearchParams();
    
    if (filtros.fecha_desde) params.append('fecha_desde', filtros.fecha_desde);
    if (filtros.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta);
    
    const queryString = params.toString();
    const endpoint = queryString 
      ? `/admin/siniestros/estadisticas?${queryString}` 
      : '/admin/siniestros/estadisticas';
    
    const data = await this.fetchWithAuth(endpoint);
    return data;
  } catch (error) {
    console.error('Error al obtener estadísticas de siniestros:', error);
    throw error;
  }
}

/**
 * Obtiene opciones para filtros de siniestros
 * @returns {Promise<Object>} Opciones disponibles
 */
async getOpcionesSiniestros() {
  try {
    const data = await this.fetchWithAuth('/admin/siniestros/opciones');
    return data;
  } catch (error) {
    console.error('Error al obtener opciones de siniestros:', error);
    return {
      success: false,
      opciones: {
        tipos: ['Choque', 'Robo', 'Vandalismo', 'Accidente', 'Otro'],
        estados: ['Reportado', 'En revisión', 'En proceso', 'Resuelto', 'Cerrado'],
        gravedad: ['Leve', 'Moderado', 'Grave', 'Total']
      }
    };
  }
}

// ============= MANTENIMIENTOS =============

/**
 * Obtiene mantenimientos de un vehículo
 * @param {string|number} vehiculoId - ID del vehículo
 * @returns {Promise<Object>} Historial de mantenimientos
 */
async getMantenimientosVehiculo(vehiculoId) {
  if (!vehiculoId) throw new Error('ID de vehículo requerido');
  
  try {
    const data = await this.fetchWithAuth(`/admin/mantenimientos/vehiculo/${vehiculoId}`);
    return data;
  } catch (error) {
    console.error('Error al obtener mantenimientos del vehículo:', error);
    throw error;
  }
}

/**
 * Obtiene opciones para mantenimientos
 * @returns {Promise<Object>} Opciones disponibles
 */
async getOpcionesMantenimientos() {
  try {
    const data = await this.fetchWithAuth('/admin/mantenimientos/opciones');
    return data;
  } catch (error) {
    console.error('Error al obtener opciones de mantenimientos:', error);
    return {
      success: false,
      opciones: {
        tipos_servicio: [
          'Cambio de aceite',
          'Alineación y balanceo',
          'Revisión general',
          'Cambio de llantas',
          'Frenos',
          'Suspensión',
          'Verificación vehicular',
          'Limpieza profunda',
          'Reparación mecánica',
          'Otros'
        ],
        talleres: []
      }
    };
  }
}

/**
 * Programa un nuevo mantenimiento
 * @param {Object} datos - Datos del mantenimiento
 * @returns {Promise<Object>} Mantenimiento programado
 */
async programarMantenimiento(datos) {
  if (!datos) throw new Error('Datos del mantenimiento requeridos');
  
  try {
    const data = await this.fetchWithAuth('/admin/mantenimientos', {
      method: 'POST',
      body: JSON.stringify(datos)
    });
    return data;
  } catch (error) {
    console.error('Error al programar mantenimiento:', error);
    throw error;
  }
}
// ============= DISTRIBUCIÓN DE GASTOS MANTENIMIENTO =============
  
  /**
   * Obtiene mantenimientos completados pendientes de distribución
   * @returns {Promise<Object>} Lista de mantenimientos pendientes
   */
  async getMantenimientosPendientesDistribucion() {
    try {
      const data = await this.fetchWithAuth('/admin/mantenimientos/pendientes-distribucion');
      return data;
    } catch (error) {
      console.error('Error al obtener mantenimientos pendientes:', error);
      throw error;
    }
  }

  /**
   * Distribuye el gasto de un mantenimiento entre diferentes fuentes
   * @param {number} mantenimientoId - ID del mantenimiento
   * @param {Object} distribucion - Distribución de gastos
   * @returns {Promise<Object>} Confirmación de distribución
   */
  async distribuirGastoMantenimiento(mantenimientoId, distribucion) {
    if (!mantenimientoId) throw new Error('ID de mantenimiento requerido');
    if (!distribucion) throw new Error('Datos de distribución requeridos');
    
    try {
      const data = await this.fetchWithAuth(`/admin/mantenimientos/${mantenimientoId}/distribuir-gasto`, {
        method: 'POST',
        body: JSON.stringify(distribucion)
      });
      return data;
    } catch (error) {
      console.error('Error al distribuir gasto:', error);
      throw error;
    }
  }

/**
 * Elimina un mantenimiento
 * @param {string|number} id - ID del mantenimiento
 * @returns {Promise<Object>} Confirmación de eliminación
 */
async deleteMantenimiento(id) {
  if (!id) throw new Error('ID de mantenimiento requerido');
  
  try {
    const data = await this.fetchWithAuth(`/admin/mantenimientos/${id}`, {
      method: 'DELETE'
    });
    return data;
  } catch (error) {
    console.error('Error al eliminar mantenimiento:', error);
    throw error;
  }
}

  // ============= DASHBOARD =============
  
  /**
   * Obtiene estadísticas del dashboard
   * @returns {Promise<Object>} Estadísticas
   */
  async getDashboardStats() {
    try {
      const [response, pagosRentasResponse, mantenimientosResponse] = await Promise.all([
        this.fetchWithAuth('/admin/estadisticas'),
        this.fetchWithAuth('/admin/pagos-rentas/estadisticas'),
        this.fetchWithAuth('/admin/mantenimientos/estadisticas')
      ]);
      const pagosRentasStats = pagosRentasResponse?.estadisticas || {};
      const mantenimientosStats = mantenimientosResponse?.estadisticas || {};
      const montoTotalPagado = pagosRentasStats.total_cobrado ?? pagosRentasStats.cobrado_mes ?? 0;
      const montoTotalPendiente = pagosRentasStats.pendiente_validar_renta ?? 0;
      
      // Transformar la respuesta al formato que espera Dashboard
      if (response.estadisticas) {
        return {
          vehiculos: {
            total: response.estadisticas.totalVehiculos || 0,
            disponibles: response.estadisticas.vehiculosDisponibles || 0,
            rentados: response.estadisticas.vehiculosRentados || 0,
            enMantenimiento: response.estadisticas.vehiculosMantenimiento || 0,
            enSiniestro: 0,
            baja: 0
          },
          conductores: {
            total: response.estadisticas.totalConductores || 0,
            activos: response.estadisticas.conductoresActivos || 0,
            aprobados: response.estadisticas.conductoresAprobados || 0,
            pendientes: response.estadisticas.conductoresPendientes || 0,
            rechazados: response.estadisticas.conductoresRechazados || 0,
            inactivos: response.estadisticas.conductoresInactivos ||
              Math.max(0, (response.estadisticas.conductoresAprobados || 0) - (response.estadisticas.conductoresActivos || 0))
          },
          rentas: {
            total: response.estadisticas.totalRentas || 0,
            pendientes: response.estadisticas.rentasPendientes || 0,
            pagadas: response.estadisticas.rentasPagadas || 0,
            vencidas: response.estadisticas.rentasVencidas || 0,
            montoTotalPagado,
            montoTotalPendiente
          },
          mantenimientos: {
            total: response.estadisticas.totalMantenimientos || 0,
            programados: mantenimientosStats.programados ?? response.estadisticas.mantenimientosProgramados ?? 0,
            completados: mantenimientosStats.completados_mes ?? response.estadisticas.mantenimientosCompletados ?? 0,
            enProceso: mantenimientosStats.en_proceso ?? response.estadisticas.mantenimientosEnProceso ?? 0
          },
          siniestros: {
            total: response.estadisticas.totalSiniestros || 0,
            reportados: response.estadisticas.siniestrosReportados || 0,
            enProceso: response.estadisticas.siniestrosEnProceso || 0,
            resueltos: response.estadisticas.siniestrosResueltos || 0
          }
        };
      }
      
      return response;
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      // Retornar estructura completa vacía
      return {
        vehiculos: { total: 0, disponibles: 0, rentados: 0, enMantenimiento: 0, enSiniestro: 0, baja: 0 },
        conductores: { total: 0, activos: 0, aprobados: 0, pendientes: 0, rechazados: 0, inactivos: 0 },
        rentas: { total: 0, pendientes: 0, pagadas: 0, vencidas: 0, montoTotalPagado: 0, montoTotalPendiente: 0 },
        mantenimientos: { total: 0, programados: 0, completados: 0, enProceso: 0 },
        siniestros: { total: 0, reportados: 0, enProceso: 0, resueltos: 0 }
      };
    }
  }

  /**
   * Obtiene actividad reciente
   * @returns {Promise<Object>} Actividad reciente
   */
  async getRecentActivity() {
    try {
      const data = await this.fetchWithAuth('/admin/dashboard/activity');
      return data;
    } catch (error) {
      console.error('Error al obtener actividad reciente:', error);
      return [];
    }
  }

  /**
   * Alias para getDashboardStats (compatibilidad con código legacy)
   * @returns {Promise<Object>} Estadísticas
   */
  async getEstadisticas() {
    return this.getDashboardStats();
  }
// ============= NUEVOS MÉTODOS - GRÁFICAS Y ESTADÍSTICAS RENTAS =============

/**
 * Obtener datos para gráfica de cobranza diaria
 * @param {Object} params - Parámetros (dias)
 * @returns {Promise<Object>} Datos de la gráfica
 */
async getGraficaDiaria(params = {}) {
  try {
    const queryParams = new URLSearchParams(params);
    const endpoint = `/admin/pagos-rentas/grafica-diaria?${queryParams}`;
    const data = await this.fetchWithAuth(endpoint);
    return data;
  } catch (error) {
    console.error('Error al obtener gráfica diaria:', error);
    throw error;
  }
}

/**
 * Obtener tendencia mensual
 * @param {Object} params - Parámetros (meses)
 * @returns {Promise<Object>} Datos de tendencia
 */
async getTendenciaMensual(params = {}) {
  try {
    const queryParams = new URLSearchParams(params);
    const endpoint = `/admin/pagos-rentas/tendencia-mensual?${queryParams}`;
    const data = await this.fetchWithAuth(endpoint);
    return data;
  } catch (error) {
    console.error('Error al obtener tendencia mensual:', error);
    throw error;
  }
}

/**
 * Obtener distribución por tipo socio
 * @returns {Promise<Object>} Distribución por tipo
 */
async getDistribucionTipoSocio() {
  try {
    const data = await this.fetchWithAuth('/admin/pagos-rentas/distribucion-tipo-socio');
    return data;
  } catch (error) {
    console.error('Error al obtener distribución:', error);
    throw error;
  }
}

/**
 * Obtener top conductores
 * @param {Object} params - Parámetros (limite, periodo)
 * @returns {Promise<Array>} Lista de top conductores
 */
async getTopConductores(params = {}) {
  try {
    const queryParams = new URLSearchParams(params);
    const endpoint = `/admin/pagos-rentas/top-conductores?${queryParams}`;
    const data = await this.fetchWithAuth(endpoint);
    return data;
  } catch (error) {
    console.error('Error al obtener top conductores:', error);
    return { top_conductores: [] };
  }
}

/**
 * Obtener conductores morosos
 * @returns {Promise<Array>} Lista de conductores morosos
 */
async getConductoresMorosos() {
  try {
    const data = await this.fetchWithAuth('/admin/pagos-rentas/conductores-morosos');
    return data;
  } catch (error) {
    console.error('Error al obtener conductores morosos:', error);
    return { conductores_morosos: [] };
  }
}
  // ============= MÉTODOS DE UTILIDAD =============
  
  /**
   * Verifica si el usuario tiene permisos para una acción
   * @param {string} action - Acción a verificar (view, create, edit, delete)
   * @param {string} module - Módulo donde se realiza la acción
   * @returns {boolean} True si tiene permisos
   */
  hasPermission(action, module) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const rol = user.rol || user.role;
    
    const permisos = {
      'super_admin': ['all'],
      'director': ['view', 'create', 'edit', 'delete'],
      'gerente_ops': ['view', 'create', 'edit'],
      'contador': ['view'],
      'gestor_flota': ['view', 'edit'],
      'reclutador': ['view'],
      'jefe_taller': ['view', 'edit'],
      'compras': ['view'],
      'conductor': []
    };
    
    const rolPermisos = permisos[rol] || [];
    return rolPermisos.includes('all') || rolPermisos.includes(action);
  }

  /**
   * Obtiene información del usuario actual
   * @returns {Object} Datos del usuario
   */
  getCurrentUser() {
    return JSON.parse(localStorage.getItem('user') || '{}');
  }

  /**
   * Verifica si hay una sesión activa
   * @returns {boolean} True si hay sesión
   */
  isAuthenticated() {
    return !!localStorage.getItem('token');
  }

  /**
   * Obtiene el token actual
   * @returns {string|null} Token JWT o null
   */
  getToken() {
    return localStorage.getItem('token');
  }
  
  // ============= ASIGNACIONES Y HISTORIAL DE VEHÍCULOS =============

/**
 * Obtiene el historial completo de un vehículo por número de serie
 * @param {string} numeroSerie - Número de serie del vehículo
 * @returns {Promise<Object>} Historial completo del vehículo
 */
async getHistorialVehiculo(numeroSerie) {
  if (!numeroSerie) throw new Error('Número de serie requerido');
  
  try {
    const data = await this.fetchWithAuth(`/admin/asignaciones/vehiculo/${numeroSerie}/historial`);
    return data;
  } catch (error) {
    console.error('Error al obtener historial del vehículo:', error);
    throw error;
  }
}

  // ========== CONDUCTORES DISPONIBLES ==========
  
  /**
   * Obtiene conductores disponibles para asignación
   * @returns {Promise<Object>} Lista de conductores sin vehículo
   */
  async getConductoresDisponibles() {
    try {
      const data = await this.fetchWithAuth('/admin/asignaciones/conductores-disponibles');
      return data;
    } catch (error) {
      console.error('Error obteniendo conductores disponibles:', error);
      throw error;
    }
  }
async getPolizasSeguro() {
  return this.fetchWithAuth('/vehiculos/polizas-seguro');
}
  /**
   * Asigna un conductor a un vehículo
   * @param {number} vehiculoId - ID del vehículo
   * @param {Object} datos - Datos de la asignación
   * @returns {Promise<Object>} Resultado de la asignación
   */
  async asignarConductorAVehiculo(vehiculoId, datos) {
    try {
      const data = await this.fetchWithAuth(`/admin/vehiculos/${vehiculoId}/asignar-conductor`, {
        method: 'POST',
        body: JSON.stringify(datos)
      });
      return data;
    } catch (error) {
      console.error('Error asignando conductor:', error);
      throw error;
    }
  }
  // ============= 🆕 PLAN DE CARRERA Y PÓLIZA MECÁNICA =============
  
  /**
   * Obtiene amonestaciones de un conductor
   * @param {string|number} conductorId - ID del conductor
   * @returns {Promise<Object>} Lista de amonestaciones
   */
  async getAmonestaciones(conductorId) {
    if (!conductorId) throw new Error('ID de conductor requerido');
    
    try {
      const data = await this.fetchWithAuth(`/admin/conductores/${conductorId}/amonestaciones`);
      return data;
    } catch (error) {
      console.error('Error al obtener amonestaciones:', error);
      throw error;
    }
  }

  /**
   * Registra una amonestación para un conductor
   * @param {string|number} conductorId - ID del conductor
   * @param {Object} amonestacionData - Datos de la amonestación
   * @returns {Promise<Object>} Amonestación creada
   */
  async amonestar(conductorId, amonestacionData) {
    if (!conductorId) throw new Error('ID de conductor requerido');
    if (!amonestacionData || !amonestacionData.motivo) {
      throw new Error('El motivo de la amonestación es obligatorio');
    }
    
    try {
      const data = await this.fetchWithAuth(`/admin/conductores/${conductorId}/amonestar`, {
        method: 'POST',
        body: JSON.stringify(amonestacionData)
      });
      return data;
    } catch (error) {
      console.error('Error al registrar amonestación:', error);
      throw error;
    }
  }

  /**
   * Promueve un conductor a Socio Dueño
   * @param {string|number} conductorId - ID del conductor
   * @returns {Promise<Object>} Confirmación de promoción
   */
  async promoverASocioDueno(conductorId) {
    if (!conductorId) throw new Error('ID de conductor requerido');
    
    try {
      const data = await this.fetchWithAuth(`/admin/conductores/${conductorId}/promover-a-sd`, {
        method: 'POST'
      });
      return data;
    } catch (error) {
      console.error('Error al promover conductor:', error);
      throw error;
    }
  }

  /**
   * Ajusta el saldo de la póliza mecánica de un conductor
   * @param {string|number} conductorId - ID del conductor
   * @param {Object} ajusteData - Datos del ajuste (monto, tipo_ajuste, motivo)
   * @returns {Promise<Object>} Confirmación del ajuste
   */
  async ajustarPolizaMecanica(conductorId, ajusteData) {
    if (!conductorId) throw new Error('ID de conductor requerido');
    if (!ajusteData || !ajusteData.monto || !ajusteData.tipo_ajuste) {
      throw new Error('Monto y tipo de ajuste son obligatorios');
    }
    
    try {
      const data = await this.fetchWithAuth(`/admin/conductores/${conductorId}/poliza-mecanica`, {
        method: 'PATCH',
        body: JSON.stringify(ajusteData)
      });
      return data;
    } catch (error) {
      console.error('Error al ajustar póliza mecánica:', error);
      throw error;
    }
  }
  // ============= 🆕 GESTIÓN DE USUARIOS =============
  
  /**
   * Obtiene todos los usuarios con filtros y paginación
   * @param {Object} params - Parámetros de búsqueda y filtros
   * @returns {Promise<Object>} Lista de usuarios paginada
   */
  async getUsuarios(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // Agregar parámetros si existen
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.rol) queryParams.append('rol', params.rol);
      if (params.estado) queryParams.append('estado', params.estado);
      if (params.search) queryParams.append('search', params.search);
      
      const queryString = queryParams.toString();
      const endpoint = queryString ? `/admin/usuarios?${queryString}` : '/admin/usuarios';
      
      const data = await this.fetchWithAuth(endpoint);
      return data;
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }
  }

  /**
   * Obtiene un usuario por ID
   * @param {string|number} id - ID del usuario
   * @returns {Promise<Object>} Datos del usuario
   */
  async getUsuarioById(id) {
    if (!id) throw new Error('ID de usuario requerido');
    
    try {
      const data = await this.fetchWithAuth(`/admin/usuarios/${id}`);
      return data;
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      throw error;
    }
  }

  /**
   * Crea un nuevo usuario
   * @param {Object} usuarioData - Datos del usuario
   * @returns {Promise<Object>} Usuario creado con contraseña temporal
   */
  async createUsuario(usuarioData) {
    if (!usuarioData) throw new Error('Datos del usuario requeridos');
    
    try {
      console.log('Creando usuario:', usuarioData);
      const data = await this.fetchWithAuth('/admin/usuarios', {
        method: 'POST',
        body: JSON.stringify(usuarioData)
      });
      return data;
    } catch (error) {
      console.error('Error al crear usuario:', error);
      throw error;
    }
  }

  /**
   * Actualiza un usuario existente
   * @param {string|number} id - ID del usuario
   * @param {Object} usuarioData - Datos actualizados
   * @returns {Promise<Object>} Usuario actualizado
   */
  async updateUsuario(id, usuarioData) {
    if (!id) throw new Error('ID de usuario requerido');
    if (!usuarioData) throw new Error('Datos del usuario requeridos');
    
    try {
      console.log('Actualizando usuario:', id, usuarioData);
      const data = await this.fetchWithAuth(`/admin/usuarios/${id}`, {
        method: 'PUT',
        body: JSON.stringify(usuarioData)
      });
      return data;
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      throw error;
    }
  }

  /**
   * Resetea la contraseña de un usuario
   * @param {string|number} id - ID del usuario
   * @returns {Promise<Object>} Nueva contraseña temporal
   */
  async resetearPasswordUsuario(id) {
    if (!id) throw new Error('ID de usuario requerido');
    
    try {
      const data = await this.fetchWithAuth(`/admin/usuarios/${id}/resetear-password`, {
        method: 'POST'
      });
      return data;
    } catch (error) {
      console.error('Error al resetear contraseña:', error);
      throw error;
    }
  }

  /**
   * Cambia el estado de un usuario
   * @param {string|number} id - ID del usuario
   * @param {string} nuevoEstado - Nuevo estado (Activo, suspendido, prohibido)
   * @returns {Promise<Object>} Confirmación
   */
  async cambiarEstadoUsuario(id, nuevoEstado) {
    if (!id) throw new Error('ID de usuario requerido');
    if (!nuevoEstado) throw new Error('Nuevo estado requerido');
    
    try {
      const data = await this.fetchWithAuth(`/admin/usuarios/${id}/cambiar-estado`, {
        method: 'PUT',
        body: JSON.stringify({ nuevo_estado: nuevoEstado })
      });
      return data;
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      throw error;
    }
  }

  /**
   * Elimina un usuario (soft delete recomendado)
   * @param {string|number} id - ID del usuario
   * @param {boolean} forceDelete - Si es true, elimina permanentemente
   * @returns {Promise<Object>} Confirmación
   */
  async deleteUsuario(id, forceDelete = false) {
    if (!id) throw new Error('ID de usuario requerido');
    
    try {
      const queryParam = forceDelete ? '?force_delete=true' : '';
      const data = await this.fetchWithAuth(`/admin/usuarios/${id}${queryParam}`, {
        method: 'DELETE'
      });
      return data;
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      throw error;
    }
  }

  async verificarPagosPendientes(conductorId) {
    try {
      const data = await this.fetchWithAuth(`/admin/pagos-rentas/verificar-pendientes/${conductorId}`);
      return data;
    } catch (error) {
      console.error('Error al verificar pendientes:', error);
      return { existe: false }; // En caso de error, dejamos pasar por defecto
    }
  }
  
} // ← Cierre de la clase

// Exportar instancia única (Singleton)
const adminService = new AdminService();

export default adminService;
