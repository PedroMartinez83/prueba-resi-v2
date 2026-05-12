/**
 * Servicio para manejar todas las operaciones del PORTAL DE INVERSIONISTAS
 * @module inversionistaService
 */

import { API_BASE_URL } from './api';

class InversionistaService {
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
        // 🚨 AQUÍ ESTÁ LA MAGIA: Si la sesión expira, lo mandamos al login correcto
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/inversionista/login'; // <--- Redirección exclusiva
          throw new Error('Sesión expirada');
        }
        
        const error = await response.json().catch(() => ({
          message: `Error ${response.status}: ${response.statusText}`
        }));
        
        const detail = error?.error ? `: ${error.error}` : '';
        throw new Error((error.message || 'Error en la petición') + detail);
      }

      // Renovación automática de token
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

  // =========================================================================
  // AQUÍ ABAJO IRÁN TODAS LAS PETICIONES EXCLUSIVAS DEL INVERSIONISTA
  // =========================================================================

  /**
   * Ejemplo: Obtener el resumen del dashboard (rendimientos, contratos activos)
   */
  async getDashboardData() {
    return this.fetchWithAuth('/inversionista/dashboard');
  }

  /**
   * Ejemplo: Obtener la lista de contratos del inversionista
   */
  async getMisContratos() {
    return this.fetchWithAuth('/inversionista/contratos');
  }

/**
   * Obtener el historial de pagos del inversionista logueado
   */
  async getHistorialPagos() {
    // 🚀 CORREGIDO: Le agregamos el prefijo /admin/inversionistas/
    return this.fetchWithAuth('/admin/inversionistas/pagos');
  }

  /**
   * Enviar una nueva solicitud de inversión
   * @param {Object} datosSolicitud - { monto_inversion, modelo_negocio, fecha_inicio, renta_diaria }
   */
  async crearSolicitud(datosSolicitud) {
    // Asegúrate de que la ruta coincida con cómo montaste tu router en app.js
    // Si tu archivo de rutas se llama en app.js con '/api/inversionistas', la ruta es correcta.
    return this.fetchWithAuth('/admin/inversionistas/solicitudes', {
      method: 'POST',
      body: JSON.stringify(datosSolicitud)
    });
  }

  /**
   * Obtener las solicitudes exclusivas del inversionista logueado
   */
  async getMisSolicitudes() {
    // 🚀 CORREGIDO: Le ponemos el prefijo de tu app.js y apuntamos a la nueva ruta
    return this.fetchWithAuth('/admin/inversionistas/mis-solicitudes');
  }

  /**
   * Obtener todas las solicitudes de inversión
   * @param {string} [estado_aceptacion] - (Opcional) 'Pendiente', 'Aceptada', o 'Rechazada'
   */
  async getSolicitudes(estado_aceptacion = '') {
    // Armamos la ruta base (igualita a la del POST)
    let endpoint = '/admin/inversionistas/solicitudes';
    
    // Si el frontend nos pide un estado en particular, se lo pegamos en la URL
    if (estado_aceptacion) {
      endpoint += `?estado_aceptacion=${estado_aceptacion}`;
    }

    // Hacemos la petición GET
    return this.fetchWithAuth(endpoint);
  }


  /**
   * Aprobar una solicitud de inversión y convertirla en contrato
   * @param {number|string} id - El ID de la solicitud
   */
  async aprobarSolicitud(id) {
    return this.fetchWithAuth(`/admin/inversionistas/solicitudes/${id}/aprobar`, {
      method: 'POST'
    });
  }

  /**
 * Aprueba el registro de un nuevo inversionista y crea su perfil oficial
 * @param {number|string} id - El ID de la solicitud en la tabla solicitudes_inversionistas
 */
async aprobarSolicitudRegistro(id) {
    // 🚀 Esta es la ruta ganadora
    return this.fetchWithAuth(`/solicitudes-inversionistas/admin/solicitudes/${id}/aprobar`, {
      method: 'POST'
    });
  
}

  async rechazarSolicitud(id, motivo, comprobanteUrl) { 
    
    // 🔍 2. PON ESTE LOG AQUÍ PARA VER SI LLEGÓ AL SERVICE
    return this.fetchWithAuth(`/admin/inversionistas/solicitudes/${id}/rechazar`, {
      method: 'POST',
      body: JSON.stringify({ 
        motivo_rechazo: motivo,
        comprobante_devolucion_url: comprobanteUrl // 👈 ¿SÍ ESTÁ ESTA LÍNEA EXACTAMENTE ASÍ?
      })
    });
  }

  async rechazarSolicitudRegistro(id, motivoRechazo) {
    return this.fetchWithAuth(`/solicitudes-inversionistas/admin/solicitudes/${id}/rechazar`, {
      method: 'POST',
      body: JSON.stringify({ motivo_rechazo: motivoRechazo }) // 👈 Mandamos el motivo al backend
    });
  }

  /**
   * Obtener la información de la cuenta bancaria de la empresa
   */
  async getDatosBancarios() {

    return this.fetchWithAuth('/admin/inversionistas/configuracion/banco');
  }

  /**
   * Actualizar la información bancaria de la empresa
   * @param {number|string} id - ID del registro de configuración
   * @param {Object} datos - Objeto con banco, titular, cuenta, clabe, etc.
   */
  async updateDatosBancarios(id, datos) {
    return this.fetchWithAuth(`/admin/inversionistas/configuracion/banco/${id}`, {
      method: 'PUT',
      body: JSON.stringify(datos)
    });
  }

  // ===================== Perfil del inversionista =====================
  /**
   * Obtener los datos del perfil del inversionista logueado
   */
  async getMiPerfil() {
    // Asegúrate de usar la ruta correcta según tu app.js (ej. /api/inversionista/mi-perfil)
    return this.fetchWithAuth('/admin/inversionistas/mi-perfil');
  }
  
  /**
   * Actualizar los datos del inversionista logueado
   */
  async updateMiPerfil(datos) {
    // 🚀 Ojo con tu prefijo, usa el que configuramos antes
    return this.fetchWithAuth('/admin/inversionistas/mi-perfil', {
      method: 'PUT',
      body: JSON.stringify(datos)
    });
  }

  /**
   * Verificar en tiempo real si un dato ya está ocupado
   */
  async verificarDuplicado(campo, valor) {
    // 🚀 Ajusta el prefijo si es necesario (/admin/inversionistas o el que uses)
    return this.fetchWithAuth(`/admin/inversionistas/verificar-duplicado?campo=${campo}&valor=${valor}`);
  }

  /**
   * Obtener el historial de cambios del perfil
   */
  async getHistorialAuditoria() {
    return this.fetchWithAuth('/admin/inversionistas/mi-perfil/auditoria');
  }
  
}






// Exportamos una única instancia (Singleton)
export default new InversionistaService();