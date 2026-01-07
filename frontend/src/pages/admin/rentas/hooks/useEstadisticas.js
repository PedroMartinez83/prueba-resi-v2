import { useState, useEffect } from 'react';
import adminService from '../../../../services/adminService';
export const useEstadisticas = (filtros = {}) => {
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState(null);
  const [error, setError] = useState(null);

  const cargarEstadisticas = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getEstadisticasPagosRentas(filtros);
      setEstadisticas(data);
    } catch (err) {
      console.error('Error al cargar estadísticas:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarEstadisticas();
  }, [JSON.stringify(filtros)]);

  return {
    estadisticas,
    loading,
    error,
    recargar: cargarEstadisticas
  };
};

export default useEstadisticas;