import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Estilos idénticos al RentasPDFReport original
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#0f172a',
    padding: 40,
    fontFamily: 'Helvetica',
  },
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
  
  // Columnas específicas para Rezago
  colConductor: { width: '40%' },
  colVehiculo: { width: '20%' },
  colDias: { width: '20%', textAlign: 'center', fontWeight: 'bold', color: '#f59e0b' }, // Naranja
  colMonto: { width: '20%', textAlign: 'right', fontWeight: 'bold', color: '#ef4444' }, // Rojo
  
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
});

const formatCurrency = (value) => {
  const numero = Number.parseFloat(value || 0);
  return `$${numero.toFixed(2)}`;
};

const RezagoPDFReport = ({ rows = [] }) => {
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
          <Text style={styles.title}>Reporte de Rezago SA / SI</Text>
          <Text style={styles.subtitle}>
            Conductores con pagos atrasados
          </Text>
          <Text style={styles.subtitle}>
            Generado: {generado} • Total de morosos: {rows.length}
          </Text>
        </View>

        {/* Tabla */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colConductor]}>Conductor</Text>
            <Text style={[styles.tableHeaderCell, styles.colVehiculo]}>Vehículo</Text>
            <Text style={[styles.tableHeaderCell, styles.colDias]}>Días con deuda</Text>
            <Text style={[styles.tableHeaderCell, styles.colMonto]}>Monto Adeudado</Text>
          </View>

          {rows.map((row, index) => (
            <View 
              key={index} 
              style={[
                styles.tableRow, 
                index % 2 === 1 && styles.tableRowAlt
              ]}
            >
              <Text style={[styles.tableCell, styles.colConductor]}>{row.conductor}</Text>
              <Text style={[styles.tableCell, styles.colVehiculo]}>{row.vehiculo}</Text>
              <Text style={[styles.tableCell, styles.colDias]}>{row.dias_rezago} días</Text>
              <Text style={[styles.tableCell, styles.colMonto]}>{formatCurrency(row.monto_adeudado)}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.documentFooter}>
          <Text style={styles.footerText}>
            Auto Manager • Sistema de Gestión Vehicular
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default RezagoPDFReport;