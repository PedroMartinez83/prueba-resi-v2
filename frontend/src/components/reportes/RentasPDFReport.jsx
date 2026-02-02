import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Estilos con tema oscuro elegante
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#0f172a',
    padding: 40,
    fontFamily: 'Helvetica',
  },
  
  // Header
  header: {
    marginBottom: 30,
    borderBottom: '2 solid #3b82f6',
    paddingBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 3,
  },
  
  // Tabla
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderBottom: '2 solid #3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#e2e8f0',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #334155',
    paddingVertical: 8,
    paddingHorizontal: 5,
    minHeight: 30,
  },
  tableRowAlt: {
    backgroundColor: '#1e293b',
  },
  tableCell: {
    fontSize: 9,
    color: '#cbd5e1',
    paddingRight: 5,
  },
  tableCellBold: {
    fontWeight: 'bold',
    color: '#ffffff',
  },
  
  // Columnas específicas (mismo formato que vista previa)
  colFechaPago: { width: '16%' },
  colDiasCubiertos: { width: '22%' },
  colConductor: { width: '22%' },
  colVehiculo: { width: '12%' },
  colTotalPagado: { width: '16%', textAlign: 'right', fontWeight: 'bold', color: '#ffffff' },
  
  // Footer del documento
  documentFooter: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1 solid #334155',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: '#64748b',
  },
  footerBrand: {
    fontSize: 8,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
});

const RentasPDFReport = ({ rows = [], filtros }) => {
  const now = new Date();
  const generado = now.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Reporte de Pagos de Rentas</Text>
          <Text style={styles.subtitle}>
            Período: {filtros.fecha_desde} al {filtros.fecha_hasta}
          </Text>
          <Text style={styles.subtitle}>
            Generado: {generado} • Total de registros: {rows.length}
          </Text>
        </View>

        {/* Tabla */}
        <View style={styles.table}>
          {/* Header de tabla */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colFechaPago]}>Fecha de pago</Text>
            <Text style={[styles.tableHeaderCell, styles.colDiasCubiertos]}>Días cubiertos</Text>
            <Text style={[styles.tableHeaderCell, styles.colConductor]}>Conductor</Text>
            <Text style={[styles.tableHeaderCell, styles.colVehiculo]}>Vehículo</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotalPagado]}>Total pagado</Text>
          </View>

          {/* Filas de datos */}
          {rows.map((row, index) => (
            <View 
              key={row.id || index} 
              style={[
                styles.tableRow, 
                index % 2 === 1 && styles.tableRowAlt
              ]}
            >
              <Text style={[styles.tableCell, styles.colFechaPago]}>
                {row.fechaPago}
              </Text>
              <Text style={[styles.tableCell, styles.colDiasCubiertos]}>
                {row.diasCubiertos}
              </Text>
              <Text style={[styles.tableCell, styles.colConductor]}>
                {row.conductor}
              </Text>
              <Text style={[styles.tableCell, styles.colVehiculo]}>
                {row.vehiculo}
              </Text>
              <Text style={[styles.tableCell, styles.colTotalPagado]}>
                {row.totalPagado}
              </Text>
            </View>
          ))}
        </View>

        {/* Footer del documento */}
        <View style={styles.documentFooter}>
          <Text style={styles.footerText}>
            Auto Manager • Sistema de Gestión Vehicular
          </Text>
          <Text style={styles.footerBrand}>
            somoslazaro.marketing
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default RentasPDFReport;
