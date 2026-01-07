// frontend/src/components/vehiculos/ModalDecisionVehiculo.jsx
import React from 'react';
import { X, Calculator, Edit3 } from 'lucide-react';

const ModalDecisionVehiculo = ({ isOpen, onClose, onCalcularInversion, onAgregarManual }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md glass rounded-2xl border border-primary/30 shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-primary/20">
          <h3 className="text-xl font-bold text-white">
            ¿Cómo deseas agregar el vehículo?
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Opción 1: Calcular Inversión (Recomendado) */}
          <button
            onClick={() => {
              onCalcularInversion();
              onClose();
            }}
            className="w-full group relative overflow-hidden rounded-xl p-6 bg-gradient-to-r from-green-600/20 to-primary/20 border-2 border-primary/30 hover:border-primary transition-all duration-300 text-left"
          >
            {/* Badge "Recomendado" */}
            <span className="absolute top-3 right-3 px-2 py-1 text-xs font-semibold bg-primary text-white rounded-full">
              Recomendado
            </span>
            
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-green-500/20 group-hover:bg-green-500/30 transition-colors">
                <Calculator className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-white mb-2">
                  💰 Calcular Inversión
                </h4>
                <p className="text-sm text-gray-400">
                  Calcula primero los datos de inversión y luego completa los detalles del vehículo. 
                  <span className="text-primary font-medium"> Flujo guiado paso a paso.</span>
                </p>
              </div>
            </div>
          </button>

          {/* Opción 2: Agregar Manualmente */}
          <button
            onClick={() => {
              onAgregarManual();
              onClose();
            }}
            className="w-full group relative overflow-hidden rounded-xl p-6 bg-dark/50 border-2 border-primary/20 hover:border-primary/40 transition-all duration-300 text-left"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-gray-700/50 group-hover:bg-gray-700/70 transition-colors">
                <Edit3 className="w-6 h-6 text-gray-300" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-white mb-2">
                  ✍️ Agregar Manualmente
                </h4>
                <p className="text-sm text-gray-400">
                  Completa el formulario del vehículo directamente sin cálculos de inversión.
                  <span className="text-gray-500"> Para registros rápidos.</span>
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-primary/20 text-center">
          <p className="text-xs text-gray-500">
            Puedes cambiar de método en cualquier momento
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModalDecisionVehiculo;