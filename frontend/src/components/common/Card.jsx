// frontend/src/components/common/Card.jsx
import React from 'react';

const Card = ({ 
  children, 
  className = '', 
  title = null,
  icon: Icon = null,
  action = null,
  padding = true,
  glass = true 
}) => {
  return (
    <div
      className={`
        ${glass ? 'glass-dark' : 'bg-gray-800'}
        rounded-xl border border-white/10 flex flex-col
        ${className}
      `}
    >
      {/* Header de la tarjeta si tiene título */}
      {(title || Icon || action) && (
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 bg-primary/20 rounded-lg">
                <Icon className="w-5 h-5 text-primary" />
              </div>
            )}
            {title && (
              <h3 className="text-lg font-semibold text-white">{title}</h3>
            )}
          </div>
          {action && (
            <div>{action}</div>
          )}
        </div>
      )}

      {/* Contenido de la tarjeta */}
      <div className={`${padding ? 'p-6' : ''} flex-1`}>
        {children}
      </div>
    </div>
  );
};

// Componente para estadísticas
export const StatCard = ({
  title,
  value,
  icon: Icon,
  trend = null,
  trendValue = null,
  color = 'primary',
  className = ''
}) => {
  const colorClasses = {
    primary: 'from-primary to-blue-500',
    success: 'from-green-500 to-green-600',
    warning: 'from-yellow-500 to-orange-500',
    danger: 'from-red-500 to-pink-500',
    info: 'from-cyan-500 to-blue-500'
  };

  return (
    <Card className={`relative overflow-hidden h-full ${className}`} padding={false}>
      {/* Gradiente de fondo decorativo */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorClasses[color]} opacity-10 rounded-full blur-3xl`}></div>

      <div className="relative p-6 h-full">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-gray-400 text-sm font-medium mb-2">{title}</p>
            <p className="text-3xl font-bold text-white mb-2">{value}</p>
            
            {/* Tendencia */}
            {trend && trendValue && (
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${
                  trend === 'up' ? 'text-green-400' : 
                  trend === 'down' ? 'text-red-400' : 
                  'text-gray-400'
                }`}>
                  {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                  {' '}{trendValue}
                </span>
                <span className="text-xs text-gray-500">vs mes anterior</span>
              </div>
            )}
          </div>
          
          {Icon && (
            <div className={`p-3 bg-gradient-to-br ${colorClasses[color]} rounded-lg bg-opacity-20`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default Card;