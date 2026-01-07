// frontend/src/components/vehiculos/VehiculoDrawer.jsx
import React from 'react';
import { X, Car } from 'lucide-react';
import VehiculoFormTabs from './VehiculoFormTabs';
import { useVehiculoForm } from '../../contexts/VehiculoFormContext.jsx';

/**
 * VehiculoDrawer - Panel lateral simplificado con Context
 * 
 * ANTES: 17 props (prop drilling nightmare)
 * AHORA: 3 props (isOpen, onClose, onSubmit)
 * 
 * Todos los datos vienen del Context
 */
const VehiculoDrawer = ({ 
  isOpen, 
  onClose, 
  onSubmit
}) => {
  // ========== OBTENER TODO DEL CONTEXT (INCLUYENDO isFormValid) ==========
  const { 
    vehiculo,
    guardando,
    isFormValid  // ← PASO 1: AÑADIDO
  } = useVehiculoForm();

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Drawer Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-[600px] lg:w-[700px] xl:w-[800px] bg-surface shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header Sticky */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 bg-surface/95 backdrop-blur border-b border-primary/20">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Car className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            {vehiculo ? 'Editar' : 'Agregar'} Vehículo
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-primary/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* VehiculoFormTabs obtiene todo del Context automáticamente */}
          <VehiculoFormTabs />
        </div>

        {/* Footer Sticky */}
        <div className="sticky bottom-0 flex gap-3 p-4 sm:p-6 bg-surface/95 backdrop-blur border-t border-primary/20">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors text-sm sm:text-base"
            disabled={guardando}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="flex-1 px-4 py-2 bg-primary text-dark font-semibold rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
            disabled={guardando || !isFormValid}  // ← PASO 2: LÓGICA INTELIGENTE
          >
            {guardando ? (
              <>
                <div className="w-4 h-4 border-2 border-dark border-t-transparent rounded-full animate-spin"></div>
                <span>{vehiculo ? 'Actualizando...' : 'Guardando...'}</span>
              </>
            ) : (
              <span>{vehiculo ? 'Actualizar' : 'Agregar'} Vehículo</span>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default VehiculoDrawer;