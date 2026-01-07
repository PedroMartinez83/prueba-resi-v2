// frontend/src/contexts/VehiculoFormContext.js
import React, { createContext, useContext } from 'react';

/**
 * Context para manejar el estado del formulario de vehículos
 * Elimina el "prop drilling" de 17+ props
 */
const VehiculoFormContext = createContext(null);

/**
 * Hook personalizado para usar el contexto
 * @throws {Error} Si se usa fuera del Provider
 */
export const useVehiculoForm = () => {
  const context = useContext(VehiculoFormContext);
  
  if (!context) {
    throw new Error('useVehiculoForm debe usarse dentro de VehiculoFormProvider');
  }
  
  return context;
};

/**
 * Provider del contexto
 * Envuelve los componentes que necesitan acceso al formulario
 */
export const VehiculoFormProvider = ({ children, value }) => {
  return (
    <VehiculoFormContext.Provider value={value}>
      {children}
    </VehiculoFormContext.Provider>
  );
};

export default VehiculoFormContext;