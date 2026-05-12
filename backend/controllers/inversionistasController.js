// backend/controllers/inversionistasController.js
const postgresService = require('../services/postgresService');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // Módulo nativo de Node.js para generar strings aleatorios
const { TABLES, db } = postgresService;
const emailService = require('../utils/emailService'); // Ajusta la ruta correcta

// ========== OBTENER TODOS LOS INVERSIONISTAS ==========
exports.getInversionistas = async (req, res) => {
  try {
    console.log('📋 Obteniendo inversionistas...');
    
    const query = `
      SELECT 
        i.*,
        COUNT(DISTINCT iv.id) as total_inversiones,
        
        -- 🔒 MAGIA AQUÍ: Solo sumamos el monto si el contrato está 'Activa'
        SUM(CASE WHEN iv.status = 'Activa' THEN iv.monto_invertido ELSE 0 END) as monto_total_invertido,
        
        COUNT(DISTINCT CASE WHEN iv.status = 'Activa' THEN iv.id END) as inversiones_activas
      FROM inversionistas i
      LEFT JOIN contratos_inversion iv ON i.id = iv.inversionista_id
      GROUP BY i.id
      ORDER BY i.nombre
    `;
    
    const result = await db.raw(query);
    const inversionistas = result.rows;
    
    res.json({
      success: true,
      inversionistas
    });
  } catch (error) {
    console.error('❌ Error obteniendo inversionistas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener inversionistas',
      message: error.message
    });
  }
};

// ========== OBTENER UN INVERSIONISTA POR ID ==========
exports.getInversionistaById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Buscando inversionista ID:', id);
    
    // Obtener datos del inversionista
    const inversionista = await postgresService.getById('inversionistas', id); 
    
    if (!inversionista) {
      return res.status(404).json({
        success: false,
        error: 'Inversionista no encontrado'
      });
    }

    // 🔒 MAGIA AQUÍ: Buscamos si ya tiene un usuario de acceso creado
    const usuarioAsociado = await db('usuarios')
      .select('id as usuario_id')
      .where('inversionista_id', id)
      .first();

    // Si tiene usuario, le inyectamos el ID al objeto que va al front
    if (usuarioAsociado) {
      inversionista.usuario_id = usuarioAsociado.usuario_id;
    }
    
    // Obtener sus inversiones con JOIN a vehículos
    const inversiones = await db('contratos_inversion as iv')
      .leftJoin('vehiculos as v', 'iv.vehiculo_id', 'v.id')
      .select(
        'iv.*',
        'v.id as vehiculo_id',
        'v.numero_vehiculo as vehiculo_numero',
        'v.marca',
        'v.modelo as modelo_vehiculo',
        'v.placa',
        db.raw(`(
          SELECT COUNT(*) 
          FROM pagos_inversionistas p 
          WHERE p.inversion_id = iv.id
          AND p.status = 'Completado'
        ) as pagos_realizados`)
      )
      .where('iv.inversionista_id', id)
      .orderBy('iv.fecha_inicio', 'desc');

    
    // Obtener pagos recientes (El historial real de transferencias)
    const pagos = await db('pagos_inversionistas as p')
      .leftJoin('contratos_inversion as iv', 'p.inversion_id', 'iv.id')
      .leftJoin('vehiculos as v', 'iv.vehiculo_id', 'v.id')
      .select(
        'p.*',
        'v.numero_vehiculo as vehiculo_numero'
      )
      .where('iv.inversionista_id', id) 
      .orderBy('p.numero_cuota', 'asc')  
      .limit(12);
    
    res.json({
      success: true,
      inversionista,
      inversionista_id: inversionista.id,
      inversiones,
      pagos
    });
  } catch (error) {
    console.error('❌ Error obteniendo inversionista:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener inversionista',
      message: error.message
    });
  }
};

// ========== CREAR INVERSIONISTA ==========

// Validador estricto de RFC Mexicano (Backend)
const validarRFC = (rfc) => {
  const rfcRegex = /^([A-ZÑ&]{3,4}) ?(?:- ?)?(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])) ?(?:- ?)?([A-Z\d]{2})([A\d])$/i;
  return rfcRegex.test(rfc);
};

exports.crearInversionista = async (req, res) => {
  try {
    // 1. Extraemos TODOS los campos (los viejos y los nuevos)
    const { 
      nombre, email, telefono, whatsapp, direccion, rfc, banco, cuenta_bancaria, clabe,
      tipo_inversionista, curp, estado_civil, nombre_cuenta_banco,
      doc_identificacion, doc_constancia_fiscal, doc_comprobante_domicilio, 
      doc_acta_constitutiva, doc_poder_legal, doc_cuenta_banco
    } = req.body;

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
    const tipoLimpio = limpiarTexto(tipo_inversionista) || 'Física';
    const nombreLimpio = capitalizarTexto(nombre);
    const emailLimpio = email ? email.toString().toLowerCase().trim() : '';
    const telefonoLimpio = limpiarTexto(telefono);
    const whatsappLimpio = limpiarTexto(whatsapp);
    const direccionLimpia = limpiarTexto(direccion);
    const rfcLimpio = limpiarMayusculas(rfc);
    
    // Bancarios
    const bancoLimpio = capitalizarTexto(banco);
    const cuentaLimpia = limpiarTexto(cuenta_bancaria);
    const clabeLimpia = limpiarTexto(clabe);
    const nombreCuentaLimpio = capitalizarTexto(nombre_cuenta_banco); // Nuevo: Nombre capitalizado

    // Exclusivos Física
    const curpLimpia = limpiarMayusculas(curp); // Nuevo: CURP siempre en mayúsculas
    const estadoCivilLimpio = capitalizarTexto(estado_civil);

    // Documentos (Solo limpiamos espacios en los links)
    const docIdentificacionLimpio = limpiarTexto(doc_identificacion);
    const docConstanciaLimpio = limpiarTexto(doc_constancia_fiscal);
    const docComprobanteLimpio = limpiarTexto(doc_comprobante_domicilio);
    const docActaLimpio = limpiarTexto(doc_acta_constitutiva);
    const docPoderLimpio = limpiarTexto(doc_poder_legal);
    const docCuentaBancoLimpio = limpiarTexto(doc_cuenta_banco);

    // ==========================================
    // 1. VALIDACIÓN DE CAMPOS GENERALES (Comunes para ambos)
    // ==========================================
    if (!nombreLimpio || !emailLimpio || !telefonoLimpio || !direccionLimpia || !rfcLimpio || !bancoLimpio || !clabeLimpia || !nombreCuentaLimpio) {
      return res.status(400).json({ 
        success: false, 
        message: '⚠️ Faltan datos obligatorios (Personales o Bancarios).' 
      });
    }

    // Validación de Documentos Comunes
    if (!docIdentificacionLimpio || !docConstanciaLimpio || !docComprobanteLimpio || !docCuentaBancoLimpio) {
      return res.status(400).json({ 
        success: false, 
        message: '⚠️ Faltan documentos obligatorios (Identificación, Constancia, Domicilio o Carátula Bancaria).' 
      });
    }

    // ==========================================
    // 2. VALIDACIÓN CONDICIONAL (Física vs Moral)
    // ==========================================
    if (tipoLimpio === 'Física') {
      if (!curpLimpia || curpLimpia.length < 18) {
        return res.status(400).json({ success: false, message: '⛔ El CURP es obligatorio y debe tener 18 caracteres.' });
      }
      if (!estadoCivilLimpio) {
        return res.status(400).json({ success: false, message: '⛔ El Estado Civil es obligatorio para personas físicas.' });
      }
    } else if (tipoLimpio === 'Moral') {
      if (!docActaLimpio || !docPoderLimpio) {
        return res.status(400).json({ success: false, message: '⛔ El Acta Constitutiva y el Poder Legal son obligatorios para personas morales.' });
      }
    }

    // ==========================================
    // 3. VALIDACIÓN ESTRICTA DEL RFC Y DUPLICADOS
    // ==========================================
    // (Asegúrate de tener la función validarRFC declarada)
    if (!validarRFC(rfcLimpio)) {
       return res.status(400).json({ success: false, message: '⛔ El formato del RFC no es válido.' });
    }

    // ✅ 1. Armamos la consulta base con los datos obligatorios para todos
    let queryDuplicados = db('inversionistas')
      .where('email', emailLimpio)
      .orWhere('rfc', rfcLimpio)
      .orWhere('clabe', clabeLimpia);

    // ✅ 2. Si es Persona Física, le agregamos la búsqueda del CURP
    if (tipoLimpio === 'Física' && curpLimpia) {
      queryDuplicados = queryDuplicados.orWhere('curp', curpLimpia);
    }

    // Ejecutamos la búsqueda
    const inversionistaExistente = await queryDuplicados.first();

if (inversionistaExistente) {
      // ✅ 3. Identificamos exactamente qué fue lo que se repitió
      let campoDuplicado = '';
      if (inversionistaExistente.email === emailLimpio) campoDuplicado = 'Email';
      else if (inversionistaExistente.rfc === rfcLimpio) campoDuplicado = 'RFC';
      else if (inversionistaExistente.clabe === clabeLimpia) campoDuplicado = 'CLABE Interbancaria';
      else if (inversionistaExistente.curp === curpLimpia) campoDuplicado = 'CURP'; // <-- Identificador de CURP

      return res.status(400).json({ 
        success: false, 
        message: `⛔ Ya existe un inversionista registrado con ese ${campoDuplicado}.` 
      });
    }

    // ==========================================
    // 4. INSERCIÓN EN LA BD
    // ==========================================
    const [nuevoInversionista] = await db('inversionistas').insert({
      // --- Datos Generales ---
      tipo_inversionista: tipoLimpio, // Ya no está "quemado" como Individual
      nombre: nombreLimpio,
      email: emailLimpio,
      telefono: telefonoLimpio,
      whatsapp: whatsappLimpio || null,
      direccion: direccionLimpia,
      rfc: rfcLimpio,
      
      // --- Exclusivos Física ---
      curp: tipoLimpio === 'Física' ? curpLimpia : null,
      estado_civil: tipoLimpio === 'Física' ? estadoCivilLimpio : null,
      
      // --- Bancarios ---
      nombre_cuenta_banco: nombreCuentaLimpio,
      banco: bancoLimpio,
      cuenta_bancaria: cuentaLimpia || null,
      clabe: clabeLimpia,

      // --- Documentos (Links de Cloudinary) ---
      doc_identificacion: docIdentificacionLimpio,
      doc_constancia_fiscal: docConstanciaLimpio,
      doc_comprobante_domicilio: docComprobanteLimpio,
      doc_cuenta_banco: docCuentaBancoLimpio,
      doc_acta_constitutiva: tipoLimpio === 'Moral' ? docActaLimpio : null,
      doc_poder_legal: tipoLimpio === 'Moral' ? docPoderLimpio : null,

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
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    }).returning('*');

    // ==========================================
    // 5. RESPUESTA EXITOSA
    // ==========================================
    return res.status(201).json({
      success: true,
      message: '✅ Inversionista creado exitosamente.',
      inversionista: nuevoInversionista
    });

  } catch (error) {
    console.error('❌ Error al crear inversionista:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno al guardar en la base de datos.',
      error: error.message 
    });
  }
};

// ========= ELIMINAR INVERSIONISTA (BORRADO LÓGICO Y FÍSICO DE ACCESO) ==========
exports.eliminarInversionista = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Verificamos que el inversionista exista y no esté ya eliminado
    const inversionistaActual = await db('inversionistas').where('id', id).first();
    
    if (!inversionistaActual) {
      return res.status(404).json({ success: false, message: 'Inversionista no encontrado.' });
    }

    if (inversionistaActual.status === 'Eliminado') {
      return res.status(400).json({ success: false, message: 'Este inversionista ya fue eliminado.' });
    }

    // 🛡️ Verificar si tiene contratos activos
    const contratoActivo = await db('contratos_inversion')
      .where('inversionista_id', id)
      .andWhere('status', 'Activa') // Solo bloqueamos si están activas
      .first();

    if (contratoActivo) {
      return res.status(400).json({ 
        success: false, 
        message: '⛔ No se puede eliminar a este inversionista porque tiene contratos activos. Por favor, finaliza o elimina sus contratos en "inversiones_vehiculos" primero.' 
      });
    }

    // 2. EL TRUCO DEL SUFIJO (Protegido contra límites de VARCHAR)
    const sufijo = `_del_${id}`; // Ej: "_del_45" 

    const safeAppend = (valorOriginal, limiteMaximo) => {
      if (!valorOriginal) return null;
      const texto = String(valorOriginal);
      if (texto.length + sufijo.length > limiteMaximo) {
        return texto.substring(0, limiteMaximo - sufijo.length) + sufijo;
      }
      return texto + sufijo;
    };

    // 3. ACTUALIZACIÓN (Borrado Lógico en Inversionistas)
    await db('inversionistas')
      .where('id', id)
      .update({
        status: 'Eliminado',
        // Liberamos los datos únicos
        email: safeAppend(inversionistaActual.email, 100), 
        rfc: safeAppend(inversionistaActual.rfc, 13),      
        telefono: safeAppend(inversionistaActual.telefono, 15), 
        whatsapp: safeAppend(inversionistaActual.whatsapp, 15),
        clabe: safeAppend(inversionistaActual.clabe, 18), 
        curp: safeAppend(inversionistaActual.curp, 18),   
        updated_at: db.fn.now()
      });

    // ==========================================
    // 🚀 4. BORRADO FÍSICO DEL ACCESO (Tabla Usuarios)
    // ==========================================
    // Le quitamos el acceso de tajo y liberamos su correo para futuros registros
    await db('usuarios')
      .where('inversionista_id', id)
      .del();

    return res.status(200).json({
      success: true,
      message: '🗑️ Inversionista eliminado. Sus datos únicos y cuenta de acceso han sido liberados.'
    });

  } catch (error) {
    console.error('❌ Error al eliminar inversionista:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno al intentar eliminar.',
      error: error.message 
    });
  }
};

// ========== VERIFICAR CAMPO DUPLICADO (Email o RFC) - PARA FRONTEND ==========
exports.verificarCampoDuplicado = async (req, res) => {
  try {
    const { campo, valor } = req.query; // Ej: ?campo=email&valor=correo@test.com

    if (!campo || !valor) {
      return res.status(400).json({ success: false, message: 'Faltan parámetros' });
    }

    // Asegurarnos de que solo consulten campos permitidos
    const camposPermitidos = ['email', 'telefono', 'whatsapp', 'rfc', 'clabe', 'curp'];
    if (!camposPermitidos.includes(campo)) {
      return res.status(400).json({ success: false, message: 'Campo no válido' });
    }

// Asegurarnos de tener el valor limpio
    const valorAComprobar = (campo === 'rfc' || campo === 'curp') ? valor.toUpperCase().trim() : 
                            campo === 'email' ? valor.toLowerCase().trim() : 
                            valor.trim();

    // 1. Buscar primero en la tabla de inversionistas
    let existe = await db('inversionistas')
      .where(campo, valorAComprobar)
      .first();

    // 🔒 2. LA MAGIA: Si el campo es 'email' y NO lo encontró en inversionistas,
    // que vaya y busque en la tabla de 'usuarios' (para atrapar Admins y Conductores)
    if (!existe && campo === 'email') {
      existe = await db('usuarios')
        .where('email', valorAComprobar)
        .first();
    }

    return res.status(200).json({ 
      success: true, 
      existe: !!existe // true si lo encontró en alguna de las dos tablas
    });

  } catch (error) {
    console.error('Error verificando duplicado:', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
};

// ========== VERIFICAR DUPLICADOS EN TIEMPO REAL (INVERSIONISTA) ==========
exports.verificarDuplicadoPerfil = async (req, res) => {
  try {
    const { campo, valor } = req.query;
    const usuarioId = req.user?.id;

    // Buscamos quién es el que está preguntando
    const usuario = await db('usuarios').where('id', usuarioId).first();
    const invId = usuario ? usuario.inversionista_id : null;

    // 1. Verificamos en la tabla de inversionistas (excluyendo al actual)
    let query = db('inversionistas').where(campo, valor);
    if (invId) {
      query = query.andWhereNot('id', invId);
    }
    let duplicado = await query.first();

    // 2. Si el campo es 'email', también checamos la tabla de usuarios
    if (!duplicado && campo === 'email') {
      const usuDuplicado = await db('usuarios')
        .where('email', valor)
        .andWhereNot('id', usuarioId) // Excluimos su propio usuario
        .first();
      
      if (usuDuplicado) duplicado = true;
    }

    return res.json({ success: true, existe: !!duplicado });

  } catch (error) {
    console.error('❌ Error verificando duplicado:', error);
    // Si falla, regresamos false para no trabar el formulario, el backend lo atrapará al final
    return res.json({ success: false, existe: false }); 
  }
};

// ========== ACTUALIZAR INVERSIONISTA ==========
exports.editarInversionista = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Extraemos TODOS los campos (incluyendo los nuevos y los documentos)
    const { 
      nombre, email, telefono, whatsapp, direccion, rfc, banco, cuenta_bancaria, clabe,
      tipo_inversionista, curp, estado_civil, nombre_cuenta_banco, status,
      doc_identificacion, doc_constancia_fiscal, doc_comprobante_domicilio, 
      doc_acta_constitutiva, doc_poder_legal, doc_cuenta_banco
    } = req.body;

    // 2. Verificamos que el inversionista realmente exista
    const inversionistaActual = await db('inversionistas').where('id', id).first();
    if (!inversionistaActual) {
      return res.status(404).json({ success: false, message: 'Inversionista no encontrado.' });
    }

    // ==========================================
    // 🛡️ CAPA DE SANITIZACIÓN (Igual que en Crear)
    // ==========================================
    const capitalizarTexto = (texto) => {
      if (!texto) return '';
      return texto.toString().toLowerCase().trim().split(/\s+/).map(palabra => {
          if (palabra.length === 0) return '';
          return palabra.charAt(0).toUpperCase() + palabra.slice(1);
        }).join(' ');
    };
    const limpiarTexto = (texto) => texto !== undefined && texto !== null ? texto.toString().trim() : '';
    const limpiarMayusculas = (texto) => texto ? texto.toString().toUpperCase().trim() : '';

    const tipoLimpio = limpiarTexto(tipo_inversionista) || inversionistaActual.tipo_inversionista;
    const nombreLimpio = nombre ? capitalizarTexto(nombre) : inversionistaActual.nombre;
    const emailLimpio = email ? email.toString().toLowerCase().trim() : inversionistaActual.email;
    const telefonoLimpio = telefono ? limpiarTexto(telefono) : inversionistaActual.telefono;
    const whatsappLimpio = whatsapp === '' ? null : (whatsapp ? limpiarTexto(whatsapp) : inversionistaActual.whatsapp);
    
    // ⚠️ CRÍTICO: Usamos limpiarTexto para NO arruinar las mayúsculas de tu formato de dirección (C.P.)
    const direccionLimpia = direccion ? limpiarTexto(direccion) : inversionistaActual.direccion;
    
    const rfcLimpio = rfc ? limpiarMayusculas(rfc) : inversionistaActual.rfc;
    const bancoLimpio = banco ? capitalizarTexto(banco) : inversionistaActual.banco;
    const cuentaLimpia = cuenta_bancaria === '' ? null : (cuenta_bancaria ? limpiarTexto(cuenta_bancaria) : inversionistaActual.cuenta_bancaria);
    const clabeLimpia = clabe ? limpiarTexto(clabe) : inversionistaActual.clabe;
    const nombreCuentaLimpio = nombre_cuenta_banco ? capitalizarTexto(nombre_cuenta_banco) : inversionistaActual.nombre_cuenta_banco;
    const curpLimpia = curp ? limpiarMayusculas(curp) : inversionistaActual.curp;
    const estadoCivilLimpio = estado_civil ? capitalizarTexto(estado_civil) : inversionistaActual.estado_civil;

    // ==========================================
    // 🕵️ DETECCIÓN DE CAMBIOS (AUDITORÍA)
    // ==========================================
    const cambios = [];
    
    // Función ayudante para comparar rápido y armar el texto con el formato que lee tu emailService ("Etiqueta: Valor")
    const registrarCambio = (campo, viejo, nuevo) => {
      const valViejo = viejo ? String(viejo).trim() : 'Vacío';
      const valNuevo = nuevo ? String(nuevo).trim() : 'Vacío';
      if (valViejo !== valNuevo) {
        cambios.push(`${campo}: de "${valViejo}" a "${valNuevo}"`);
      }
    };

    registrarCambio('Nombre', inversionistaActual.nombre, nombreLimpio);
    registrarCambio('Email', inversionistaActual.email, emailLimpio);
    registrarCambio('Teléfono', inversionistaActual.telefono, telefonoLimpio);
    registrarCambio('WhatsApp', inversionistaActual.whatsapp, whatsappLimpio);
    registrarCambio('Dirección', inversionistaActual.direccion, direccionLimpia);
    registrarCambio('RFC', inversionistaActual.rfc, rfcLimpio);
    registrarCambio('CURP', inversionistaActual.curp, tipoLimpio === 'Física' ? curpLimpia : null);
    registrarCambio('Estado Civil', inversionistaActual.estado_civil, tipoLimpio === 'Física' ? estadoCivilLimpio : null);
    registrarCambio('Banco', inversionistaActual.banco, bancoLimpio);
    registrarCambio('Cuenta Bancaria', inversionistaActual.cuenta_bancaria, cuentaLimpia);
    registrarCambio('CLABE', inversionistaActual.clabe, clabeLimpia);
    registrarCambio('Titular de Cuenta', inversionistaActual.nombre_cuenta_banco, nombreCuentaLimpio);
    registrarCambio('Tipo de Inversionista', inversionistaActual.tipo_inversionista, tipoLimpio);

    // ==========================================
    // 📂 AUDITORÍA DE DOCUMENTOS (Blindada contra nulls)
    // ==========================================
    
    // Función ayudante: Convierte null, undefined y "" exactamente en lo mismo ('')
    const docCambio = (nuevoValor, viejoValor) => {
      if (nuevoValor === undefined) return false; // Si no lo mandaron, no hay cambio
      const limpioNuevo = nuevoValor ? String(nuevoValor).trim() : '';
      const limpioViejo = viejoValor ? String(viejoValor).trim() : '';
      return limpioNuevo !== limpioViejo;
    };

    if (docCambio(req.body.doc_identificacion, inversionistaActual.doc_identificacion)) {
      cambios.push('Identificación Oficial: Se subió o actualizó el documento');
    }
    
    if (docCambio(req.body.doc_constancia_fiscal, inversionistaActual.doc_constancia_fiscal)) {
      cambios.push('Constancia Fiscal: Se subió o actualizó el documento');
    }
    
    if (docCambio(req.body.doc_comprobante_domicilio, inversionistaActual.doc_comprobante_domicilio)) {
      cambios.push('Comprobante de Domicilio: Se subió o actualizó el documento');
    }
    
    if (docCambio(req.body.doc_cuenta_banco, inversionistaActual.doc_cuenta_banco)) {
      cambios.push('Carátula Bancaria: Se subió o actualizó el documento');
    }
    
    // 🏢 Exclusivos de Persona Moral (Solo si es Moral los revisamos)
    if (tipoLimpio === 'Moral') {
      if (docCambio(req.body.doc_acta_constitutiva, inversionistaActual.doc_acta_constitutiva)) {
        cambios.push('Acta Constitutiva: Se subió o actualizó el documento');
      }
      
      if (docCambio(req.body.doc_poder_legal, inversionistaActual.doc_poder_legal)) {
        cambios.push('Poder Legal: Se subió o actualizó el documento');
      }
    }

    // ==========================================
    // 3. EVITAR DUPLICADOS EN INVERSIONISTAS
    // ==========================================
    let queryDuplicados = db('inversionistas')
      .where(function() {
        this.where('email', emailLimpio)
            .orWhere('rfc', rfcLimpio)
            .orWhere('clabe', clabeLimpia);
            
        // Si es Persona Física, también validamos que no se robe el CURP de otro
        if (tipoLimpio === 'Física' && curpLimpia) {
          this.orWhere('curp', curpLimpia);
        }
      })
      .andWhereNot('id', id); // 🪄 Excluimos a este mismo usuario de la búsqueda

    const duplicado = await queryDuplicados.first();

    if (duplicado) {
      let campoDuplicado = '';
      if (duplicado.email === emailLimpio) campoDuplicado = 'Email';
      else if (duplicado.rfc === rfcLimpio) campoDuplicado = 'RFC';
      else if (duplicado.clabe === clabeLimpia) campoDuplicado = 'CLABE Interbancaria';
      else if (duplicado.curp === curpLimpia) campoDuplicado = 'CURP';

      return res.status(400).json({ 
        success: false, 
        message: `⛔ Ya existe OTRO inversionista registrado con ese ${campoDuplicado}.` 
      });
    }

    // ==========================================
    // 3.5. VALIDACIÓN EXTRA: EVITAR CHOQUE EN LA TABLA USUARIOS
    // ==========================================
    const emailCambio = emailLimpio && emailLimpio !== inversionistaActual.email;

    if (emailCambio) {
      // 1. Buscamos CUALQUIER usuario que tenga ese correo en la tabla
      const usuarioConEseEmail = await db('usuarios')
        .where('email', emailLimpio)
        .first();

      // 2. Si encontramos a alguien...
      if (usuarioConEseEmail) {
        // Evaluamos si ese usuario ES de este mismo inversionista. 
        // Usamos parseInt(id) por si el parámetro viene como texto ('4' vs 4)
        if (usuarioConEseEmail.inversionista_id !== parseInt(id)) {
          return res.status(400).json({ 
            success: false, 
            message: '⛔ No se puede usar este Email. Ya está registrado en otra cuenta de acceso (Administrador, Conductor u otro Inversionista).' 
          });
        }
      }
    }

    // ==========================================
    // 4. ACTUALIZACIÓN EN LA BASE DE DATOS (Transacción)
    // ==========================================
    let inversionistaActualizado;

    await db.transaction(async (trx) => {
      
      // 1. Ejecutamos el UPDATE
      const [actualizado] = await trx('inversionistas')
        .where('id', id)
        .update({
          tipo_inversionista: tipoLimpio,
          nombre: nombreLimpio,
          email: emailLimpio,
          telefono: telefonoLimpio,
          whatsapp: whatsappLimpio,
          direccion: direccionLimpia,
          rfc: rfcLimpio,
          curp: tipoLimpio === 'Física' ? curpLimpia : null,
          estado_civil: tipoLimpio === 'Física' ? estadoCivilLimpio : null,
          banco: bancoLimpio,
          cuenta_bancaria: cuentaLimpia,
          clabe: clabeLimpia,
          nombre_cuenta_banco: nombreCuentaLimpio,
          status: status || inversionistaActual.status,

          doc_identificacion: req.body.doc_identificacion !== undefined ? limpiarTexto(doc_identificacion) : inversionistaActual.doc_identificacion,
          doc_constancia_fiscal: req.body.doc_constancia_fiscal !== undefined ? limpiarTexto(doc_constancia_fiscal) : inversionistaActual.doc_constancia_fiscal,
          doc_comprobante_domicilio: req.body.doc_comprobante_domicilio !== undefined ? limpiarTexto(doc_comprobante_domicilio) : inversionistaActual.doc_comprobante_domicilio,
          doc_cuenta_banco: req.body.doc_cuenta_banco !== undefined ? limpiarTexto(doc_cuenta_banco) : inversionistaActual.doc_cuenta_banco,
          doc_acta_constitutiva: tipoLimpio === 'Moral' ? (req.body.doc_acta_constitutiva !== undefined ? limpiarTexto(doc_acta_constitutiva) : inversionistaActual.doc_acta_constitutiva) : null,
          doc_poder_legal: tipoLimpio === 'Moral' ? (req.body.doc_poder_legal !== undefined ? limpiarTexto(doc_poder_legal) : inversionistaActual.doc_poder_legal) : null,

          updated_at: trx.fn.now()
        })
        .returning('*');

      inversionistaActualizado = actualizado;

      // 2. ACTUALIZACIÓN EN CASCADA (Tabla Usuarios)
      if (emailCambio) {
        await trx('usuarios')
          .where('inversionista_id', id)
          .update({
            email: emailLimpio,
            updated_at: trx.fn.now()
          });
      }

      // 🚀 3. EL LOG PERFECTO: Guardamos en audit_logs nosotros mismos
      if (cambios.length > 0) {
        const session = req.user || req.usuario || {};
        
        await trx('audit_logs').insert({
          usuario_id: session.id || null,
          usuario_email: session.email || null,
          usuario_rol: session.rol ? String(session.rol).toUpperCase() : 'INVERSIONISTA',
          
          accion: 'UPDATE',
          metodo_http: req.method,
          ruta_api: req.originalUrl,
          tabla_afectada: 'inversionistas',
          registro_id: id,
          
          // 🛡️ Datos precisos (sin clones)
          datos_anteriores: JSON.stringify(inversionistaActual),
          datos_nuevos: JSON.stringify(actualizado),
          // Guardamos también la lista bonita de cambios que hicimos para el correo
          cambios_realizados: JSON.stringify({ detalles: cambios }),
          
          // 🌐 Datos de red
          ip_address: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || req.ip || 'Desconocida',
          user_agent: req.headers['user-agent'] || 'Desconocido',
          resultado: 'success',
          codigo_respuesta: 200,
          created_at: trx.fn.now()
        });
      }
    }); // <-- Fin de la transacción

    // ==========================================
    // 📢 ENVIAR NOTIFICACIÓN DE AUDITORÍA
    // ==========================================
    if (cambios.length > 0) {
      // 1. Averiguamos quién hizo el cambio (El Admin o el mismo Inversionista)
      const actorNombre = req.user?.nombre || req.user?.name || req.user?.email || 'Usuario Desconocido';
      // Si el rol no existe, asumimos que fue el Inversionista editando su propio perfil
      const actorRol = req.user?.rol ? req.user.rol.toUpperCase() : 'INVERSIONISTA';
      
      // 2. Disparamos el correo en "segundo plano" (sin await) para que el frontend no se quede esperando
      emailService.sendAuditNotification({
        actorNombre: `${actorNombre} (Rol: ${actorRol})`,
        usuarioAfectado: {
          nombre: inversionistaActual.nombre,
          email: inversionistaActual.email
        },
        accion: 'Modificación de Perfil de Inversionista',
        // Tu emailService es tan bueno que si le mandamos el array unido por saltos de línea (\n), lo convierte en <li> automáticamente
        detallesCambio: cambios.join('\n'), 
        subtitle: 'Auditoría de Datos Sensibles - AutoManager'
      }).catch(err => console.error('❌ Error enviando auditoría de inversionista:', err));

      
    }

    return res.status(200).json({
      success: true,
      message: '✅ Inversionista y accesos actualizados exitosamente.',
      inversionista: inversionistaActualizado
    });

  } catch (error) {
    console.error('❌ Error al editar inversionista:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno al actualizar en la base de datos.',
      error: error.message 
    });
  }
};

// ========== EDITAR MI PROPIO PERFIL (INVERSIONISTA) ==========
exports.editarMiPerfil = async (req, res) => {
  try {
    const usuarioId = req.user?.id;

    // 1. Buscamos el ID real del inversionista amarrado a esta sesión
    const usuario = await db('usuarios').where('id', usuarioId).first();

    if (!usuario || !usuario.inversionista_id) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permisos o perfil para realizar esta acción.' 
      });
    }

    // 2. 🪄 EL TRUCO DE MAGIA: Inyectamos el ID correcto en req.params
    // Así, la función original creerá que el ID vino por la URL de forma segura
    req.params.id = usuario.inversionista_id;

    // 3. Llamamos a tu función original gigante para que haga todo el trabajo duro
    return await exports.editarInversionista(req, res);

  } catch (error) {
    console.error('❌ Error en el wrapper de editarMiPerfil:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
};

// ========== DASHBOARD DEL INVERSIONISTA (MODELO TRANSACCIONAL) ==========
exports.getDashboardInversionista = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📊 Obteniendo dashboard para inversionista:', id);
    
    // 1. Estadísticas generales (Mezcla de Histórico y Activo)
    const statsResult = await db('contratos_inversion as c')
      .where('c.inversionista_id', id)
      // ❌ QUITAMOS el .andWhere('c.status', 'Activa') para que traiga toda la historia
      .select(
        // 🟡 CONTRATOS ACTIVOS: Solo contamos los que están vigentes hoy
        db.raw(`COUNT(CASE WHEN c.status = 'Activa' THEN c.id END) as contratos_activos`),
        
        // 🔵 CAPITAL INVERTIDO (HISTÓRICO): Sumamos TODOS los contratos de su vida
        db.raw(`COALESCE(SUM(CASE WHEN c.status != 'Eliminado' THEN c.monto_invertido ELSE 0 END), 0) as total_invertido`),
        
        // (Opcional) Rendimiento Total Esperado: Generalmente es histórico
        db.raw(`COALESCE(SUM(c.monto_total_contrato), 0) as rendimiento_total_esperado`),
        
        // 🟢 TOTAL COBRADO (HISTÓRICO): Sumamos TODO el dinero que se le ha transferido en su vida
        db.raw(`COALESCE(SUM(CASE WHEN c.status != 'Eliminado' THEN c.total_pagado ELSE 0 END), 0) as total_cobrado`),
        
        // 🟣 POR COBRAR (VIGENTE): Solo sumamos el saldo de los contratos que siguen activos
        db.raw(`COALESCE(SUM(CASE WHEN c.status = 'Activa' THEN c.saldo_pendiente ELSE 0 END), 0) as total_por_cobrar`)
      )
      .first();

    // Si no hay resultados o contratos, inicializamos en 0
    const stats = statsResult || {
      contratos_activos: 0,
      total_invertido: 0,
      rendimiento_total_esperado: 0,
      total_cobrado: 0,
      total_por_cobrar: 0
    };

    // 2. Cálculos matemáticos simples (Asegurarnos de que sean números válidos)
    const total_invertido = parseFloat(stats.total_invertido);
    const rendimiento_esperado = parseFloat(stats.rendimiento_total_esperado);
    const total_cobrado = parseFloat(stats.total_cobrado);
    const total_por_cobrar = parseFloat(stats.total_por_cobrar);

    // 3. Últimos pagos reales (Modelo Transaccional)
    const ultimosPagos = await db('pagos_inversionistas as p')
      .leftJoin('contratos_inversion as c', 'p.inversion_id', 'c.id')
      .leftJoin('vehiculos as v', 'c.vehiculo_id', 'v.id') 
      .select(
        'p.*',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo'
      )
      .where('c.inversionista_id', id) 
      .orderBy('p.fecha_pago_real', 'desc') 
      .limit(5);
    
    res.json({
      success: true,
      contratos_activos: parseInt(stats.contratos_activos),
      total_invertido: total_invertido,
      rendimiento_total_esperado: rendimiento_esperado,
      total_cobrado: total_cobrado,
      total_por_cobrar: total_por_cobrar,
      pagos_vencidos: 0, 
      proximos_pagos: [], 
      ultimos_pagos: ultimosPagos 
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener dashboard',
      message: error.message
    });
  }
};

// ========== OBTENER OPCIONES PARA FORMULARIOS ==========
exports.getOpcionesInversionistas = async (req, res) => {
  try {
    // Lista simple de inversionistas activos para selects
    const inversionistas = await db(TABLES.INVERSIONISTAS)
      .select('id', 'nombre', 'email', 'tasa_rendimiento')
      .where('status', 'Activo')
      .orderBy('nombre');
    
    res.json({
      success: true,
      inversionistas,
      tasas_rendimiento: [1.0, 1.25, 1.5, 1.56, 1.75, 2.0],
      tipos_inversionista: ['Individual', 'Empresa', 'Sociedad']
    });
  } catch (error) {
    console.error('❌ Error obteniendo opciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener opciones'
    });
  }
};

// ========== 1. LA CALCULADORA MAESTRA (PURA Y MATEMÁTICA) ==========
const calcularInversion = (datos) => {
  let {
    monto_inversion, 
    renta_diaria, // 👈 Ahora lo recibirá directamente del backend (BD)
    modelo = 'SI_LEGADO'
  } = datos;

  console.log(`📊 Calculando matemáticas para el plan: ${modelo} con inversión de $${monto_inversion}`);

  const capital_cliente = parseFloat(monto_inversion || 0);

  // 1. Regla de negocio: Mínimo $20,000
  if (capital_cliente < 20000) {
    throw new Error('El monto mínimo de inversión debe ser de $20,000 pesos.');
  }

  // 2. Variables a calcular
  let meses = 0;
  let pago_mensual = 0;
  let monto_total_contrato = 0;
  let multiplicador = 0;

  // 3. Reglas según el Plan
  switch (modelo.toUpperCase()) {
    case 'SI_LEGADO':
      meses = 62;
      multiplicador = 0; 
      pago_mensual = 8000; 
      monto_total_contrato = pago_mensual * meses; 
      break;
      
    case 'PLUS_60':
      meses = 53; 
      multiplicador = 1.60; 
      monto_total_contrato = capital_cliente * multiplicador; 
      pago_mensual = monto_total_contrato / meses; 
      break;
      
    case 'SMART_40':
      meses = 35; 
      multiplicador = 1.40; 
      monto_total_contrato = capital_cliente * multiplicador; 
      pago_mensual = monto_total_contrato / meses; 
      break;
      
    default:
      throw new Error('Plan de inversión no reconocido. Use SI_LEGADO, PLUS_60 o SMART_40');
  }

  // 4. Cálculos finales del Inversionista
  const ganancia_neta_inversionista = monto_total_contrato - capital_cliente; 

  // 5. 🏢 CÁLCULO DE LA EMPRESA CON LA RENTA REAL
  // Usamos la renta_diaria que viene de la BD. Si por alguna razón no hay, usamos 400 de colchón.
  const rentaReal = parseFloat(renta_diaria || 400); 
  const ingreso_total_empresa = (rentaReal * 26) * meses;
  const utilidad_estimada_empresa = ingreso_total_empresa - monto_total_contrato;

  return {
    monto_invertido: capital_cliente,
    monto_total_contrato: monto_total_contrato,
    pago_mensual: pago_mensual,
    utilidad_estimada_empresa: utilidad_estimada_empresa,
    plazo_meses: meses,
    renta_diaria_utilizada: rentaReal, // 👈 Lo regresamos para que el Frontend sepa qué número usó
    tasa_rendimiento: multiplicador, 
    rendimiento_puro: ganancia_neta_inversionista
  };
};

// ========== CALCULAR INVERSIÓN (ENDPOINT QUE CONSULTA LA BD) ==========
exports.calcularInversion = async (req, res) => {
  try {
    console.log('🧮 Simulando inversión desde el Frontend...');
    
    // 1. Extraemos los datos que manda el Frontend
    const { vehiculo_id, monto_inversion, modelo } = req.body;
    let renta_sugerida_vehiculo = req.body.renta_diaria || 400; // Valor por defecto

    // 2. 🕵️‍♂️ MAGIA: Si nos mandaron un ID de vehículo, vamos a la BD a sacar su renta real
    if (vehiculo_id) {
      // (Asegúrate de que 'db' esté importado en la parte de arriba de tu archivo)
      const vehiculo = await db('vehiculos').where('id', vehiculo_id).first();
      
      if (vehiculo && vehiculo.renta_sugerida) {
        renta_sugerida_vehiculo = parseFloat(vehiculo.renta_sugerida);
        console.log(`🚗 Vehículo encontrado. Usando renta sugerida: $${renta_sugerida_vehiculo}`);
      }
    }

    // 3. Preparamos los datos inyectando la renta real
    const datosParaCalcular = {
      ...req.body,
      renta_diaria: renta_sugerida_vehiculo
    };

    // 4. Pasamos los datos a nuestra función matemática
    const calculos = calcularInversion(datosParaCalcular);
    
    res.json({
      success: true,
      calculos,
      mensaje: 'Cálculo realizado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error calculando inversión:', error);
    res.status(400).json({ 
      success: false,
      error: 'Error al calcular inversión',
      message: error.message
    });
  }
};

exports.crearSolicitudInversion = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    console.log('📝 Creando nueva solicitud en solicitudes_inversion...');
    
    // 1. OBTENER EL ID DEL INVERSIONISTA DESDE LA TABLA DE USUARIOS
    const usuarioId = req.user?.id; // Este es el 135 que vimos en tu log

    if (!usuarioId) {
      throw new Error('No se detectó una sesión de usuario válida.');
    }

    // Buscamos al usuario para sacar su llave foránea
    const usuarioRecord = await trx('usuarios')
      .where('id', usuarioId)
      .select('inversionista_id') // 👈 Aquí está la llave que mencionas
      .first();

    if (!usuarioRecord || !usuarioRecord.inversionista_id) {
      throw new Error('Tu cuenta de usuario no tiene un perfil de inversionista vinculado.');
    }

    const inversionista_id = usuarioRecord.inversionista_id;
    console.log('✅ ID de Inversionista localizado:', inversionista_id);

    // 2. RECIBIMOS LOS DATOS DEL FRONTEND
    const {
      monto_inversion, 
      renta_diaria, // Por si tu calculadora lo necesita internamente
      modelo_negocio,
      fecha_inicio, 
      comprobante_url // Nuevo campo para el comprobante de la solicitud
    } = req.body;

    // 🚨 REGLA DE NEGOCIO: Bloqueamos SI_LEGADO en solicitudes nuevas
    if (modelo_negocio === 'SI_LEGADO') {
      throw new Error('El modelo SI Legado no está disponible para solicitudes en línea.');
    }

    // 3. CORRER LA CALCULADORA MAESTRA
    const calculos = calcularInversion({
      monto_inversion, 
      renta_diaria: renta_diaria || 400, // Valor seguro por defecto si no lo mandan
      modelo: modelo_negocio
    });

    console.log('🧮 Resultados de la calculadora para solicitud:', calculos);

    // 4. PREPARAR LAS FECHAS (Protección contra saltos de zona horaria)
    let fechaInicioDB;
    if (fecha_inicio) {
      const fechaLimpia = fecha_inicio.split('T')[0]; 
      fechaInicioDB = new Date(`${fechaLimpia}T12:00:00`);
    } else {
      fechaInicioDB = new Date();
    }
    
    const fechaFinDB = new Date(fechaInicioDB);
    fechaFinDB.setMonth(fechaFinDB.getMonth() + calculos.plazo_meses);

    // 5. INSERCIÓN EN SOLICITUDES_INVERSION
    const datosSolicitud = {
      inversionista_id: inversionista_id, // 👈 Sacado directo y seguro de la BD
      vehiculo_id: null,                  // 👈 Siempre nulo para solicitudes
      modelo_negocio: modelo_negocio,
      monto_invertido: parseFloat(calculos.monto_invertido.toFixed(2)), 
      tasa_rendimiento: parseFloat(calculos.tasa_rendimiento || 0),
      monto_total_contrato: parseFloat(calculos.monto_total_contrato.toFixed(2)),
      pago_mensual: parseFloat(calculos.pago_mensual.toFixed(2)),
      plazo_meses: calculos.plazo_meses,
      // Ojo: tu tabla lo llama utilidad_estimada_empresarial
      utilidad_estimada_empresa: parseFloat(calculos.utilidad_estimada_empresa?.toFixed(2) || 0), 
      
      // ARRANCA LIMPIO: 0 pagado, todo pendiente
      total_pagado: 0,
      saldo_pendiente: parseFloat(calculos.monto_total_contrato.toFixed(2)),
      porcentaje_pagado: 0,
      
      fecha_inicio: fechaInicioDB,
      fecha_fin_estimada: fechaFinDB,
      
      // LOS NUEVOS CAMPOS
      status: 'Activa',                   // Como lo pediste (aunque la solicitud no esté aprobada aún)
      estado_aceptacion: 'Pendiente',     // Para que el Admin decida qué hacer
      motivo_rechazo: null,               // Arranca limpio
      
      created_at: new Date(),
      updated_at: new Date(),
      comprobante_url: comprobante_url
    };

    const [nuevaSolicitud] = await trx('solicitudes_inversion')
      .insert(datosSolicitud)
      .returning('*');

    // 6. CONFIRMAMOS LA TRANSACCIÓN
    await trx.commit();
    
    res.status(201).json({
      success: true,
      solicitud: nuevaSolicitud,
      mensaje: '✅ Solicitud de inversión enviada exitosamente para su revisión'
    });

  } catch (error) {
    await trx.rollback();
    console.error('❌ Error creando solicitud:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar la solicitud de inversión',
      message: error.message
    });
  }
};

// ========== OBTENER SOLICITUDES DE INVERSIÓN (ADMIN) ==========
exports.getSolicitudesInversion = async (req, res) => {
  try {
    const { estado_aceptacion } = req.query;
    
    let query = db('solicitudes_inversion as si')
      .select(
        'si.*',
        'i.nombre as inversionista_nombre',
        'u.email as inversionista_email'
      )
      .leftJoin('inversionistas as i', 'si.inversionista_id', 'i.id')
      
      // 🚀 AQUÍ ESTÁ LA MAGIA: Corregimos la dirección de la relación. 
      // Unimos el 'id' del inversionista con la columna 'inversionista_id' de los usuarios
      .leftJoin('usuarios as u', 'i.id', 'u.inversionista_id')
      
      .orderBy('si.created_at', 'desc');
    
    if (estado_aceptacion) {
      query = query.where('si.estado_aceptacion', estado_aceptacion);
    }
    
    const solicitudes = await db('solicitudes_inversion as si')
  .select(
    'si.*',
    'i.nombre as inversionista_nombre',
    'u.email as inversionista_email',
    // 🚀 AGREGAMOS ESTOS CAMPOS PARA EL REEMBOLSO
    'i.banco',
    'i.cuenta_bancaria',
    'i.clabe',
    'i.nombre_cuenta_banco'
  )
  .leftJoin('inversionistas as i', 'si.inversionista_id', 'i.id')
  .leftJoin('usuarios as u', 'i.id', 'u.inversionista_id')
  .orderBy('si.created_at', 'desc');
    
    res.json({
      success: true,
      solicitudes
    });
  } catch (error) {
    console.error('❌ Error obteniendo solicitudes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener solicitudes',
      message: error.message
    });
  }
};

// ========== OBTENER MIS SOLICITUDES (INVERSIONISTA) ==========
exports.getMisSolicitudes = async (req, res) => {
  try {
    const usuarioId = req.user?.id;

    // 1. Buscamos el inversionista_id vinculado a la sesión
    const usuario = await db('usuarios')
      .where('id', usuarioId)
      .select('inversionista_id')
      .first();

    if (!usuario || !usuario.inversionista_id) {
      // Si no tiene perfil, simplemente le mandamos un arreglo vacío
      return res.json({ success: true, solicitudes: [] });
    }

    // 2. Traemos solo las solicitudes que le pertenecen a este inversionista
    const solicitudes = await db('solicitudes_inversion')
      .where('inversionista_id', usuario.inversionista_id)
      .orderBy('created_at', 'desc'); // Las más recientes primero

    res.json({
      success: true,
      solicitudes
    });

  } catch (error) {
    console.error('❌ Error obteniendo mis solicitudes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tus solicitudes',
      message: error.message
    });
  }
};

// ========== APROBAR SOLICITUD DE INVERSIÓN (ADMIN) ==========
exports.aprobarSolicitud = async (req, res) => {
  const trx = await db.transaction();

  try {
    const { id } = req.params;

    console.log(`✅ Aprobando solicitud #${id}...`);

    // 1. OBTENER LA SOLICITUD ORIGINAL
    const solicitud = await trx('solicitudes_inversion').where({ id }).first();

    if (!solicitud) {
      throw new Error('La solicitud no existe en la base de datos.');
    }

    if (solicitud.estado_aceptacion !== 'Pendiente') {
      throw new Error(`Esta solicitud ya fue procesada anteriormente (Estado: ${solicitud.estado_aceptacion}).`);
    }

    // 2. RECALCULAR LAS FECHAS (El contrato inicia HOY)
    // Usamos las 12:00 PM para evitar que por zonas horarias se recorra un día atrás
    const fechaActual = new Date();
    const fechaInicioDB = new Date(fechaActual.setHours(12, 0, 0, 0)); 
    
    const fechaFinDB = new Date(fechaInicioDB);
    fechaFinDB.setMonth(fechaFinDB.getMonth() + solicitud.plazo_meses);

    // 3. PREPARAR EL NUEVO CONTRATO
    // Extraemos solo los campos que existen en contratos_inversion
    const nuevoContrato = {
      inversionista_id: solicitud.inversionista_id,
      vehiculo_id: solicitud.vehiculo_id, // Será null, pero conservamos la estructura
      modelo_negocio: solicitud.modelo_negocio,
      monto_invertido: solicitud.monto_invertido,
      tasa_rendimiento: solicitud.tasa_rendimiento,
      plazo_meses: solicitud.plazo_meses,
      monto_total_contrato: solicitud.monto_total_contrato,
      pago_mensual: solicitud.pago_mensual,
      utilidad_estimada_empresa: solicitud.utilidad_estimada_empresa,
      
      // Contadores iniciales
      total_pagado: solicitud.total_pagado,
      saldo_pendiente: solicitud.saldo_pendiente,
      porcentaje_pagado: solicitud.porcentaje_pagado,
      
      // Nuevas fechas
      fecha_inicio: fechaInicioDB,
      fecha_fin_estimada: fechaFinDB,
      
      status: 'Activa', // Status contable del contrato
      created_at: new Date(),
      updated_at: new Date()
    };

    // 4. INSERTAR EL CONTRATO EN LA BASE DE DATOS
    const [contratoInsertado] = await trx('contratos_inversion')
      .insert(nuevoContrato)
      .returning('id');

    // 5. ACTUALIZAR LA SOLICITUD ORIGINAL (Marcada como Aceptada)
    await trx('solicitudes_inversion')
      .where({ id })
      .update({
        estado_aceptacion: 'Aceptada',
        updated_at: new Date()
      });

    // 6. CONFIRMAR LA TRANSACCIÓN
    await trx.commit();

    console.log(`🎉 Contrato #${contratoInsertado.id} creado a partir de la solicitud #${id}`);

    res.json({
      success: true,
      message: 'Solicitud aprobada y contrato activado exitosamente.',
      nuevo_contrato_id: contratoInsertado.id
    });

  } catch (error) {
    // Si algo falla, deshacemos todo para no crear contratos fantasma
    await trx.rollback();
    console.error('❌ Error al aprobar solicitud:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar la aprobación de la solicitud',
      message: error.message
    });
  }
};

exports.aprobarSolicitudInversionista = async (req, res) => {
  const { id } = req.params;
  
  // 🛡️ Iniciamos transacción para que se hagan ambos cambios o ninguno
  const trx = await db.transaction();

  try {
    // 1. Obtener los datos de la solicitud
    const solicitud = await trx('solicitudes_inversionistas')
      .where({ id })
      .first();

    if (!solicitud) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    }

    if (solicitud.estado_aceptacion === 'Aceptada') {
      return res.status(400).json({ success: false, message: 'Esta solicitud ya fue aprobada previamente' });
    }

    // 2. Preparar los datos para la tabla 'inversionistas'
    // Extraemos lo que NO queremos pasar usando rest operator
    const { 
      id: idSolicitud, 
      estado_aceptacion, 
      motivo_rechazo, 
      created_at, 
      updated_at, 
      ...datosInversionista 
    } = solicitud;

    // 3. Crear el registro en la tabla inversionistas
    await trx('inversionistas').insert({
      ...datosInversionista,
      status: 'Activo', // Le asignamos un estado inicial por defecto
    
    });

    // 4. Actualizar el estado de la solicitud original
    await trx('solicitudes_inversionistas')
      .where({ id })
      .update({ 
        estado_aceptacion: 'Aceptada',
        updated_at: new Date()
      });

    // 🏁 Si todo salió bien, guardamos cambios
    await trx.commit();

    res.json({ 
      success: true, 
      message: '¡Inversionista aprobado y dado de alta correctamente!' 
    });

  } catch (error) {
    // ❌ Si algo falla, revertimos todo
    await trx.rollback();
    console.error('❌ Error en aprobarSolicitud:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno al procesar la aprobación' 
    });
  }
};

// ========== RECHAZAR SOLICITUD DE INVERSIÓN (ADMIN) ==========
exports.rechazarSolicitud = async (req, res) => {
  try {
    const { id } = req.params;
    // 🚀 NUEVO: Extraemos el comprobante de devolución
    const { motivo_rechazo, comprobante_devolucion_url } = req.body;

    console.log(`❌ Rechazando solicitud #${id}...`);

    // 1. VALIDACIONES ESTRICTAS
    if (!motivo_rechazo || motivo_rechazo.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El motivo de rechazo es obligatorio para notificar al inversionista.'
      });
    }

    // 🚀 NUEVO: Validamos que sí envíen el comprobante de que le regresaron su dinero
    if (!comprobante_devolucion_url || comprobante_devolucion_url.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Debes adjuntar el comprobante de devolución del dinero para poder rechazar la solicitud.'
      });
    }

    // 2. BUSCAR LA SOLICITUD
    const solicitud = await db('solicitudes_inversion').where({ id }).first();

    if (!solicitud) {
      return res.status(404).json({
        success: false,
        message: 'La solicitud no existe en la base de datos.'
      });
    }

    if (solicitud.estado_aceptacion !== 'Pendiente') {
      return res.status(400).json({
        success: false,
        message: `Esta solicitud ya fue procesada anteriormente (Estado: ${solicitud.estado_aceptacion}).`
      });
    }

    // 3. ACTUALIZAR A RECHAZADA CON SU MOTIVO Y COMPROBANTE
    await db('solicitudes_inversion')
      .where({ id })
      .update({
        estado_aceptacion: 'Rechazada',
        motivo_rechazo: motivo_rechazo.trim(),
        comprobante_devolucion_url: comprobante_devolucion_url.trim(), // 👈 Lo guardamos en la BD
        updated_at: new Date()
      });

    res.json({
      success: true,
      message: 'Solicitud rechazada correctamente y comprobante de devolución guardado.'
    });

  } catch (error) {
    console.error('❌ Error al rechazar solicitud:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar el rechazo de la solicitud',
      message: error.message
    });
  }
};

// ========== RECHAZAR SOLICITUD DE INVERSIÓN (ADMIN) CON MOTIVO PARA EL INVERSIONISTA ==========
exports.rechazarSolicitudInversionista = async (req, res) => {
  const { id } = req.params;
  const { motivo_rechazo } = req.body; // Esto nos lo mandará React

  if (!motivo_rechazo) {
    return res.status(400).json({ success: false, message: 'El motivo de rechazo es obligatorio.' });
  }

  try {
    // 1. Verificamos que la solicitud exista y esté pendiente
    const solicitud = await db('solicitudes_inversionistas').where({ id }).first();

    if (!solicitud) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    }

    if (solicitud.estado_aceptacion !== 'Pendiente') {
      return res.status(400).json({ success: false, message: 'Esta solicitud ya fue procesada previamente' });
    }

    // 2. Actualizamos el estado y guardamos el motivo
    await db('solicitudes_inversionistas')
      .where({ id })
      .update({
        estado_aceptacion: 'Rechazada',
        motivo_rechazo: motivo_rechazo,
        updated_at: new Date()
      });

    res.json({ 
      success: true, 
      message: 'La solicitud ha sido rechazada correctamente.' 
    });

  } catch (error) {
    console.error('❌ Error en rechazarSolicitudInversionista:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno al procesar el rechazo' 
    });
  }
};
// ========== GESTIÓN DE CONTRATOS ==========

/**
 * Crear un nuevo contrato de inversión
 */
exports.crearContrato = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const {
      inversionista_id,
      vehiculo_id,
      tipo_inversion,
      modelo_negocio,
      monto_inversion,
      fecha_inicio,
      notas
    } = req.body;

    console.log('📝 Creando contrato:', {
      inversionista_id,
      vehiculo_id,
      tipo_inversion,
      modelo_negocio,
      monto_inversion
    });

    // Validaciones
    if (!inversionista_id || !monto_inversion || !modelo_negocio) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Faltan datos requeridos: inversionista_id, monto_inversion y modelo_negocio'
      });
    }

    // Verificar que el inversionista existe
    const inversionista = await trx('inversionistas')
      .where('id', inversionista_id)
      .first();

    if (!inversionista) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Inversionista no encontrado'
      });
    }

    // Configuración de planes
    const planesConfig = {
      'SI_LEGADO': {
        plazo: 62
        // 🗑️ Quitamos la tasa_mensual porque ahora será un monto fijo
      },
      'PLUS_60': {
        plazo: 53,
        multiplicador: 1.60
      },
      'SMART_40': {
        plazo: 35,
        multiplicador: 1.40
      }
    };

    const planConfig = planesConfig[modelo_negocio];
    
    if (!planConfig) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Plan de inversión no válido. Use: SI_LEGADO, PLUS_60 o SMART_40'
      });
    }

    // Calcular métricas financieras
    let pagoMensual = 0;
    let totalRecibir = 0;

    if (modelo_negocio === 'SI_LEGADO') {
      //  REGLA DEL CLIENTE: Siempre 8,000 fijos sin importar el monto
      pagoMensual = 8000;
      totalRecibir = pagoMensual * planConfig.plazo; // Ej. 8,000 * 62 = 496,000
    } else {
      // Los otros planes siguen calculándose basados en el multiplicador
      totalRecibir = monto_inversion * planConfig.multiplicador;
      pagoMensual = totalRecibir / planConfig.plazo;
    }

    console.log('💰 Cálculos financieros:', {
      pagoMensual,
      totalRecibir,
      plazo: planConfig.plazo
    });

    // Obtener número de serie del vehículo si aplica
    let numeroSerieVehiculo = null;
    if (tipo_inversion === 'vehiculo_especifico' && vehiculo_id) {
const vehiculo = await trx('vehiculos')
  .where('numero_de_serie_vehiculo', vehiculo_id)
  .first();
      
      if (!vehiculo) {
        await trx.rollback();
        return res.status(404).json({
          success: false,
          message: 'Vehículo no encontrado'
        });
      }
      
      numeroSerieVehiculo = vehiculo.numero_de_serie_vehiculo;
      console.log('🚗 Vehículo seleccionado:', numeroSerieVehiculo);

   } else {
  // Para pool general, dejar NULL
  numeroSerieVehiculo = null;
  console.log('📦 Pool general: NULL (sin vehículo específico)');
}

    // Crear el contrato en la tabla inversiones_vehiculos
    const [nuevoContrato] = await trx('inversiones_vehiculos')
  .insert({
    numero_de_serie_vehiculo: numeroSerieVehiculo,
    inversionista_id: inversionista_id,
    inversion: parseFloat(monto_inversion),
    modelo_negocio: modelo_negocio,
    pago_mensual_inversionista: parseFloat(pagoMensual.toFixed(2)),
    utilidad_inversionista: parseFloat(totalRecibir.toFixed(2)),
    plazo_para_inversionistas: planConfig.plazo,
    fecha_de_inicio: fecha_inicio || new Date(),
    fecha_inicio_inversion: fecha_inicio || new Date(),
    status_inversion: 'Activa',
    tasa_rendimiento: inversionista.tasa_rendimiento || 1.56,
    valor_factura: req.body.valor_factura ? parseFloat(req.body.valor_factura) : null // ✅ AGREGAR
  })
  .returning('*');

    console.log('✅ Contrato creado:', nuevoContrato.id_inversion);

    // Generar calendario de pagos
    const calendarioPagos = [];
    const fechaInicio = new Date(fecha_inicio || new Date());

    for (let mes = 1; mes <= planConfig.plazo; mes++) {
      const fechaPago = new Date(fechaInicio);
      fechaPago.setMonth(fechaPago.getMonth() + mes);

      calendarioPagos.push({
        inversion_id: nuevoContrato.id_inversion,
        inversionista_id: inversionista_id,
        mes_pago: mes,
        fecha_programada: fechaPago,
        monto_programado: parseFloat(pagoMensual.toFixed(2)),
        status: 'Pendiente'
      });
    }

    // Insertar calendario de pagos
    await trx('pagos_inversionistas').insert(calendarioPagos);
    console.log(`📅 Calendario de ${calendarioPagos.length} pagos creado`);

    // Actualizar monto_total_invertido del inversionista
    await trx('inversionistas')
      .where('id', inversionista_id)
      .increment('monto_total_invertido', parseFloat(monto_inversion));

    console.log('💼 Monto total invertido actualizado');

    await trx.commit();

    res.status(201).json({
      success: true,
      message: 'Contrato creado exitosamente',
      contrato: {
        id: nuevoContrato.id_inversion,
        inversionista_id: nuevoContrato.inversionista_id,
        monto: nuevoContrato.inversion,
        pago_mensual: nuevoContrato.pago_mensual_inversionista,
        plazo: nuevoContrato.plazo_para_inversionistas,
        total_a_recibir: nuevoContrato.utilidad_inversionista,
        modelo_negocio: nuevoContrato.modelo_negocio,
        status: nuevoContrato.status_inversion
      }
    });

  } catch (error) {
    await trx.rollback();
    console.error('❌ Error creando contrato:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el contrato',
      error: error.message
    });
  }
};

/**
 * Obtener vehículos disponibles para inversión
 */
exports.getVehiculosDisponibles = async (req, res) => {
  try {
    const vehiculos = await db('vehiculos')
      // 🚀 REGLA DE DISPONIBILIDAD TOTAL
      .whereNotExists(function() {
        this.select('id')
            .from('contratos_inversion')
            .where(function() {
              // 1. Bloqueamos si el contrato está Activo o Pausado
              this.whereIn('status', ['Activa', 'Pausado'])
              // 2. O si está Rescindido pero aún tiene deuda (saldo > 0)
              .orWhere(function() {
                this.where('status', 'Rescindido')
                    .andWhere('saldo_pendiente', '>', 0);
              });
            })
            // Cruce de IDs
            .whereRaw('contratos_inversion.vehiculo_id = vehiculos.id');
      })
      // ... El resto de tus filtros (VIP para 'SI' y Disponibles para 'AutoManager')
      .andWhere(function() {
        this.where(function() {
          this.whereRaw('UPPER(tipo_socio) = ?', ['SI'])
              .orWhereRaw('UPPER(numero_vehiculo) LIKE ?', ['SI%']);
        })
        .orWhere(function() {
          this.whereIn('estado', ['Disponible', 'Mantenimiento'])
              .andWhere(function() {
                this.where('propietario_tipo', 'AutoManager')
                    .orWhereNull('propietario_tipo');
              });
        });
      })
      .select('id', 'numero_vehiculo', 'marca', 'modelo', 'año_del_vehiculo as ano', 'estado', 'precio_compra', 'tipo_socio')
      .andWhere('estado', '!=', 'Baja') 
      .orderBy('numero_vehiculo', 'asc');

    res.json({ success: true, vehiculos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ========== VER DETALLE DE CONTRATO (MODELO TRANSACCIONAL) ==========
exports.getContratoDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📄 Obteniendo detalle de contrato transaccional:', id);
    
    // 1. Obtener datos del contrato con JOIN apuntando a tu NUEVA tabla
    const contrato = await db('contratos_inversion as c')
      .leftJoin('inversionistas as i', 'c.inversionista_id', 'i.id')
      .leftJoin('vehiculos as v', 'c.vehiculo_id', 'v.id')
      .select(
        'c.*', // Trae toda la info fresca (monto_invertido, porcentaje_pagado, etc.)
        
        // 🪄 ALIAS DE RETROCOMPATIBILIDAD: Para que el Frontend viejo no truene
        'c.id as id_inversion',
        'c.monto_invertido as monto_inversion',
        'c.monto_total_contrato as monto_total_pagar',
        'c.status as status_inversion',
        'c.pago_mensual as pago_mensual_inversionista',
        'c.fecha_inicio as fecha_de_inicio',
        'c.motivo_rescision as motivo_rescision_contrato',
        db.raw(`'INV-' || LPAD(c.id::text, 4, '0') as folio_contrato`),
        
        
        // Datos del inversionista
        'i.nombre as inversionista_nombre',
        'i.email as inversionista_email',
        'i.telefono as inversionista_telefono',
        
        // Datos del vehículo
        'v.numero_vehiculo as numero_vehiculo',
        'v.marca',
        'v.modelo as modelo_vehiculo',
        'v.placa',
        'v.año_del_vehiculo as ano_vehiculo' // Ojo: Si en tu BD le quitaste la "ñ", cambialo a v.anio_vehiculo
      )
      .where('c.id', id)
      .first();
    
    if (!contrato) {
      return res.status(404).json({
        success: false,
        message: 'Contrato no encontrado'
      });
    }
    
    // 2. Obtener el historial de pagos REALES
    // Como es transaccional, todos los que están aquí ya fueron pagados
    const pagos = await db('pagos_inversionistas')
      .where('inversion_id', id)
      .orderBy('fecha_pago_real', 'desc'); // Los ordenamos DESC para que el más reciente salga primero
    
    // 3. 🧮 CALCULAR ESTADÍSTICAS TRANSACCIONALES
    // Ya no buscamos "status", usamos los datos duros del contrato y la longitud del array
    const cuotasPagadas = pagos.length;
    const cuotasPendientes = Math.max(0, contrato.plazo_meses - cuotasPagadas);

    const stats = {
      plazo_total_meses: contrato.plazo_meses,
      cuotas_pagadas: cuotasPagadas,
      cuotas_pendientes: cuotasPendientes,
      // Los montos los tomamos directo de lo que ya calcula nuestra nueva función de pago
      monto_total_pagado: parseFloat(contrato.total_pagado || 0),
      monto_total_pendiente: parseFloat(contrato.saldo_pendiente || 0),
      progreso_porcentaje: parseFloat(contrato.porcentaje_pagado || 0)
    };
    
    res.json({
      success: true,
      contrato,
      pagos,
      stats
    });

  } catch (error) {
    console.error('❌ Error obteniendo contrato:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener contrato',
      message: error.message
    });
  }
};

// ========== OBTENER HISTORIAL DE PAGOS (INVERSIONISTA) ==========
exports.getHistorialPagos = async (req, res) => {
  try {
    const usuarioId = req.user?.id; // ID del token

    // 1. Buscamos el inversionista_id vinculado al usuario
    const usuario = await db('usuarios')
      .where('id', usuarioId)
      .select('inversionista_id')
      .first();

    if (!usuario || !usuario.inversionista_id) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró un perfil de inversionista vinculado.'
      });
    }

    // 2. Traemos los pagos cruzando con la tabla de contratos
    const pagos = await db('pagos_inversionistas as p')
      .select(
        'p.id',
        'p.numero_cuota',
        'p.monto_total',
        'p.fecha_pago_real',
        'p.comprobante_url',
        'p.status',
        'c.modelo_negocio'
      )
      .join('contratos_inversion as c', 'p.inversion_id', 'c.id')
      .where('c.inversionista_id', usuario.inversionista_id)
      .where('p.status', 'Completado') 
      // 🚀 FILTRO AÑADIDO: Solo contratos que NO tengan estatus "Eliminado"
      .whereNot('c.status', 'Eliminado') 
      .orderBy('p.fecha_pago_real', 'desc');

    res.json({
      success: true,
      pagos
    });

  } catch (error) {
    console.error('❌ Error obteniendo historial de pagos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el historial de pagos',
      message: error.message
    });
  }
};

// ========== REGISTRAR/MARCAR PAGO COMO PAGADO ==========
exports.marcarPagoPagado = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params; // ID del pago
    const usuario_id = req.user?.id || 1;
    
    console.log('💰 Marcando pago como pagado - ID:', id);
    
    // Verificar que el pago existe
    const pago = await trx('pagos_inversionistas')
      .where('id', id)
      .first();
    
    console.log('📋 Pago encontrado:', pago);
    
    if (!pago) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pago no encontrado'
      });
    }
    
    // Verificar que no esté ya pagado
    if (pago.status === 'Pagado') {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Este pago ya fue marcado como pagado'
      });
    }
    
    console.log('💵 Actualizando pago con monto:', pago.monto_programado);
    
    // Actualizar el pago
    await trx('pagos_inversionistas')
      .where('id', id)
      .update({
        status: 'Pagado',
        monto_pagado: pago.monto_programado,
        fecha_pago_real: trx.fn.now()
      });
    
    // ✅ COMMIT - MUY IMPORTANTE
    await trx.commit();
    
    console.log('✅ Pago actualizado y commit realizado');
    
    // Obtener el pago actualizado DESPUÉS del commit
    const pagoActualizado = await db('pagos_inversionistas')
      .where('id', id)
      .first();
    
    console.log('📊 Pago después del commit:', pagoActualizado);
    
    res.json({
      success: true,
      message: 'Pago registrado exitosamente',
      pago: pagoActualizado
    });
    
  } catch (error) {
    await trx.rollback();
    console.error('❌ Error marcando pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar el pago',
      message: error.message
    });
  }
};
// ========== HUB DE INVERSIONES - LISTA DE CONTRATOS ==========
exports.getHubInversiones = async (req, res) => {
  try {
    const { plan, status, inversionista_id } = req.query;
    
    console.log('🏢 Obteniendo hub de inversiones (Súper Optimizado y Mapeado)');
    
    // 1. QUERY DE LA LISTA DE CONTRATOS
    let query = db('contratos_inversion as c')
      .leftJoin('inversionistas as i', 'c.inversionista_id', 'i.id')
      .leftJoin('vehiculos as v', 'c.vehiculo_id', 'v.id')
      .select(
        // Datos principales del contrato
        'c.id',
        'c.inversionista_id',
        'c.vehiculo_id',
        'c.modelo_negocio',
        'c.pago_mensual',
        'c.total_pagado',
        'c.porcentaje_pagado',
        'c.monto_invertido',
        'c.saldo_pendiente',
        'c.status', // 👈 Nombre real en tu BD
        'c.fecha_inicio',
        'c.monto_total_contrato',
        'c.plazo_meses',
        'c.motivo_rescision',
        'c.monto_liquidacion_final',
        'c.fecha_rescision',
        'c.notas_rescision',
        
        // 🪄 TRUCOS DE ALIAS: Engañamos al Front para que no tengas que cambiar tu React
        db.raw(`'INV-' || LPAD(c.id::text, 4, '0') as folio_contrato`), // Genera ej: INV-0015
        'c.monto_invertido as monto_inversion', 
        'c.monto_total_contrato as monto_total_pagar',
        
        // Datos del inversionista
        'i.nombre as inversionista_nombre',
        'i.email as inversionista_email',
        'i.telefono as inversionista_telefono',
        'i.banco',
        'i.cuenta_bancaria',
        'i.clabe',
        'i.nombre_cuenta_banco',
        
        // Datos del vehículo
        'v.numero_vehiculo as numero_vehiculo', 
        'v.marca',
        'v.modelo as modelo_vehiculo',
        'v.placa',
        
        db.raw(`(
          SELECT COUNT(*) 
          FROM pagos_inversionistas p 
          WHERE p.inversion_id = c.id 
          AND p.status = 'Completado'
        ) as pagos_realizados`),

        // 🚨 LÓGICA TRANSACCIONAL: Pendientes = Plazo Total - Realizados
        db.raw(`(
          c.plazo_meses - (
            SELECT COUNT(*) 
            FROM pagos_inversionistas p 
            WHERE p.inversion_id = c.id 
            AND p.status = 'Completado'
          )
        ) as pagos_pendientes`)
      );
    
    // Filtros opcionales (Usando c.status que es tu nombre real)
    if (plan) query = query.where('c.modelo_negocio', plan);
    if (status) query = query.where('c.status', status); 
    if (inversionista_id) query = query.where('c.inversionista_id', inversionista_id);
    
    const contratos = await query.orderBy('c.fecha_inicio', 'desc');
    
    // 2. ESTADÍSTICAS GENERALES (Filtradas para mostrar solo lo 'Activa')
    let statsQuery = db('contratos_inversion');
    
    // Mantenemos los filtros de búsqueda (si el admin busca a un inversionista X, las stats serán de ese X)
    if (plan) statsQuery = statsQuery.where('modelo_negocio', plan);
    if (inversionista_id) statsQuery = statsQuery.where('inversionista_id', inversionista_id);
    // Nota: El filtro de 'status' lo manejamos dentro del CASE WHEN para las stats globales del Hub

    const statsData = await statsQuery
      .select(
        // 🔒 Solo contamos contratos con estatus 'Activa'
        db.raw(`COUNT(CASE WHEN status = 'Activa' THEN 1 END) as total_contratos`),
        
        // 🔒 Solo sumamos capital de contratos 'Activa'
        db.raw(`SUM(CASE WHEN status = 'Activa' THEN monto_invertido ELSE 0 END) as capital_total`),
        
        // 🔒 Solo sumamos rendimiento (Ganancia) de contratos 'Activa'
        db.raw(`SUM(CASE WHEN status = 'Activa' THEN (monto_total_contrato - monto_invertido) ELSE 0 END) as rendimiento_total`), 
        
        db.raw(`COUNT(CASE WHEN status = 'Activa' THEN 1 END) as contratos_activos`),
        
        // 🔒 Desglose por plan solo de los activos
        db.raw(`COUNT(CASE WHEN status = 'Activa' AND modelo_negocio = 'SI_LEGADO' THEN 1 END) as contratos_si_legado`),
        db.raw(`COUNT(CASE WHEN status = 'Activa' AND modelo_negocio = 'PLUS_60' THEN 1 END) as contratos_plus_60`),
        db.raw(`COUNT(CASE WHEN status = 'Activa' AND modelo_negocio = 'SMART_40' THEN 1 END) as contratos_smart_40`)
      )
      .first();
    
    // 3. RESPUESTA AL FRONTEND
    res.json({
      success: true,
      contratos,
      stats: {
        total_contratos: parseInt(statsData?.total_contratos || 0),
        capital_total: parseFloat(statsData?.capital_total || 0),
        rendimiento_total: parseFloat(statsData?.rendimiento_total || 0),
        contratos_activos: parseInt(statsData?.contratos_activos || 0),
        contratos_si_legado: parseInt(statsData?.contratos_si_legado || 0),
        contratos_plus_60: parseInt(statsData?.contratos_plus_60 || 0),
        contratos_smart_40: parseInt(statsData?.contratos_smart_40 || 0),
  
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo hub de inversiones:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener contratos',
      message: error.message
    });
  }
};

// ========== VINCULAR INVERSIONISTA A INVERSIÓN EXISTENTE ==========
exports.vincularInversionista = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params; // ID de la inversión (id_inversion)
    const { inversionista_id } = req.body;
    const usuario_id = req.user?.id || 1;

    console.log('🔗 Vinculando inversionista a inversión:', id);

    // Verificar que la inversión existe
    const inversion = await trx('inversiones_vehiculos')
      .where('id_inversion', id)
      .first();

    if (!inversion) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Inversión no encontrada'
      });
    }

    // Verificar que no tenga ya un inversionista
    if (inversion.inversionista_id) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Esta inversión ya tiene un inversionista asignado'
      });
    }

    // Verificar que el inversionista existe
    const inversionista = await trx('inversionistas')
      .where('id', inversionista_id)
      .first();

    if (!inversionista) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Inversionista no encontrado'
      });
    }

    console.log('💼 Inversionista:', inversionista.nombre);
    console.log('💰 Inversión:', inversion.inversion);

    // Actualizar la inversión con el inversionista
    await trx('inversiones_vehiculos')
      .where('id_inversion', id)
      .update({
        inversionista_id: inversionista_id
      });

    // Actualizar monto_total_invertido del inversionista
    await trx('inversionistas')
      .where('id', inversionista_id)
      .increment('monto_total_invertido', parseFloat(inversion.inversion || 0));

    // Generar calendario de pagos si no existe
    const pagosExistentes = await trx('pagos_inversionistas')
      .where('inversion_id', id)
      .count('* as total');

    if (parseInt(pagosExistentes[0].total) === 0) {
      console.log('📅 Generando calendario de pagos...');

      const plazo = inversion.plazo_para_inversionistas || 62;
      const pagoMensual = parseFloat(inversion.pago_mensual_inversionista || 0);
      const fechaInicio = new Date(inversion.fecha_de_inicio || inversion.fecha_inicio_inversion || new Date());

      const calendarioPagos = [];
      for (let mes = 1; mes <= plazo; mes++) {
        const fechaPago = new Date(fechaInicio);
        fechaPago.setMonth(fechaPago.getMonth() + mes);

        calendarioPagos.push({
          inversion_id: id,
          inversionista_id: inversionista_id,
          mes_pago: mes,
          fecha_programada: fechaPago,
          monto_programado: pagoMensual,
          status: 'Pendiente'
        });
      }

      await trx('pagos_inversionistas').insert(calendarioPagos);
      console.log(`✅ ${calendarioPagos.length} pagos programados creados`);
    }

    await trx.commit();

    console.log('✅ Inversionista vinculado exitosamente');

    res.json({
      success: true,
      message: 'Inversionista vinculado exitosamente',
      inversion: {
        id: id,
        inversionista_id: inversionista_id,
        inversionista_nombre: inversionista.nombre
      }
    });

  } catch (error) {
    await trx.rollback();
    console.error('❌ Error vinculando inversionista:', error);
    res.status(500).json({
      success: false,
      error: 'Error al vincular inversionista',
      message: error.message
    });
  }
};


  exports.crearAccesoInversionista = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Buscamos al inversionista en su tabla
    const inversionista = await db('inversionistas').where('id', id).first();

    if (!inversionista) {
      return res.status(404).json({ success: false, message: 'Inversionista no encontrado.' });
    }

    if (!inversionista.email) {
      return res.status(400).json({ success: false, message: 'El inversionista no tiene un correo electrónico registrado. Actualiza su perfil primero.' });
    }

    // 2. Verificamos que no tenga ya una cuenta creada (para no duplicar)
    const usuarioExistente = await db('usuarios').where('email', inversionista.email).first();
    
    if (usuarioExistente) {
      return res.status(400).json({ success: false, message: 'Ya existe un usuario de acceso con este correo electrónico.' });
    }

    // 3. Generamos una contraseña temporal segura y fácil de leer (Ejemplo: Inv-8f3a9b)
    const passwordTemporal = 'Inv-' + crypto.randomBytes(3).toString('hex');

    // 4. Encriptamos la contraseña con bcrypt (Nivel de seguridad: 10 salt rounds)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordTemporal, salt);

    // 5. Guardamos al nuevo usuario en la tabla de `usuarios`
    const nuevoUsuario = {
      // Usamos 'nombre' que es como se llama en tu tabla de inversionistas
      name: inversionista.nombre, 
      nombre_completo: inversionista.nombre, 
      email: inversionista.email,
      password: hashedPassword,
      rol: 'inversionista',
      inversionista_id: id,
      estado: 'Activo',
      estado_cuenta: 'Activo',
      fecha_registro: new Date(), // 👈 Agregado para que coincida con la creación
      created_at: new Date(),
      updated_at: new Date()
    };

    // Insertamos usando Knex
    await db('usuarios').insert(nuevoUsuario);

    // 6. Respondemos al Frontend con la contraseña en TEXTO PLANO para que el admin la copie
    res.status(201).json({
      success: true,
      message: 'Cuenta de acceso creada correctamente.',
      email: inversionista.email,
      password_temporal: passwordTemporal
    });

  } catch (error) {
    console.error('❌ Error al crear acceso de inversionista:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al crear el acceso.' });
  }
};

// ========== OBTENER DATOS BANCARIOS DE LA EMPRESA ==========
exports.getDatosBancarios = async (req, res) => {
  try {
    // Buscamos la cuenta que esté marcada como activa
    const cuentaEmpresa = await db('datos_bancarios_empresa')
      .where('activo', true)
      .first();

    if (!cuentaEmpresa) {
      return res.status(404).json({
        success: false,
        message: 'No hay datos bancarios configurados actualmente.'
      });
    }

    res.json({
      success: true,
      datos: cuentaEmpresa
    });

  } catch (error) {
    console.error('❌ Error obteniendo datos bancarios de la empresa:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
};

// ========== ACTUALIZAR DATOS BANCARIOS DE LA EMPRESA (ADMIN) ==========
exports.updateDatosBancarios = async (req, res) => {
  const { id } = req.params; // Recibimos el ID de la configuración
  const { banco, titular, cuenta, clabe, instrucciones } = req.body;

  try {
    // 1. Verificamos que el registro exista
    const existe = await db('datos_bancarios_empresa').where({ id }).first();

    if (!existe) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró el registro de configuración bancaria.'
      });
    }

    // 2. Realizamos la actualización
    await db('datos_bancarios_empresa')
      .where({ id })
      .update({
        banco: banco?.trim(),
        titular: titular?.trim(),
        cuenta: cuenta?.trim(),
        clabe: clabe?.trim(),
        instrucciones: instrucciones?.trim(),
        updated_at: new Date()
      });

    res.json({
      success: true,
      message: '✅ Datos bancarios actualizados correctamente.'
    });

  } catch (error) {
    console.error('❌ Error actualizando datos bancarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al intentar actualizar los datos.',
      error: error.message
    });
  }
};
 // ========== PERFIL DEL INVERSIONISTA ==========

 // ========== OBTENER MI PERFIL (VISTA INVERSIONISTA) ==========
exports.getMiPerfil = async (req, res) => {
  try {
    const usuarioId = req.user?.id;

    // 1. Buscamos el inversionista_id vinculado a la sesión actual
    const usuario = await db('usuarios')
      .where('id', usuarioId)
      .select('inversionista_id')
      .first();

    if (!usuario || !usuario.inversionista_id) {
      return res.status(404).json({ 
        success: false, 
        message: 'No tienes un perfil de inversionista asignado.' 
      });
    }

    // 2. Traemos todos los datos del inversionista
    const inversionista = await db('inversionistas')
      .where('id', usuario.inversionista_id)
      .first();

    if (!inversionista) {
      return res.status(404).json({ 
        success: false, 
        message: 'Datos del inversionista no encontrados en la base de datos.' 
      });
    }

    res.json({
      success: true,
      inversionista
    });

  } catch (error) {
    console.error('❌ Error obteniendo el perfil del inversionista:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al obtener tu perfil.',
      error: error.message
    });
  }
};

// ==========================================
// OBTENER HISTORIAL DE CAMBIOS DEL PERFIL (INVERSIONISTA)
// ==========================================
exports.getMisAuditoriasPerfil = async (req, res) => {
  try {
    const session = req.user || req.usuario;
    const usuarioId = session?.id;

    // 1. Buscamos el ID real del inversionista amarrado a esta sesión
    const usuario = await db('usuarios').where('id', usuarioId).first();

    if (!usuario || !usuario.inversionista_id) {
      return res.status(403).json({ success: false, message: 'No tienes perfil de inversionista.' });
    }

    // 2. Traemos solo SUS registros de la tabla de auditoría
    const logs = await db('audit_logs')
      .where('tabla_afectada', 'inversionistas')
      .where('registro_id', usuario.inversionista_id)
      .where('accion', 'UPDATE') // Solo nos interesan las modificaciones
      .orderBy('created_at', 'desc')
      .select('id', 'usuario_rol', 'created_at', 'cambios_realizados');

    return res.status(200).json({ success: true, logs });

  } catch (error) {
    console.error('❌ Error obteniendo auditorías del perfil:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
};