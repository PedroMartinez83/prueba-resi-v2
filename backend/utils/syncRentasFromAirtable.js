#!/usr/bin/env node

/**
 * Script de Sincronización: Airtable Rentas → PostgreSQL
 * 
 * Sincroniza todas las rentas desde Airtable hacia la tabla rentas de PostgreSQL
 * Uso: node backend/utils/syncRentasFromAirtable.js
 */

require('dotenv').config();

const { db } = require('../config/database');
const base = require('airtable').base(process.env.AIRTABLE_BASE_ID);

const TABLES = {
  RENTAS: 'Rentas',
  CONDUCTORES: 'Conductores'
};

async function syncRentas() {
  console.log('🔄 Iniciando sincronización de RENTAS (Airtable → PostgreSQL)...\n');
  
  let sincronizados = 0;
  let creados = 0;
  let actualizados = 0;
  let errores = 0;
  
  try {
    // 1️⃣ Obtener todas las rentas de Airtable
    console.log('📥 Obteniendo rentas de Airtable...');
    const rentasAirtable = await base(TABLES.RENTAS)
      .select()
      .all();

    console.log(`✅ ${rentasAirtable.length} rentas encontradas en Airtable\n`);

    // 2️⃣ Para cada renta de Airtable, sincronizar a PostgreSQL
    for (const record of rentasAirtable) {
      try {
        const fields = record.fields;
        
        // Mapear campos de Airtable a PostgreSQL
        const rentaData = {
          airtable_id: record.id,
          folio_renta: fields['Folio Renta'] || null,
          monto_base: parseFloat(fields['Monto Base'] || 0),
          ajuste_refacciones: parseFloat(fields['Ajuste Refacciones'] || 0),
          monto_total: parseFloat(fields['Monto Total'] || 0),
          fecha_inicio: fields['Fecha Inicio'] ? new Date(fields['Fecha Inicio']) : null,
          fecha_vencimiento: fields['Fecha Vencimiento'] ? new Date(fields['Fecha Vencimiento']) : null,
          fecha_pago: fields['Fecha Pago'] ? new Date(fields['Fecha Pago']) : null,
          estado: fields['Estado'] || 'Pendiente',
          dias_retraso: fields['Días Retraso'] || null,
          metodo_pago: fields['Método Pago'] || null,
          stripe_payment_id: fields['Stripe Payment ID'] || null,
          numero_semana: parseInt(fields['Número Semana'] || 0),
          comprobante_url: fields['Comprobante URL'] || null,
          tipo_socio: Array.isArray(fields['Tipo Socio']) ? JSON.stringify(fields['Tipo Socio']) : fields['Tipo Socio'] || null,
          observaciones: fields['Observaciones'] || null
        };

        // Obtener conductor_id desde el nombre o ID del conductor
        let conductor_id = null;
        if (fields['ConductorID']) {
          // Si viene un ID directo
          conductor_id = parseInt(fields['ConductorID']);
        } else if (fields['Conductor'] && Array.isArray(fields['Conductor']) && fields['Conductor'].length > 0) {
          // Si viene un record link, obtener el ID del conductor
          // Nota: Esto requeriría una consulta adicional a Airtable
          console.log(`   ⚠️  Renta ${record.id}: No se pudo mapear conductor (es record link)`);
        }

        // Obtener vehiculo_id si es necesario
        let vehiculo_id = null;
        if (fields['VehiculoID']) {
          vehiculo_id = parseInt(fields['VehiculoID']);
        }

        // 3️⃣ Verificar si la renta ya existe en PostgreSQL
        const existente = await db('rentas')
          .where('airtable_id', record.id)
          .first();

        if (existente) {
          // Actualizar
          await db('rentas')
            .where('airtable_id', record.id)
            .update({
              ...rentaData,
              updated_at: new Date()
            });
          
          actualizados++;
          console.log(`   ✏️  ACTUALIZADO: Renta ${rentaData.folio_renta || record.id}`);
        } else {
          // Crear
          await db('rentas')
            .insert({
              ...rentaData,
              conductor_id: conductor_id,
              vehiculo_id: vehiculo_id,
              created_at: new Date(),
              updated_at: new Date()
            });
          
          creados++;
          console.log(`   ➕ CREADO: Renta ${rentaData.folio_renta || record.id}`);
        }

        sincronizados++;

      } catch (error) {
        errores++;
        console.error(`   ❌ ERROR en renta ${record.id}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE SINCRONIZACIÓN');
    console.log('='.repeat(60));
    console.log(`✅ Total sincronizados: ${sincronizados}/${rentasAirtable.length}`);
    console.log(`   ➕ Creados: ${creados}`);
    console.log(`   ✏️  Actualizados: ${actualizados}`);
    console.log(`   ❌ Errores: ${errores}`);
    console.log('='.repeat(60));

    if (errores === 0) {
      console.log('\n✨ ¡Sincronización completada exitosamente!');
    } else {
      console.log(`\n⚠️  Sincronización completada con ${errores} error(es)`);
    }

    process.exit(errores === 0 ? 0 : 1);

  } catch (error) {
    console.error('\n❌ ERROR CRÍTICO en sincronización:', error.message);
    console.error('📍 Stack:', error.stack);
    process.exit(1);
  }
}

// Ejecutar sincronización
syncRentas();
