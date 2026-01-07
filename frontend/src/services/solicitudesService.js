/**
 * Servicio para manejar todas las operaciones de solicitudes de conductores
 * @module solicitudesService
 */

import { API_BASE_URL } from './api';

class SolicitudesService {
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
      // Redirigir a login si no hay token
      window.location.href = '/login?session=expired';
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

      // Manejar respuestas no exitosas
      if (!response.ok) {
        if (response.status === 401) {
          // Token expirado o inválido
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login?session=expired';
          throw new Error('Sesión expirada');
        }

        const error = await response.json().catch(() => ({
          message: `Error ${response.status}: ${response.statusText}`
        }));

        throw new Error(error.message || 'Error en la petición');
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

  // ============= SOLICITUDES ADMIN =============

  /**
   * Obtiene todas las solicitudes de conductores
   * @param {Object} filtros - Filtros opcionales
   * @returns {Promise<Object>} Lista de solicitudes
   */
  async getSolicitudes(filtros = {}) {
    try {
      const queryParams = new URLSearchParams(filtros).toString();
      const endpoint = queryParams ? `/admin/solicitudes?${queryParams}` : '/admin/solicitudes';
      
      const data = await this.fetchWithAuth(endpoint);
      console.log('Solicitudes obtenidas:', data);
      return data;
    } catch (error) {
      console.error('Error al obtener solicitudes:', error);
      throw error;
    }
  }

  /**
   * Obtiene una solicitud por ID
   * @param {string|number} id - ID de la solicitud
   * @returns {Promise<Object>} Datos de la solicitud
   */
  async getSolicitudById(id) {
    if (!id) throw new Error('ID de solicitud requerido');

    try {
      const data = await this.fetchWithAuth(`/admin/solicitudes/${id}`);
      return data;
    } catch (error) {
      console.error('Error al obtener solicitud:', error);
      throw error;
    }
  }

  /**
   * Ejecuta el motor de evaluación automática
   * @param {string|number} id - ID de la solicitud
   * @returns {Promise<Object>} Resultado de la evaluación
   */
  async calcularDecision(id) {
    if (!id) throw new Error('ID de solicitud requerido');

    try {
      console.log('Calculando decisión para solicitud:', id);
      const data = await this.fetchWithAuth(`/admin/solicitudes/${id}/calcular-decision`, {
        method: 'POST'
      });
      return data;
    } catch (error) {
      console.error('Error al calcular decisión:', error);
      throw error;
    }
  }

  /**
   * Migra una solicitud aprobada a conductor
   * @param {string|number} id - ID de la solicitud
   * @returns {Promise<Object>} Resultado de la migración
   */
  async migrarAConductor(id) {
    if (!id) throw new Error('ID de solicitud requerido');

    try {
      console.log('Migrando solicitud a conductor:', id);
      const data = await this.fetchWithAuth(`/admin/solicitudes/${id}/migrar`, {
        method: 'POST'
      });
      return data;
    } catch (error) {
      console.error('Error al migrar solicitud:', error);
      throw error;
    }
  }

  /**
   * Actualiza el estatus de una solicitud manualmente
   * @param {string|number} id - ID de la solicitud
   * @param {string} nuevoEstatus - Nuevo estatus
   * @param {string} notas - Notas de revisión
   * @returns {Promise<Object>} Solicitud actualizada
   */
  async actualizarEstatus(id, nuevoEstatus, notas = '') {
    if (!id) throw new Error('ID de solicitud requerido');
    if (!nuevoEstatus) throw new Error('Nuevo estatus requerido');

    try {
      const data = await this.fetchWithAuth(`/admin/solicitudes/${id}/estatus`, {
        method: 'PUT',
        body: JSON.stringify({
          estatus_solicitud: nuevoEstatus,
          notas_revision: notas
        })
      });
      return data;
    } catch (error) {
      console.error('Error al actualizar estatus:', error);
      throw error;
    }
  }

  // --- 👇 ¡AQUÍ ESTÁ LA CORRECCIÓN / CÓDIGO AÑADIDO! 👇 ---
  
  /**
   * Elimina una solicitud permanentemente
   * @param {string|number} id - ID de la solicitud
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  async eliminarSolicitud(id) {
    if (!id) throw new Error('ID de solicitud requerido');

    try {
      console.log('Eliminando solicitud:', id);
      const data = await this.fetchWithAuth(`/admin/solicitudes/${id}`, {
        method: 'DELETE'
      });
      return data; // Espera una respuesta como { success: true, message: '...' }
    } catch (error) {
      console.error('Error al eliminar solicitud:', error);
      throw error;
    }
  }
  
  // --- 👆 FIN DEL CÓDIGO AÑADIDO 👆 ---


  // ============= ESTADÍSTICAS =============

  /**
   * Obtiene estadísticas de solicitudes para dashboard
   * @returns {Promise<Object>} Estadísticas de solicitudes
   */
  async getEstadisticasSolicitudes() {
    try {
      const data = await this.fetchWithAuth('/admin/solicitudes/estadisticas');
      return data?.estadisticas || data;
    } catch (error) {
      console.error('Error al obtener estadísticas de solicitudes:', error);
      // Retornar datos vacíos en caso de error
      return {
        total: 0,
        pendientes: 0,
        aprobadas: 0,
        rechazadas: 0,
        enPrueba: 0,
        migradas: 0
      };
    }
  }

  /**
   * Obtiene solicitudes recientes para actividad
   * @param {number} limite - Número de solicitudes a obtener
   * @returns {Promise<Array>} Lista de solicitudes recientes
   */
  async getSolicitudesRecientes(limite = 5) {
    try {
      const data = await this.fetchWithAuth(`/admin/solicitudes/recientes?limite=${limite}`);
      return data.solicitudes || [];
    } catch (error) {
      console.error('Error al obtener solicitudes recientes:', error);
      return [];
    }
  }

  // ============= PÚBLICAS (Sin autenticación) =============

  /**
   * Crea una nueva solicitud (endpoint público)
   * @param {Object} solicitudData - Datos de la solicitud
   * @returns {Promise<Object>} Solicitud creada
   */
  async crearSolicitudPublica(solicitudData) {
    if (!solicitudData) throw new Error('Datos de la solicitud requeridos');

    try {
      const response = await fetch(`${this.baseURL}/solicitudes`, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify(solicitudData)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: `Error ${response.status}: ${response.statusText}`
        }));
        throw new Error(error.message || 'Error al enviar solicitud');
      }

      return await response.json();
    } catch (error) {
      console.error('Error al crear solicitud pública:', error);
      throw error;
    }
  }

  /**
   * Consulta el estado de una solicitud por teléfono (endpoint público)
   * @param {string} telefono - Número de teléfono
   * @returns {Promise<Object>} Estado de la solicitud
   */
  async consultarEstadoPublico(telefono) {
    if (!telefono) throw new Error('Teléfono requerido');

    try {
      const response = await fetch(`${this.baseURL}/solicitudes/estado/${telefono}`, {
        headers: this.defaultHeaders
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: `Error ${response.status}: ${response.statusText}`
        }));
        throw new Error(error.message || 'Error al consultar estado');
      }

      return await response.json();
    } catch (error) {
      console.error('Error al consultar estado público:', error);
      throw error;
    }
  }

  /**
   * Valida si un teléfono ya tiene solicitud (endpoint público)
   * @param {string} telefono - Número de teléfono
   * @returns {Promise<Object>} Resultado de validación
   */
  async validarTelefonoPublico(telefono) {
    if (!telefono) throw new Error('Teléfono requerido');

    try {
      const response = await fetch(`${this.baseURL}/solicitudes/validar/${telefono}`, {
        headers: this.defaultHeaders
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: `Error ${response.status}: ${response.statusText}`
        }));
        throw new Error(error.message || 'Error al validar teléfono');
      }

      return await response.json();
    } catch (error) {
      console.error('Error al validar teléfono público:', error);
      throw error;
    }
  }

  // ============= MÉTODOS DE UTILIDAD =============

  /**
   * Formatea una fecha para mostrar
   * @param {string} fecha - Fecha en formato ISO
   * @returns {string} Fecha formateada
   */
  formatFecha(fecha) {
    if (!fecha) return 'N/A';
    
    try {
      return new Date(fecha).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return fecha;
    }
  }

  /**
   * Obtiene el color asociado a un estatus
   * @param {string} estatus - Estatus de la solicitud
   * @returns {string} Clase CSS del color
   */
  getColorEstatus(estatus) {
    const colores = {
      'Pendiente': 'warning',
      'Aprobado': 'success',
      'Aprobado (a prueba)': 'info',
      'Rechazado': 'danger'
    };
    return colores[estatus] || 'primary';
  }

  /**
   * Obtiene estadísticas rápidas para el dashboard principal
   * @returns {Promise<Object>} Estadísticas para integrar en dashboard
   */
  async getStatsParaDashboard() {
    try {
      const stats = await this.getEstadisticasSolicitudes();
      
      return {
        solicitudes: {
          total: stats.total || 0,
          pendientes: stats.pendientes || 0,
          aprobadas: stats.aprobadas || 0,
          rechazadas: stats.rechazadas || 0,
          enPrueba: stats.enPrueba || 0,
          migradas: stats.migradas || 0,
          porcentajeAprobacion: stats.total > 0 ? 
            Math.round(((stats.aprobadas + stats.enPrueba) / stats.total) * 100) : 0
        }
      };
    } catch (error) {
      console.error('Error al obtener stats para dashboard:', error);
      return {
        solicitudes: {
          total: 0,
          pendientes: 0,
          aprobadas: 0,
          rechazadas: 0,
          enPrueba: 0,
          migradas: 0,
          porcentajeAprobacion: 0
        }
      };
    }
  }
}

// Exportar instancia única (Singleton)
const solicitudesService = new SolicitudesService();
export default solicitudesService;
