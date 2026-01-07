import React, { useState } from 'react';
import { Document, Page, Text, View, StyleSheet, Image, PDFDownloadLink } from '@react-pdf/renderer';

// ========== ESTILOS FUTURISTAS - DARK MODE ==========
const styles = StyleSheet.create({
  // === PÁGINAS ===
  page: {
    padding: 40,
    backgroundColor: '#0F172A', // Fondo Dark (Slate 900)
    fontFamily: 'Helvetica',
    color: '#CBD5E1', // Texto (Slate 300)
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 9,
    color: '#475569', // (Slate 600)
  },
  
  // === PORTADA ===
  coverPage: {
    padding: 40,
    backgroundColor: '#0F172A', // Fondo Dark
    color: '#E2E8F0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#FFFFFF', // Blanco
  },
  coverSubtitle: {
    fontSize: 18,
    marginBottom: 40,
    textAlign: 'center',
    color: '#38BDF8', // Acento "Digital" (Sky 400)
    fontWeight: 'bold',
  },
  coverVehicleInfo: {
    fontSize: 14,
    marginBottom: 8,
    color: '#E2E8F0',
  },
  qrCode: {
    width: 80,
    height: 80,
    marginTop: 30,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    borderRadius: 8,
  },
  coverFooter: {
    position: 'absolute',
    bottom: 40,
    fontSize: 12,
    color: '#64748b',
  },
  
  // === HEADER ===
  header: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#38BDF8', // Acento
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8', // (Slate 400)
  },
  
  // === SECCIONES ===
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#38BDF8', // Acento
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#334155', // (Slate 700)
  },
  
  // === GRID (Datos) ===
  grid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '48%',
    marginBottom: 8,
  },
  gridLabel: {
    fontSize: 10,
    color: '#94A3B8', // (Slate 400)
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  gridValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  
  // === STATS CARDS ===
  statsContainer: {
    display: 'flex',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    padding: 12,
    backgroundColor: '#1E293B', // (Slate 800)
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155', // (Slate 700)
  },
  statLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statValueGreen: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981', // Verde
  },
  statValueRed: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F87171', // Rojo (más brillante)
  },
  
  // === TABLA ===
  table: {
    display: 'table',
    width: 'auto',
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#334155', // (Slate 700)
    paddingVertical: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E293B', // (Slate 800)
    borderBottomWidth: 2,
    borderBottomColor: '#38BDF8', // Acento
    paddingVertical: 8,
    fontWeight: 'bold',
  },
  tableCol: {
    fontSize: 10,
    padding: 4,
    color: '#CBD5E1', // (Slate 300)
  },
  tableColHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    padding: 4,
    color: '#E2E8F0', // (Slate 200)
  },
  
  // === BADGES (Rediseñados para Dark Mode) ===
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  badgeGreen: {
    backgroundColor: '#064E3B', // (Green 900)
    color: '#34D399', // (Green 400)
  },
  badgeYellow: {
    backgroundColor: '#422006', // (Amber 900)
    color: '#FBBF24', // (Amber 400)
  },
  badgeRed: {
    backgroundColor: '#450A0A', // (Red 900)
    color: '#F87171', // (Red 400)
  },
  badgeBlue: {
    backgroundColor: '#1E3A8A', // (Blue 900)
    color: '#60A5FA', // (Blue 400)
  },
  
  // === GRÁFICOS ===
  chartImage: {
    width: '100%',
    height: 250,
    objectFit: 'contain',
    marginTop: 10,
    borderRadius: 8,
  },
  
  // === HIGHLIGHT BOX ===
  highlightBox: {
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: 4,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  
  // === FOOTER (Desarrollado por somoslazaro.marketing) ===
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    fontSize: 9,
    color: '#475569', // (Slate 600)
  },
});

// ========== COMPONENTE DEL PDF ==========
const VehiculoPDFReport = ({ data, imagenesGraficos }) => {
  if (!data) return null;

  const formatCurrency = (value) => {
    return `$${parseFloat(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-MX', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <Document>
      {/* ========== PÁGINA 1: PORTADA FUTURISTA ========== */}
      <Page size="A4" style={styles.coverPage}>
        <View>
          {/* Logo (si existe) */}
          {imagenesGraficos?.logo && (
            <Image src={imagenesGraficos.logo} style={styles.logo} />
          )}
          
          <Text style={styles.coverTitle}>REPORTE MAESTRO DE VEHÍCULO</Text>
          <Text style={styles.coverSubtitle}>Auto Manager System</Text>
          
          <View style={{ marginTop: 40 }}>
            <Text style={styles.coverVehicleInfo}>
              Vehículo: {data.vehiculo?.marca} {data.vehiculo?.modelo}
            </Text>
            <Text style={styles.coverVehicleInfo}>
              Año: {data.vehiculo?.año_del_vehiculo}
            </Text>
            <Text style={styles.coverVehicleInfo}>
              Número: {data.vehiculo?.numero_vehiculo}
            </Text>
            <Text style={styles.coverVehicleInfo}>
              Placa: {data.vehiculo?.placa}
            </Text>
            <Text style={styles.coverVehicleInfo}>
              VIN: {data.vehiculo?.numero_de_serie_vehiculo}
            </Text>
          </View>

          {/* QR Code */}
          {imagenesGraficos?.qrCode && (
            <Image src={imagenesGraficos.qrCode} style={styles.qrCode} />
          )}
          
          <Text style={styles.coverFooter}>
            Generado: {new Date().toLocaleDateString('es-MX', { 
              weekday: 'long',
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>
      </Page>

      {/* ========== PÁGINA 2: RESUMEN EJECUTIVO ========== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Resumen Ejecutivo</Text>
          <Text style={styles.headerSubtitle}>{data.vehiculo?.numero_vehiculo}</Text>
        </View>

        {/* Estado Actual */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado Actual del Vehículo</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Estado</Text>
              <Text style={styles.gridValue}>{data.vehiculo?.estado}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Conductor Asignado</Text>
              <Text style={styles.gridValue}>{data.estadisticas?.conductor_actual || 'Sin asignar'}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Kilometraje Actual</Text>
              <Text style={styles.gridValue}>{data.vehiculo?.kilometraje_actual?.toLocaleString('es-MX')} km</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Días con Conductor Actual</Text>
              <Text style={styles.gridValue}>{data.estadisticas?.dias_con_conductor_actual || 0} días</Text>
            </View>
          </View>
        </View>

        {/* Resumen Financiero Lifetime */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen Financiero Lifetime</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Inversión Inicial</Text>
              <Text style={styles.statValue}>{formatCurrency(data.estadisticas?.costo_adquisicion)}</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Recaudado</Text>
              <Text style={styles.statValueGreen}>{formatCurrency(data.estadisticas?.total_recaudado)}</Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Costo Mantenimientos</Text>
              <Text style={styles.statValueRed}>{formatCurrency(data.estadisticas?.total_mantenimientos)}</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Pagado a Inversionista</Text>
              <Text style={styles.statValueRed}>{formatCurrency(data.estadisticas?.total_pagado_inversionista)}</Text>
            </View>
          </View>

          <View style={styles.highlightBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#E2E8F0' }}>Rentabilidad Neta:</Text>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: parseFloat(data.estadisticas?.rentabilidad_neta) >= 0 ? '#10B981' : '#F87171' }}>
                {formatCurrency(data.estadisticas?.rentabilidad_neta)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#E2E8F0' }}>ROI:</Text>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: parseFloat(data.estadisticas?.roi_porcentaje) >= 0 ? '#10B981' : '#F87171' }}>
                {parseFloat(data.estadisticas?.roi_porcentaje || 0).toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Indicadores Clave */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Indicadores Clave</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Días Operando</Text>
              <Text style={styles.gridValue}>{data.estadisticas?.dias_operando || 0} días</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Total Conductores</Text>
              <Text style={styles.gridValue}>{data.estadisticas?.total_conductores || 0}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Total Siniestros</Text>
              <Text style={styles.gridValue}>{data.estadisticas?.total_siniestros || 0}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Último Pago</Text>
              <Text style={styles.gridValue}>{formatDate(data.estadisticas?.ultimo_pago)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer} fixed>Desarrollado por somoslazaro.marketing</Text>
        <Text style={styles.pageNumber} render={({ pageNumber }) => `Página ${pageNumber}`} fixed />
      </Page>

      {/* ========== PÁGINA 3: ANÁLISIS FINANCIERO (Pagos) ========== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Análisis Financiero</Text>
          <Text style={styles.headerSubtitle}>Historial de Pagos y Recuperación</Text>
        </View>
        
        {/* Gráfico de Recuperación */}
        {imagenesGraficos?.recuperacion && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recuperación de Inversión</Text>
            <Image src={imagenesGraficos.recuperacion} style={styles.chartImage} />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen de Pagos</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Recaudado</Text>
              <Text style={styles.statValueGreen}>{formatCurrency(data.estadisticas?.total_recaudado)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Promedio Diario</Text>
              <Text style={styles.statValue}>{formatCurrency(data.estadisticas?.promedio_renta_diaria)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Promedio Mensual</Text>
              <Text style={styles.statValue}>{formatCurrency(data.estadisticas?.promedio_ingreso_mensual)}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Detalle de Pagos Recientes</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableColHeader, { width: '20%' }]}>Fecha</Text>
              <Text style={[styles.tableColHeader, { width: '30%' }]}>Conductor</Text>
              <Text style={[styles.tableColHeader, { width: '25%' }]}>Método</Text>
              <Text style={[styles.tableColHeader, { width: '25%', textAlign: 'right' }]}>Monto</Text>
            </View>
            
            {data.pagos?.slice(0, 30).map((pago, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCol, { width: '20%' }]}>{formatDate(pago.fecha_pago)}</Text>
                <Text style={[styles.tableCol, { width: '30%' }]}>{pago.nombre_conductor}</Text>
                <Text style={[styles.tableCol, { width: '25%' }]}>{pago.metodo_pago || 'N/A'}</Text>
                <Text style={[styles.tableCol, { width: '25%', textAlign: 'right' }]}>{formatCurrency(pago.monto_total)}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer} fixed>Desarrollado por somoslazaro.marketing</Text>
        <Text style={styles.pageNumber} render={({ pageNumber }) => `Página ${pageNumber}`} fixed />
      </Page>

      {/* ========== PÁGINA 4: HISTORIAL DE OPERACIONES ========== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Historial de Operaciones</Text>
          <Text style={styles.headerSubtitle}>Mantenimientos y Siniestros</Text>
        </View>

        {/* Gráfico de Distribución de Gastos */}
        {imagenesGraficos?.distribucion && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Distribución de Gastos de Mantenimiento</Text>
            <Image src={imagenesGraficos.distribucion} style={styles.chartImage} />
          </View>
        )}

        {/* Mantenimientos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mantenimientos ({data.mantenimientos?.length || 0})</Text>
          <Text style={{ fontSize: 11, marginBottom: 10, color: '#94A3B8' }}>
            Total gastado: {formatCurrency(data.estadisticas?.total_mantenimientos)}
          </Text>
          
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableColHeader, { width: '20%' }]}>Fecha</Text>
              <Text style={[styles.tableColHeader, { width: '35%' }]}>Tipo</Text>
              <Text style={[styles.tableColHeader, { width: '20%' }]}>Estado</Text>
              <Text style={[styles.tableColHeader, { width: '25%', textAlign: 'right' }]}>Costo</Text>
            </View>
            
            {data.mantenimientos?.slice(0, 15).map((mant, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCol, { width: '20%' }]}>
                  {formatDate(mant.fecha_realizada || mant.fecha_programada)}
                </Text>
                <Text style={[styles.tableCol, { width: '35%' }]}>{mant.tipo_servicio}</Text>
                <Text style={[styles.tableCol, { width: '20%' }]}>{mant.estado}</Text>
                <Text style={[styles.tableCol, { width: '25%', textAlign: 'right' }]}>
                  {formatCurrency(mant.costo_total)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Siniestros */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Siniestros ({data.siniestros?.length || 0})</Text>
          
          {data.siniestros && data.siniestros.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableColHeader, { width: '20%' }]}>Fecha</Text>
                <Text style={[styles.tableColHeader, { width: '35%' }]}>Tipo</Text>
                <Text style={[styles.tableColHeader, { width: '20%' }]}>Estado</Text>
                <Text style={[styles.tableColHeader, { width: '25%', textAlign: 'right' }]}>Costo</Text>
              </View>
              
              {data.siniestros.slice(0, 10).map((sin, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={[styles.tableCol, { width: '20%' }]}>{formatDate(sin.fecha_incidente)}</Text>
                  <Text style={[styles.tableCol, { width: '35%' }]}>{sin.tipo_siniestro}</Text>
                  <Text style={[styles.tableCol, { width: '20%' }]}>{sin.estado}</Text>
                  <Text style={[styles.tableCol, { width: '25%', textAlign: 'right' }]}>
                    {formatCurrency(sin.costo_final)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 11, color: '#10B981', fontWeight: 'bold' }}>
              ✓ Sin siniestros registrados
            </Text>
          )}
        </View>

        <Text style={styles.footer} fixed>Desarrollado por somoslazaro.marketing</Text>
        <Text style={styles.pageNumber} render={({ pageNumber }) => `Página ${pageNumber}`} fixed />
      </Page>

      {/* ========== PÁGINA 5: HISTORIAL DE ASIGNACIÓN ========== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Historial de Asignación</Text>
          <Text style={styles.headerSubtitle}>Conductores que han operado el vehículo</Text>
        </View>

        <View style={styles.section}>
          <Text style={{ fontSize: 11, marginBottom: 10, color: '#94A3B8' }}>
            Total de conductores: {data.estadisticas?.total_conductores || 0}
          </Text>
          
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableColHeader, { width: '30%' }]}>Conductor</Text>
              <Text style={[styles.tableColHeader, { width: '20%' }]}>Inicio</Text>
              <Text style={[styles.tableColHeader, { width: '20%' }]}>Fin</Text>
              <Text style={[styles.tableColHeader, { width: '15%' }]}>Días</Text>
              <Text style={[styles.tableColHeader, { width: '15%' }]}>Estado</Text>
            </View>
            
            {data.asignaciones?.map((asig, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCol, { width: '30%' }]}>{asig.nombre_conductor}</Text>
                <Text style={[styles.tableCol, { width: '20%' }]}>{formatDate(asig.fecha_inicio)}</Text>
                <Text style={[styles.tableCol, { width: '20%' }]}>{asig.fecha_fin ? formatDate(asig.fecha_fin) : 'Activo'}</Text>
                <Text style={[styles.tableCol, { width: '15%' }]}>{asig.dias_con_vehiculo || 0}</Text>
                <Text style={[styles.tableCol, { width: '15%' }]}>{asig.activa ? 'Activo' : 'Cerrado'}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer} fixed>Desarrollado por somoslazaro.marketing</Text>
        <Text style={styles.pageNumber} render={({ pageNumber }) => `Página ${pageNumber}`} fixed />
      </Page>

      {/* ========== PÁGINA 6: APÉNDICE DE DATOS (LA "SPEC SHEET") ========== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Apéndice de Datos</Text>
          <Text style={styles.headerSubtitle}>Especificaciones del Vehículo e Inversión</Text>
        </View>

        {/* Datos Generales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos Generales</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Número de Vehículo</Text>
              <Text style={styles.gridValue}>{data.vehiculo?.numero_vehiculo}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Tipo Socio</Text>
              <Text style={styles.gridValue}>{data.vehiculo?.tipo_socio}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Marca</Text>
              <Text style={styles.gridValue}>{data.vehiculo?.marca}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Modelo</Text>
              <Text style={styles.gridValue}>{data.vehiculo?.modelo}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Año</Text>
              <Text style={styles.gridValue}>{data.vehiculo?.año_del_vehiculo}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Color</Text>
              <Text style={styles.gridValue}>{data.vehiculo?.color}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Placa</Text>
              <Text style={styles.gridValue}>{data.vehiculo?.placa}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>VIN</Text>
              <Text style={styles.gridValue}>{data.vehiculo?.numero_de_serie_vehiculo}</Text>
            </View>
          </View>
        </View>

        {/* Especificaciones Técnicas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Especificaciones Técnicas</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Tipo de Vehículo</Text>
              <Text style={styles.gridValue}>{data.vehiculo?.tipo_vehiculo}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Tipo de Combustible</Text>
              <Text style={styles.gridValue}>{data.vehiculo?.tipo_combustible}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Número de Motor</Text>
              <Text style={styles.gridValue}>{data.vehiculo?.numero_motor || 'N/A'}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Kilometraje Registrado</Text>
              <Text style={styles.gridValue}>{data.vehiculo?.kilometraje_actual?.toLocaleString('es-MX')} km</Text>
            </View>
          </View>
        </View>

        {/* Información de Póliza */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de Seguro</Text>
          {data.poliza ? (
            <View style={styles.grid}>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Número de Póliza</Text>
                <Text style={styles.gridValue}>{data.poliza.numero_poliza}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Aseguradora</Text>
                <Text style={styles.gridValue}>{data.poliza.aseguradora}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Fecha de Vencimiento</Text>
                <Text style={styles.gridValue}>{formatDate(data.poliza.fecha_vencimiento)}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Monto Deducible</Text>
                <Text style={styles.gridValue}>{formatCurrency(data.vehiculo?.monto_deducible)}</Text>
              </View>
            </View>
          ) : (
            <Text style={{ fontSize: 11, color: '#94A3B8' }}>Sin información de póliza</Text>
          )}
        </View>

        {/* Información de Inversión */}
        {data.inversion && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información de Inversión</Text>
            <View style={styles.grid}>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Inversionista</Text>
                <Text style={styles.gridValue}>{data.inversion.inversionista_nombre || 'N/A'}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Modelo de Negocio</Text>
                <Text style={styles.gridValue}>{data.inversion.modelo_negocio}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Tasa de Rendimiento</Text>
                <Text style={styles.gridValue}>{data.inversion.tasa_rendimiento}%</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Pago Mensual</Text>
                <Text style={styles.gridValue}>{formatCurrency(data.inversion.pago_mensual_inversionista)}</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.footer} fixed>Desarrollado por somoslazaro.marketing</Text>
        <Text style={styles.pageNumber} render={({ pageNumber }) => `Página ${pageNumber}`} fixed />
      </Page>
    </Document>
  );
};

// ========== COMPONENTE BOTÓN CON CAPTURA DE GRÁFICOS ==========
export const GenerarPDFButton = ({ data, onPrepareImages, imagenesGraficos }) => {
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [imagenesPrepared, setImagenesPrepared] = useState(false);

  if (!data) return null;

  const handlePrepareAndDownload = async () => {
    if (!imagenesPrepared && onPrepareImages) {
      setIsPreparingImages(true);
      try {
        await onPrepareImages();
        setImagenesPrepared(true);
      } catch (error) {
        console.error('Error preparando imágenes:', error);
      } finally {
        setIsPreparingImages(false);
      }
    }
  };

  const fileName = `Reporte_${data.vehiculo?.numero_vehiculo}_${new Date().toISOString().split('T')[0]}.pdf`;

  if (isPreparingImages) {
    return (
      <button 
        disabled
        className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white opacity-50"
      >
        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
        <span>Preparando gráficos...</span>
      </button>
    );
  }

  return (
    <PDFDownloadLink 
      document={<VehiculoPDFReport data={data} imagenesGraficos={imagenesGraficos} />} 
      fileName={fileName}
      className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white hover:bg-white/20 transition-all"
      onClick={handlePrepareAndDownload}
    >
      {({ blob, url, loading, error }) => {
        if (loading) {
          return (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              <span>Generando PDF...</span>
            </>
          );
        }
        
        if (error) {
          return <span>Error al generar PDF</span>;
        }

        return (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Descargar PDF</span>
          </>
        );
      }}
    </PDFDownloadLink>
  );
};

export default VehiculoPDFReport;