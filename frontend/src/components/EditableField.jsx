import React from 'react';
import { AlertCircle } from 'lucide-react';

const EditableField = ({
  label,
  value,
  onChange,
  type = 'text',
  options = [],
  error,
  required = false,
  editing = false,
  placeholder = '',
  className = ''
}) => {
  if (!editing) {
    // Modo lectura - TEMA OSCURO + TRUNCATE
    return (
      <div className={`min-w-0 ${className}`}>
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          {label}
        </label>
        <p className="text-sm sm:text-base font-semibold text-white truncate">
          {value || 'No especificado'}
        </p>
      </div>
    );
  }

  // Modo edición - TEMA OSCURO
  return (
    <div className={`min-w-0 ${className}`}>
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      
      {type === 'select' ? (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={`
            w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2
            transition-colors duration-200 text-sm sm:text-base
            bg-surface-secondary border text-white
            ${error 
              ? 'border-red-500 focus:ring-red-500/50' 
              : 'border-gray-700 focus:ring-primary/50'
            }
          `}
        >
          <option value="">Seleccionar...</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`
            w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2
            transition-colors duration-200 text-sm sm:text-base
            bg-surface-secondary border text-white placeholder-gray-500
            ${error 
              ? 'border-red-500 focus:ring-red-500/50' 
              : 'border-gray-700 focus:ring-primary/50'
            }
          `}
        />
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`
            w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2
            transition-colors duration-200 text-sm sm:text-base
            bg-surface-secondary border text-white placeholder-gray-500
            ${error 
              ? 'border-red-500 focus:ring-red-500/50' 
              : 'border-gray-700 focus:ring-primary/50'
            }
          `}
        />
      )}
      
      {error && (
        <div className="flex items-center gap-1 mt-1 text-red-400">
          <AlertCircle className="w-3 h-3" />
          <span className="text-xs">{error}</span>
        </div>
      )}
    </div>
  );
};

export default EditableField;