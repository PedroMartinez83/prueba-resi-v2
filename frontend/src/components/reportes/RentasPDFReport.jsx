import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

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
  
  // Resumen de totales (arriba de la tabla)
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 15,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#1e293b',
    border: '1 solid #334155',
    borderRadius: 8,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 9,
    color: '#94a3b8',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryValueRenta: {
    color: '#10b981',
  },
  summaryValuePoliza: {
    color: '#a78bfa',
  },
  summaryValueTotal: {
    color: '#3b82f6',
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
  
  // Columnas específicas
  colFecha: { width: '12%' },
  colConductor: { width: '22%' },
  colVehiculo: { width: '10%' },
  colRenta: { width: '14%', textAlign: 'right', color: '#10b981' },
  colPoliza: { width: '14%', textAlign: 'right', color: '#a78bfa' },
  colTotal: { width: '14%', textAlign: 'right', fontWeight: 'bold', color: '#ffffff' },
  colMetodo: { width: '14%' },
  
  // Footer de totales
  tableFooter: {
    flexDirection: 'row',
    backgroundColor: '#334155',
    borderTop: '2 solid #3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 5,
    marginTop: 5,
  },
  footerLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  footerValue: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  
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

const RentasPDFReport = ({ data, filtros }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(value);
  };

  // Calcular totales
  const totalRenta = data.reduce((sum, p) => sum + parseFloat(p.monto_renta_pagado || 0), 0);
  const totalPoliza = data.reduce((sum, p) => sum + parseFloat(p.monto_poliza_pagado || 0), 0);
  const totalGeneral = data.reduce((sum, p) => sum + parseFloat(p.monto_total || 0), 0);

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
            Período: {formatDate(filtros.fecha_desde)} al {formatDate(filtros.fecha_hasta)}
          </Text>
          <Text style={styles.subtitle}>
            Generado: {generado} • Total de registros: {data.length}
          </Text>
        </View>

        {/* Resumen de Totales */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>💼 RENTA (EMPRESA)</Text>
            <Text style={[styles.summaryValue, styles.summaryValueRenta]}>
              {formatCurrency(totalRenta)}
            </Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>🛡️ PÓLIZA (CONDUCTOR)</Text>
            <Text style={[styles.summaryValue, styles.summaryValuePoliza]}>
              {formatCurrency(totalPoliza)}
            </Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>📊 TOTAL GENERAL</Text>
            <Text style={[styles.summaryValue, styles.summaryValueTotal]}>
              {formatCurrency(totalGeneral)}
            </Text>
          </View>
        </View>

        {/* Tabla */}
        <View style={styles.table}>
          {/* Header de tabla */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colFecha]}>Fecha</Text>
            <Text style={[styles.tableHeaderCell, styles.colConductor]}>Conductor</Text>
            <Text style={[styles.tableHeaderCell, styles.colVehiculo]}>Vehículo</Text>
            <Text style={[styles.tableHeaderCell, styles.colRenta]}>💼 Renta</Text>
            <Text style={[styles.tableHeaderCell, styles.colPoliza]}>🛡️ Póliza</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
            <Text style={[styles.tableHeaderCell, styles.colMetodo]}>Método</Text>
          </View>

          {/* Filas de datos */}
          {data.map((pago, index) => (
            <View 
              key={pago.id || index} 
              style={[
                styles.tableRow, 
                index % 2 === 1 && styles.tableRowAlt
              ]}
            >
              <Text style={[styles.tableCell, styles.colFecha]}>
                {formatDate(pago.fecha_pago)}
              </Text>
              <Text style={[styles.tableCell, styles.colConductor]}>
                {pago.nombre_conductor}
              </Text>
              <Text style={[styles.tableCell, styles.colVehiculo]}>
                {pago.numero_vehiculo}
              </Text>
              <Text style={[styles.tableCell, styles.colRenta]}>
                {formatCurrency(pago.monto_renta_pagado || 0)}
              </Text>
              <Text style={[styles.tableCell, styles.colPoliza]}>
                {formatCurrency(pago.monto_poliza_pagado || 0)}
              </Text>
              <Text style={[styles.tableCell, styles.colTotal]}>
                {formatCurrency(pago.monto_total)}
              </Text>
              <Text style={[styles.tableCell, styles.colMetodo]}>
                {pago.metodo_pago}
              </Text>
            </View>
          ))}

          {/* Footer de totales */}
          <View style={styles.tableFooter}>
            <Text style={[styles.footerLabel, styles.colFecha]}>TOTALES:</Text>
            <Text style={[styles.footerLabel, styles.colConductor]}></Text>
            <Text style={[styles.footerLabel, styles.colVehiculo]}></Text>
            <Text style={[styles.footerValue, styles.colRenta, styles.summaryValueRenta]}>
              {formatCurrency(totalRenta)}
            </Text>
            <Text style={[styles.footerValue, styles.colPoliza, styles.summaryValuePoliza]}>
              {formatCurrency(totalPoliza)}
            </Text>
            <Text style={[styles.footerValue, styles.colTotal]}>
              {formatCurrency(totalGeneral)}
            </Text>
            <Text style={[styles.footerLabel, styles.colMetodo]}></Text>
          </View>
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