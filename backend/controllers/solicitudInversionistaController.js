const { db } = require('../config/database');
const auditService = require('../services/auditService.js'); // Ajusta a tu ruta
const emailService = require('../utils/emailService');

// ==========================================
// 1. CREAR SOLICITUD (PÚBLICO)
// ==========================================
exports.crearSolicitud = async (req, res) => {
  try {
    console.log("🚀 [PASO 3] Entrando al controlador crearSolicitud!");
    console.log("📝 Textos recibidos (req.body):", req.body);
    console.log("📁 Archivos recibidos (req.files):", req.files ? Object.keys(req.files) : "Ninguno");
    const datos = req.body;
    const archivos = req.files || {};

    // Función auxiliar para atrapar la URL segura de Cloudinary desde Multer
    const getPath = (fieldName) => {
      return archivos[fieldName] && archivos[fieldName][0] 
        ? archivos[fieldName][0].path 
        : null;
    };

    // ==========================================
    // 🛡️ CAPA 0: SANITIZACIÓN DE DATOS
    // ==========================================
    const capitalizarTexto = (texto) => {
      if (!texto) return '';
      return texto.toString().toLowerCase().trim().split(/\s+/).map(palabra => {
          if (palabra.length === 0) return '';
          return palabra.charAt(0).toUpperCase() + palabra.slice(1);
        }).join(' ');
    };

    const limpiarTexto = (texto) => texto ? texto.toString().trim() : '';
    const limpiarMayusculas = (texto) => texto ? texto.toString().toUpperCase().trim() : '';

    // APLICACIÓN DEL ESTÁNDAR
    const tipoLimpio = limpiarTexto(datos.tipo_inversionista) || 'Física';
    const nombreLimpio = capitalizarTexto(datos.nombre);
    const emailLimpio = datos.email ? datos.email.toString().toLowerCase().trim() : '';
    const telefonoLimpio = limpiarTexto(datos.telefono);
    const whatsappLimpio = limpiarTexto(datos.whatsapp);
    const direccionLimpia = limpiarTexto(datos.direccion);
    const rfcLimpio = limpiarMayusculas(datos.rfc);
    
    // Extra para solicitud
    const comoNosConocioLimpio = capitalizarTexto(datos.como_nos_conocio);
    const planPreferidoLimpio = capitalizarTexto(datos.plan_preferido);
    const mensajeLimpio = limpiarTexto(datos.mensaje);
    const montoInteresParseado = datos.monto_interes ? parseFloat(datos.monto_interes) : null;

    // Bancarios
    const bancoLimpio = capitalizarTexto(datos.banco);
    const cuentaLimpia = limpiarTexto(datos.cuenta_bancaria);
    const clabeLimpia = limpiarTexto(datos.clabe);
    const nombreCuentaLimpio = capitalizarTexto(datos.nombre_cuenta_banco);

    // Exclusivos Física
    const curpLimpia = limpiarMayusculas(datos.curp);
    const estadoCivilLimpio = capitalizarTexto(datos.estado_civil);

    // 🚀 Documentos (Atrapados directamente de Cloudinary)
    const docIdentificacionLimpio = getPath('doc_identificacion');
    const docConstanciaLimpio = getPath('doc_constancia_fiscal');
    const docComprobanteLimpio = getPath('doc_comprobante_domicilio');
    const docCuentaBancoLimpio = getPath('doc_cuenta_banco');
    const docActaLimpio = getPath('doc_acta_constitutiva');
    const docPoderLimpio = getPath('doc_poder_legal');
    const docIdRepresentanteLimpio = getPath('doc_id_representante');

    // ==========================================
    // 1. VALIDACIÓN DE CAMPOS GENERALES
    // ==========================================
    if (!nombreLimpio || !emailLimpio || !telefonoLimpio || !direccionLimpia || !rfcLimpio || !bancoLimpio || !clabeLimpia || !nombreCuentaLimpio) {
      return res.status(400).json({ success: false, message: '⚠️ Faltan datos obligatorios (Personales o Bancarios).' });
    }

    if (!docIdentificacionLimpio || !docConstanciaLimpio || !docComprobanteLimpio || !docCuentaBancoLimpio) {
      return res.status(400).json({ success: false, message: '⚠️ Faltan documentos obligatorios (Identificación, Constancia, Domicilio o Carátula Bancaria).' });
    }

    // ==========================================
    // 2. VALIDACIÓN CONDICIONAL (Física vs Moral)
    // ==========================================
    if (tipoLimpio === 'Física') {
      if (!curpLimpia || curpLimpia.length < 18) {
        return res.status(400).json({ success: false, message: '⛔ El CURP es obligatorio y debe tener 18 caracteres.' });
      }
      if (!estadoCivilLimpio) {
        return res.status(400).json({ success: false, message: '⛔ El Estado Civil es obligatorio.' });
      }
    } else if (tipoLimpio === 'Moral') {
      if (!docActaLimpio || !docPoderLimpio || !docIdRepresentanteLimpio) {
        return res.status(400).json({ success: false, message: '⛔ Los documentos de la empresa (Acta, Poder e ID del representante) son obligatorios.' });
      }
    }

    // ==========================================
    // 3. VALIDACIÓN ESTRICTA DE DUPLICADOS EN SOLICITUDES
    // ==========================================
    // 💡 Aquí validamos si ya mandó una solicitud que sigue "Pendiente"
    let queryDuplicados = db('solicitudes_inversionistas')
      .where('estado_aceptacion', 'Pendiente')
      .andWhere(function() {
        this.where('email', emailLimpio)
            .orWhere('rfc', rfcLimpio)
            .orWhere('clabe', clabeLimpia);
            
        if (tipoLimpio === 'Física' && curpLimpia) {
          this.orWhere('curp', curpLimpia);
        }
      });

    const solicitudPendiente = await queryDuplicados.first();

    if (solicitudPendiente) {
      let campoDuplicado = '';
      if (solicitudPendiente.email === emailLimpio) campoDuplicado = 'Email';
      else if (solicitudPendiente.rfc === rfcLimpio) campoDuplicado = 'RFC';
      else if (solicitudPendiente.clabe === clabeLimpia) campoDuplicado = 'CLABE Interbancaria';
      else if (solicitudPendiente.curp === curpLimpia) campoDuplicado = 'CURP';

      return res.status(400).json({ 
        success: false, 
        message: `⛔ Ya existe una solicitud en proceso con este ${campoDuplicado}. Por favor, espera a que sea evaluada.` 
      });
    }

    // ==========================================
    // 4. INSERCIÓN EN LA BD (TABLA: solicitudes_inversionistas)
    // ==========================================
    const [nuevaSolicitud] = await db('solicitudes_inversionistas').insert({
      tipo_inversionista: tipoLimpio,
      nombre: nombreLimpio,
      email: emailLimpio,
      telefono: telefonoLimpio,
      whatsapp: whatsappLimpio || null,
      direccion: direccionLimpia,
      rfc: rfcLimpio,
      
      // Exclusivos Física
      curp: tipoLimpio === 'Física' ? curpLimpia : null,
      estado_civil: tipoLimpio === 'Física' ? estadoCivilLimpio : null,
      
      // Exclusivos Solicitud
      como_nos_conocio: comoNosConocioLimpio || null,
      plan_preferido: planPreferidoLimpio || null,
      monto_interes: montoInteresParseado,
      mensaje: mensajeLimpio || null,

      // Bancarios
      nombre_cuenta_banco: nombreCuentaLimpio,
      banco: bancoLimpio,
      cuenta_bancaria: cuentaLimpia || null,
      clabe: clabeLimpia,

      // Documentos (Links)
      doc_identificacion: docIdentificacionLimpio,
      doc_constancia_fiscal: docConstanciaLimpio,
      doc_comprobante_domicilio: docComprobanteLimpio,
      doc_cuenta_banco: docCuentaBancoLimpio,
      doc_acta_constitutiva: tipoLimpio === 'Moral' ? docActaLimpio : null,
      doc_poder_legal: tipoLimpio === 'Moral' ? docPoderLimpio : null,
      doc_id_representante: tipoLimpio === 'Moral' ? docIdRepresentanteLimpio : null,

            // --- Valores Default ---
      status: 'Activo',
      tasa_rendimiento: 1.56,
      monto_minimo_inversion: 50000,
      password_hash: null,
      monto_interes: null,
      plan_preferido: null,
      como_nos_conocio: null,
      mensaje: null,
      monto_total_invertido: 0,

      // Control interno de la solicitud
      estado_aceptacion: 'Pendiente',
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    }).returning('*');


    // 🚀 --- PEGA ESTO AQUÍ --- 🚀
    console.log("📧 Intentando enviar correo a los administradores...");
    
    // Si tu insert no devuelve el objeto, puedes mandar req.body, pero es mejor el objeto de la BD para tener el ID y Fecha
    const datosParaCorreo = nuevaSolicitud || req.body; 

    emailService.sendNuevaSolicitudInversionistaNotification({ 
      solicitud: datosParaCorreo 
    })
    .then(resultado => {
      console.log("✅ Resultado del servicio de correos:", resultado);
    })
    .catch(err => {
      console.error("❌ Fallo crítico al enviar correo:", err);
    });
    // 🚀 ------------------------ 🚀

    // ==========================================
    // 5. RESPUESTA EXITOSA (ÚNICA)
    // ==========================================
    return res.status(201).json({
      success: true,
      message: '✅ Solicitud enviada exitosamente.',
      solicitud: nuevaSolicitud
    });

  } catch (error) {
    console.error('❌ Error al crear la solicitud de inversionista:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno al procesar la solicitud.',
      error: error.message 
    });
  }
};

// ==========================================
// 2. OBTENER LISTA DE SOLICITUDES (ADMIN)
// ==========================================
exports.obtenerSolicitudes = async (req, res) => {
  try {
    const { estado } = req.query; // Puede venir '?estado=Pendiente'
    
    let query = db('solicitudes_inversionistas')
      .select('*') // 🚀 EL CAMBIO MÁGICO: Ahora trae RFC, documentos, banco, TODO.
      .orderBy('created_at', 'desc');

    if (estado) {
      query = query.where('estado_aceptacion', estado);
    }

    const solicitudes = await query;

    // Retornamos 'data' para mantener la consistencia con tu frontend (data.data)
    res.json({ success: true, data: solicitudes }); 
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al obtener solicitudes' });
  }
};

// ==========================================
// 3. OBTENER DETALLE DE UNA SOLICITUD (ADMIN)
// ==========================================
exports.obtenerSolicitudPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const solicitud = await db('solicitudes_inversionistas').where('id', id).first();

    if (!solicitud) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }

    res.json({ success: true, solicitud });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al obtener la solicitud' });
  }
};

// ==========================================
// 4. EVALUAR SOLICITUD (LA MAGIA DE ACEPTAR/RECHAZAR)
// ==========================================
exports.evaluarSolicitud = async (req, res) => {
  const { id } = req.params;
  const { accion, motivo_rechazo } = req.body; // accion = 'Aceptar' | 'Rechazar'

  try {
    const solicitud = await db('solicitudes_inversionistas').where('id', id).first();
    if (!solicitud) return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });

    if (solicitud.estado_aceptacion !== 'Pendiente') {
      return res.status(400).json({ success: false, error: 'Esta solicitud ya fue evaluada' });
    }

    // 🔴 CASO: RECHAZAR
    if (accion === 'Rechazar') {
      await db('solicitudes_inversionistas').where('id', id).update({
        estado_aceptacion: 'Rechazada',
        motivo_rechazo: motivo_rechazo || 'No cumple con los requisitos mínimos.',
        updated_at: new Date()
      });
      return res.json({ success: true, message: 'Solicitud rechazada correctamente' });
    }

    // 🟢 CASO: ACEPTAR (Usamos transacción para asegurar que todo se guarde o nada)
    if (accion === 'Aceptar') {
      await db.transaction(async (trx) => {
        
        // 1. Marcar solicitud como Aceptada
        await trx('solicitudes_inversionistas').where('id', id).update({
          estado_aceptacion: 'Aceptada',
          updated_at: new Date()
        });

        // 2. Copiar los datos a la tabla oficial de 'inversionistas'
        const [nuevoInversionistaId] = await trx('inversionistas').insert({
          nombre: solicitud.nombre,
          email: solicitud.email,
          telefono: solicitud.telefono,
          rfc: solicitud.rfc,
          direccion: solicitud.direccion,
          banco: solicitud.banco,
          cuenta_bancaria: solicitud.cuenta_bancaria,
          clabe: solicitud.clabe,
          tipo_inversionista: solicitud.tipo_inversionista,
          // Si tu tabla de inversionistas tiene campos extra, los pones aquí por defecto
          status: 'Activo', 
          created_at: new Date(),
          updated_at: new Date()
        }).returning('id');

        // 📝 Opcional: Aquí podrías mandar un correo de bienvenida

      }); // Fin de transacción

      return res.json({ success: true, message: 'Solicitud aceptada y nuevo Inversionista creado' });
    }

    return res.status(400).json({ success: false, error: 'Acción no válida' });

  } catch (error) {
    // Auditamos el error crítico
    if(req.user) {
        await auditService.logError({
        usuario_id: req.user?.id,
        nivel: 'error',
        mensaje: `Error evaluando solicitud ${id}: ${error.message}`,
        stack_trace: error.stack,
        });
    }

    console.error(error);
    res.status(500).json({ success: false, error: 'Error interno al evaluar la solicitud' });
  }
};