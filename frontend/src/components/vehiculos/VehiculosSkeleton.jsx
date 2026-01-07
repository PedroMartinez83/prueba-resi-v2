// frontend/src/components/vehiculos/VehiculosSkeleton.jsx
import React from 'react';

const VehiculosSkeleton = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="glass rounded-lg p-3 sm:p-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-3 bg-gray-700 rounded w-20 mb-2"></div>
                <div className="h-6 bg-gray-600 rounded w-12 mb-1"></div>
                <div className="h-2 bg-gray-700 rounded w-24"></div>
              </div>
              <div className="w-10 h-10 bg-gray-700 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Search Bar Skeleton */}
      <div className="glass rounded-lg p-4 border border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 h-10 bg-gray-700 rounded-lg"></div>
          <div className="w-full md:w-48 h-10 bg-gray-700 rounded-lg"></div>
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="glass rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark/50 border-b border-gray-700">
              <tr>
                {['ID', 'Vehículo', 'Placa', 'Conductor', 'Estado', 'Km', 'Acciones'].map((header, i) => (
                  <th key={i} className="text-left py-3 px-4">
                    <div className="h-4 bg-gray-700 rounded w-20"></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-gray-800">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-12 bg-gray-700 rounded"></div>
                      <div className="h-4 w-20 bg-gray-700 rounded"></div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-700 rounded-lg"></div>
                      <div className="space-y-1">
                        <div className="h-4 w-32 bg-gray-700 rounded"></div>
                        <div className="h-3 w-24 bg-gray-700 rounded"></div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 w-20 bg-gray-700 rounded"></div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      <div className="h-4 w-24 bg-gray-700 rounded"></div>
                      <div className="h-3 w-20 bg-gray-700 rounded"></div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-6 w-24 bg-gray-700 rounded-full"></div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 w-16 bg-gray-700 rounded"></div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-center gap-2">
                      <div className="w-8 h-8 bg-gray-700 rounded"></div>
                      <div className="w-8 h-8 bg-gray-700 rounded"></div>
                      <div className="w-8 h-8 bg-gray-700 rounded"></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VehiculosSkeleton;