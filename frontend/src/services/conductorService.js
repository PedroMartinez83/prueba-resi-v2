// frontend/src/services/conductorService.js

/**
 * Servicio para manejar todas las operaciones del PORTAL DE CONDUCTOR
 * @module conductorService
 */

import { API_BASE_URL } from './api';

class ConductorService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Método auxiliar para hacer peticiones con autenticación
   * @private
   */
  async fetchWithAuth(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('No hay sesión activa');
    }
    
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.defaultHeaders,
          'Authorization': `Bearer ${token}`,
          ...options.headers
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/conductor/login';
          throw new Error('Sesión expirada');
        }
        
        const errorPayload = await response.json().catch(() => ({
          message: `Error ${response.status}: ${response.statusText}`
        }));
        
        const detail = errorPayload?.error ? `: ${errorPayload.error}` : '';
        const requestError = new Error((errorPayload.message || 'Error en la petición') + detail);
        requestError.status = response.status;
        requestError.details = errorPayload;
        throw requestError;
      }

      const refreshedToken = response.headers.get('x-refreshed-token');
      if (refreshedToken) {
        localStorage.setItem('token', refreshedToken);
      }

      if (response.status === 204) {
        return { success: true };
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error('Error de conexión. Verifica tu conexión a internet.');
      }
      throw error;
    }
  }

  // ============= DASHBOARD =============
  
  /**
   * Obtiene todos los datos para el dashboard del conductor
   * @returns {Promise<Object>} Datos del dashboard
   */
  async getDashboardData() {
    try {
      const data = await this.fetchWithAuth('/conductor/dashboard');
      return data;
    } catch (error) {
      console.error('Error al obtener datos del dashboard:', error);
      throw error;
    }
  }

  /**
   * Obtiene información del perfil del conductor
   * @returns {Promise<Object>} Datos del conductor
   */
  async getMiPerfil() {
    try {
      const data = await this.fetchWithAuth('/conductor/perfil');
      return data;
    } catch (error) {
      console.error('Error al obtener perfil:', error);
      throw error;
    }
  }

  /**
   * Obtiene documentos del conductor
   * @returns {Promise<Object>} Documentos del conductor
   */
  async getMisDocumentos() {
    try {
      const data = await this.fetchWithAuth('/conductor/documentos');
      return data;
    } catch (error) {
      console.error('Error al obtener documentos:', error);
      throw error;
    }
  }

  /**
   * Sube o actualiza un documento del conductor
   * @param {FormData} formData - Datos del documento con archivo
   * @returns {Promise<Object>} Confirmación
   */
  async subirDocumento(formData) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${this.baseURL}/conductor/documentos/subir`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        const detail = error?.error ? `: ${error.error}` : '';
        throw new Error((error.message || 'Error al subir documento') + detail);
      }

      const refreshedToken = response.headers.get('x-refreshed-token');
      if (refreshedToken) {
        localStorage.setItem('token', refreshedToken);
      }

      return await response.json();
    } catch (error) {
      console.error('Error al subir documento:', error);
      throw error;
    }
  }

  // ============= MI VEHÍCULO =============
  
  /**
   * Obtiene información del vehículo asignado
   * @returns {Promise<Object>} Datos del vehículo
   */
  async getMiVehiculo() {
    try {
      const data = await this.fetchWithAuth('/conductor/vehiculo');
      return data;
    } catch (error) {
      console.error('Error al obtener vehículo:', error);
      throw error;
    }
  }

  /**
   * Actualiza el kilometraje del vehículo asignado al conductor
   * @param {number} kilometrajeActual - Nuevo kilometraje
   * @returns {Promise<Object>} Confirmación y contexto preventivo
   */
  async actualizarKilometrajeVehiculo(kilometrajeActual) {
    try {
      const data = await this.fetchWithAuth('/conductor/vehiculo/actualizar-kilometraje', {
        method: 'POST',
        body: JSON.stringify({ kilometraje_actual: kilometrajeActual })
      });
      return data;
    } catch (error) {
      console.error('Error al actualizar kilometraje del vehículo:', error);
      throw error;
    }
  }

  /**
   * Sube una revisión diaria del vehículo (video/fotos)
   * @param {FormData} formData - Datos de la revisión con archivos
   * @returns {Promise<Object>} Confirmación
   */
  async subirRevisionDiaria(formData) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${this.baseURL}/conductor/vehiculo/revision-diaria`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // NO agregar Content-Type para FormData
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al subir revisión');
      }

      return await response.json();
    } catch (error) {
      console.error('Error al subir revisión diaria:', error);
      throw error;
    }
  }

  /**
   * Obtiene historial de revisiones del vehículo
   * @returns {Promise<Array>} Lista de revisiones
   */
  async getHistorialRevisiones() {
    try {
      const data = await this.fetchWithAuth('/conductor/vehiculo/revisiones');
      return data;
    } catch (error) {
      console.error('Error al obtener revisiones:', error);
      throw error;
    }
  }

  // ============= PAGOS DE RENTA =============
  
  /**
   * Obtiene pagos de renta del conductor
   * @returns {Promise<Object>} Lista de pagos
   */
  async getMisPagos() {
    try {
      const data = await this.fetchWithAuth('/conductor/pagos');
      return data;
    } catch (error) {
      console.error('Error al obtener pagos:', error);
      throw error;
    }
  }

  /**
   * Registra un pago de renta (sube comprobante)
   * @param {FormData} formData - Datos del pago con comprobante
   * @returns {Promise<Object>} Confirmación
   */
  async registrarPago(formData) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${this.baseURL}/conductor/pagos/registrar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al registrar pago');
      }

      return await response.json();
    } catch (error) {
      console.error('Error al registrar pago:', error);
      throw error;
    }
  }


  /**
   * Obtiene resumen de cuenta del conductor
   * @returns {Promise<Object>} Resumen financiero
   */
  async getResumenCuenta() {
    try {
      const data = await this.fetchWithAuth('/conductor/pagos/resumen');
      return data;
    } catch (error) {
      console.error('Error al obtener resumen:', error);
      throw error;
    }
  }

  /**
   * Obtiene resumen para ponerse al tanto
   * @returns {Promise<Object>} Resumen de adeudos
   */
  async getResumenPonerseAlTanto() {
    try {
      const data = await this.fetchWithAuth('/conductor/pagos/ponerse-al-tanto/resumen');
      return data;
    } catch (error) {
      console.error('Error al obtener resumen para ponerse al tanto:', error);
      throw error;
    }
  }

  // ============= SINIESTROS =============
  
  /**
   * Registra un siniestro con fotos/videos
   * @param {FormData} formData - Datos del siniestro con archivos
   * @returns {Promise<Object>} Siniestro creado
   */
  async registrarSiniestro(formData) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${this.baseURL}/conductor/siniestros/registrar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al registrar siniestro');
      }

      return await response.json();
    } catch (error) {
      console.error('Error al registrar siniestro:', error);
      throw error;
    }
  }

  /**
   * Obtiene mis siniestros reportados
   * @returns {Promise<Array>} Lista de siniestros
   */
  async getMisSiniestros() {
    try {
      const data = await this.fetchWithAuth('/conductor/siniestros');
      return data;
    } catch (error) {
      console.error('Error al obtener siniestros:', error);
      throw error;
    }
  }

  /**
   * Obtiene detalle de un siniestro
   * @param {number} id - ID del siniestro
   * @returns {Promise<Object>} Detalle del siniestro
   */
  async getSiniestroById(id) {
    try {
      const data = await this.fetchWithAuth(`/conductor/siniestros/${id}`);
      return data;
    } catch (error) {
      console.error('Error al obtener siniestro:', error);
      throw error;
    }
  }

  // ============= MANTENIMIENTOS =============

  /**
   * Obtiene opciones/contexto para solicitar mantenimiento
   * @returns {Promise<Object>} Tipos de servicio y sugerencia por kilometraje
   */
  async getOpcionesSolicitudMantenimiento() {
    try {
      const data = await this.fetchWithAuth('/conductor/mantenimientos/opciones');
      return data;
    } catch (error) {
      console.error('Error al obtener opciones de mantenimiento:', error);
      throw error;
    }
  }

  /**
   * Obtiene disponibilidad de horarios para una fecha en agenda de mantenimientos
   * @param {string} fecha - Formato YYYY-MM-DD
   * @returns {Promise<Object>} Slots de horario disponibles/no disponibles
   */
  async getDisponibilidadSolicitudMantenimiento(fecha) {
    try {
      const encodedFecha = encodeURIComponent(String(fecha || '').trim());
      const data = await this.fetchWithAuth(`/conductor/mantenimientos/disponibilidad?fecha=${encodedFecha}`);
      return data;
    } catch (error) {
      console.error('Error al obtener disponibilidad de mantenimiento:', error);
      throw error;
    }
  }
  
  /**
   * Solicita un mantenimiento
   * @param {Object} datos - Datos del mantenimiento
   * @returns {Promise<Object>} Solicitud creada
   */
  async solicitarMantenimiento(datos) {
    try {
      const data = await this.fetchWithAuth('/conductor/mantenimientos/solicitar', {
        method: 'POST',
        body: JSON.stringify(datos)
      });
      return data;
    } catch (error) {
      console.error('Error al solicitar mantenimiento:', error);
      throw error;
    }
  }

  /**
   * Obtiene mis solicitudes de mantenimiento
   * @returns {Promise<Array>} Lista de mantenimientos
   */
  async getMisMantenimientos() {
    try {
      const data = await this.fetchWithAuth('/conductor/mantenimientos');
      return data;
    } catch (error) {
      console.error('Error al obtener mantenimientos:', error);
      throw error;
    }
  }

  /**
   * Obtiene resumen financiero de mantenimientos del conductor
   * @returns {Promise<Object>} Resumen consolidado
   */
  async getResumenFinancieroMantenimientos() {
    try {
      const data = await this.fetchWithAuth('/conductor/mantenimientos/resumen-financiero');
      return data;
    } catch (error) {
      console.error('Error al obtener resumen financiero de mantenimientos:', error);
      throw error;
    }
  }

  /**
   * Obtiene detalle de un mantenimiento
   * @param {number} id - ID del mantenimiento
   * @returns {Promise<Object>} Detalle del mantenimiento
   */
  async getMantenimientoById(id) {
    try {
      const data = await this.fetchWithAuth(`/conductor/mantenimientos/${id}`);
      return data;
    } catch (error) {
      console.error('Error al obtener mantenimiento:', error);
      throw error;
    }
  }

  /**
   * Confirma entrega de mantenimiento completado
   * @param {number} id - ID del mantenimiento
   * @param {Object} datos - visto_bueno_entrega, satisfecho, calificacion, comentarios
   * @returns {Promise<Object>} Confirmacion registrada
   */
  async confirmarEntregaMantenimiento(id, datos) {
    try {
      const data = await this.fetchWithAuth(`/conductor/mantenimientos/${id}/confirmar-entrega`, {
        method: 'POST',
        body: JSON.stringify(datos || {})
      });
      return data;
    } catch (error) {
      console.error('Error al confirmar entrega de mantenimiento:', error);
      throw error;
    }
  }

  // ============= DOCUMENTOS =============
  
  /**
   * Obtiene mis documentos
   * @returns {Promise<Object>} Documentos del conductor
   */
  async getMisDocumentos() {
    try {
      const data = await this.fetchWithAuth('/conductor/documentos');
      return data;
    } catch (error) {
      console.error('Error al obtener documentos:', error);
      throw error;
    }
  }

  /**
   * Sube o actualiza un documento
   * @param {FormData} formData - Documento a subir
   * @returns {Promise<Object>} Confirmación
   */
  async subirDocumento(formData) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${this.baseURL}/conductor/documentos/subir`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al subir documento');
      }

      return await response.json();
    } catch (error) {
      console.error('Error al subir documento:', error);
      throw error;
    }
  }

  // ============= PERFIL Y CONFIGURACIÓN =============
  
  /**
   * Actualiza datos del perfil
   * @param {Object} datos - Datos a actualizar
   * @returns {Promise<Object>} Perfil actualizado
   */
  async actualizarPerfil(datos) {
    try {
      const data = await this.fetchWithAuth('/conductor/perfil/actualizar', {
        method: 'PUT',
        body: JSON.stringify(datos)
      });
      return data;
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      throw error;
    }
  }

  /**
   * Cambia la contraseña
   * @param {Object} datos - { password_actual, password_nueva }
   * @returns {Promise<Object>} Confirmación
   */
  async cambiarPassword(datos) {
    try {
      const data = await this.fetchWithAuth('/conductor/perfil/cambiar-password', {
        method: 'PUT',
        body: JSON.stringify(datos)
      });
      return data;
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      throw error;
    }
  }

  // ============= NOTIFICACIONES =============
  
  /**
   * Obtiene notificaciones del conductor
   * @returns {Promise<Array>} Lista de notificaciones
   */
  async getNotificaciones() {
    try {
      const data = await this.fetchWithAuth('/conductor/notificaciones');
      return data;
    } catch (error) {
      console.error('Error al obtener notificaciones:', error);
      throw error;
    }
  }

  /**
   * Marca una notificación como leída
   * @param {number} id - ID de la notificación
   * @returns {Promise<Object>} Confirmación
   */
  async marcarNotificacionLeida(id) {
    try {
      const data = await this.fetchWithAuth(`/conductor/notificaciones/${id}/leer`, {
        method: 'PUT'
      });
      return data;
    } catch (error) {
      console.error('Error al marcar notificación:', error);
      throw error;
    }
  }

} // <-- Fin de la clase

// Exportar instancia única (Singleton)
const conductorService = new ConductorService();
export default conductorService;
