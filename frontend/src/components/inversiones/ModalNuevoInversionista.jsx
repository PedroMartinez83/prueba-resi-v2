import React, { useState, useEffect } from 'react';
import { X, User, Briefcase, ChevronRight, ChevronLeft, CheckCircle2, Loader2, FileText, Landmark } from 'lucide-react';
import adminService from '../../services/adminService'; 

const ESTADOS_MEXICO = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
  'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México',
  'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit',
  'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
  'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'
];

// ==========================================
// CATÁLOGO DE BANCOS Y FINTECHS EN MÉXICO
// ==========================================
const BANCOS_MEXICO = [
  "BBVA",
  "Santander",
  "Banorte",
  "Citibanamex",
  "HSBC",
  "Scotiabank",
  "Banco Azteca",
  "BanCoppel",
  "Inbursa",
  "BanBajío",
  "Banregio",
  "Afirme",
  "Invex",
  "Mifel",
  "Banjército",
  "Openbank",
  // Neobancos y Fintechs Populares
  "Nu México",
  "Mercado Pago",
  "Hey Banco",
  "Klar",
  "Spin by Oxxo",
  "Ualá",
  "Stori",
  "Fondeadora",
  "Albo",
  "Celo",
  "STP",
  // Opción comodín
  "Otro"
].sort(); // El .sort() los acomodará en orden alfabético automáticamente

const ModalNuevoInversionista = ({ isOpen, onClose, onSave, inversionistaAEditar = null, onCheckDuplicado }) => {
  // ==========================================
  // 1. ZONA DE ESTADOS (Todos hasta arriba)
  // ==========================================
  const [paso, setPaso] = useState(1);
    const [formData, setFormData] = useState({
    nombre: '', email: '', telefono: '', whatsapp: '',
    direccion: '', rfc: '', banco: '', cuenta_bancaria: '', clabe: '',
    // Nuevos campos:
    tipo_inversionista: 'Física', 
    curp: '', 
    estado_civil: '',
    nombre_cuenta_banco: ''
  });
  const [uploadingDocs, setUploadingDocs] = useState({});
  const [errores, setErrores] = useState({});
  const [validando, setValidando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState('');
  
  // Estado para las partes individuales de la dirección
  const [direccionParts, setDireccionParts] = useState({
    calle: '', numExt: '', numInt: '', cp: '', colonia: '', estado: '', ciudad: ''
  });


  // ==========================================
  // 2. ZONA DE FUNCIONES
  // ==========================================
const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // 1. Bloqueo de caracteres no numéricos para teléfonos y cuentas
    if (['telefono', 'whatsapp', 'cuenta_bancaria', 'clabe'].includes(name)) {
      if (value !== '' && !/^\d+$/.test(value)) return; 
    }

    // 2. Quitamos espacios extraños al inicio (pero dejamos que escriba espacios entre palabras)
    let finalValue = value.replace(/^\s+/, '');

    // 3. FORMATEO ESTÁNDAR SEGÚN EL CAMPO
    if (name === 'rfc') {
      // Identificadores -> TODO MAYÚSCULAS
      finalValue = finalValue.toUpperCase();
      
    } else if (name === 'email') {
      // Correos -> todo minúsculas y sin espacios
      finalValue = finalValue.toLowerCase().trim();
      
    } else if (['nombre', 'banco', 'calle', 'colonia', 'ciudad'].includes(name)) {
      // Textos Propios -> Capitalizar cada palabra (Title Case)
      // Ej: "juan perez" -> "Juan Perez"
      finalValue = finalValue.replace(/(?:^|\s)\S/g, (letra) => letra.toUpperCase());
    }

    // 4. Guardamos en el estado general
    setFormData(prev => ({ ...prev, [name]: finalValue }));
    
    // Limpiar errores visuales
    if (errores[name]) setErrores(prev => ({ ...prev, [name]: null }));
    if (errorGlobal) setErrorGlobal(''); 
  };

const handleDireccionChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value.replace(/^\s+/, '');

    finalValue = finalValue.replace(/,/g, '');

    // Capitalizar textos de la dirección (excepto CP)
    if (['calle', 'colonia', 'ciudad'].includes(name)) {
      finalValue = finalValue.replace(/(?:^|\s)\S/g, (letra) => letra.toUpperCase());
    }

    setDireccionParts(prev => ({ ...prev, [name]: finalValue }));
  };

  const validarRFC = (rfc) => {
    const rfcRegex = /^([A-ZÑ&]{3,4}) ?(?:- ?)?(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])) ?(?:- ?)?([A-Z\d]{2})([A\d])$/i;
    return rfcRegex.test(rfc);
  };

  const checarDuplicado = async (campo, valor) => {
    if (!valor) return false;
    try {
      // Si nos pasaron la función por prop, la usamos. Si no, usamos la de admin por defecto
      if (onCheckDuplicado) {
        const respuesta = await onCheckDuplicado(campo, valor);
        return respuesta.existe;
      } else {
        const respuesta = await adminService.verificarDuplicadoInversionista(campo, valor);
        return respuesta.existe;
      }
    } catch (error) {
      console.error(`Error verificando ${campo}:`, error);
      return false;
    }
  };

// ==========================================
  // VALIDACIÓN PASO 1: Datos Personales
  // ==========================================
const handleSiguiente = async () => {
    setValidando(true);
    setErrorGlobal('');
    const nuevosErrores = {};

    // 1. Validaciones Locales
    if (!formData.nombre.trim()) nuevosErrores.nombre = 'El nombre es obligatorio';
    if (!formData.email.trim()) nuevosErrores.email = 'El email es obligatorio';
    else if (!/^\S+@\S+\.\S+$/.test(formData.email)) nuevosErrores.email = 'Correo inválido';
    if (!formData.telefono.trim()) nuevosErrores.telefono = 'El teléfono es obligatorio';

    // 🧩 2. NUEVO: VALIDAR Y ENSAMBLAR DIRECCIÓN
    const { calle, numExt, numInt, colonia, cp, ciudad, estado } = direccionParts;    

if (!calle.trim() || !numExt.trim() || !colonia.trim() || !cp.trim() || !ciudad.trim() || !estado.trim()) {
      nuevosErrores.direccion = 'Todos los campos de la dirección (excepto N° Int) son obligatorios.';
    } else {
      // Ensamblamos el formato exacto para la base de datos
      let partesDir = [];
      partesDir.push(calle.trim());
      partesDir.push(`Num. ${numExt.trim()}`); // Ejemplo: Num. 335
      
      if (numInt.trim()) {
        partesDir.push(`Int. ${numInt.trim()}`); // Ejemplo: Int. 334 (Se le pondrá coma automáticamente)
      }
      
      partesDir.push(`Col. ${colonia.trim()}`);
      partesDir.push(`C.P. ${cp.trim().toUpperCase()}`); // Aseguramos que el CP siempre esté en mayúscula
      partesDir.push(ciudad.trim());
      partesDir.push(estado.trim());

      // Lo unimos todo. Esto generará EXACTAMENTE la cadena que quieres.
      formData.direccion = partesDir.join(', ');
    }

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      setValidando(false);
      return;
    }

    // 3. Validaciones de Duplicados
    try {
      if (!inversionistaAEditar || formData.email !== inversionistaAEditar.email) {
        const emailRepetido = await checarDuplicado('email', formData.email);
        if (emailRepetido) {
          // Mensaje súper claro en pantalla
          nuevosErrores.email = '⛔ Este correo ya está en uso por otra cuenta (Inversionista, Admin o Conductor).';
        }
      }

      if (!inversionistaAEditar || formData.telefono !== inversionistaAEditar.telefono) {
        const telRepetido = await checarDuplicado('telefono', formData.telefono);
        if (telRepetido) nuevosErrores.telefono = '⛔ Este teléfono ya pertenece a otro inversionista.';
      }

      if (formData.whatsapp && (!inversionistaAEditar || formData.whatsapp !== inversionistaAEditar.whatsapp)) {
        const wpRepetido = await checarDuplicado('whatsapp', formData.whatsapp);
        if (wpRepetido) nuevosErrores.whatsapp = '⛔ Este WhatsApp ya está registrado.';
      }
    } catch (error) {
      // Si el servidor se cae, lo mostramos en pantalla, no en la consola
      setErrorGlobal('Hubo un problema de conexión al verificar los datos. Intenta de nuevo.');
      setValidando(false);
      return;
    }

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      // Este mensaje rojo aparecerá arriba del botón Siguiente
      setErrorGlobal('Por favor, corrige los errores marcados en rojo para continuar.');
      setValidando(false);
      return;
    }

    // Todo bien, pasamos al paso 2
    setPaso(2);
    setValidando(false);
  };

// ==========================================
  // VALIDACIÓN PASO 2: Datos Fiscales
  // ==========================================
  const handleSiguiente2 = async () => {
    setValidando(true);
    setErrorGlobal('');
    const nuevosErrores = {};

    // 1. Validar RFC
    if (!formData.rfc.trim()) nuevosErrores.rfc = 'El RFC es obligatorio';
    else if (!validarRFC(formData.rfc)) nuevosErrores.rfc = 'Formato de RFC inválido';

    // 2. Validar exclusivos de Persona Física
    if (formData.tipo_inversionista === 'Física') {
      if (!formData.curp?.trim()) nuevosErrores.curp = 'El CURP es obligatorio';
      else if (formData.curp.length < 18) nuevosErrores.curp = 'El CURP debe tener 18 caracteres';
      
      if (!formData.estado_civil) nuevosErrores.estado_civil = 'El estado civil es obligatorio';
    }

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      setValidando(false);
      return;
    }

    // 📸 3. NUEVO: VALIDACIÓN DE DOCUMENTOS (PASO 2)
    const docsFaltantes = [];
    if (!formData.doc_identificacion) docsFaltantes.push('Identificación Oficial');
    if (!formData.doc_constancia_fiscal) docsFaltantes.push('Constancia Fiscal');
    if (!formData.doc_comprobante_domicilio) docsFaltantes.push('Comprobante de Domicilio');
    
    if (formData.tipo_inversionista === 'Moral') {
      if (!formData.doc_acta_constitutiva) docsFaltantes.push('Acta Constitutiva');
      if (!formData.doc_poder_legal) docsFaltantes.push('Poder Legal');
    }

    if (docsFaltantes.length > 0) {
      // Usamos setErrorGlobal para que salga el banner rojo arriba con la lista exacta
      setErrorGlobal(`⚠️ Falta subir: ${docsFaltantes.join(', ')}`);
      setValidando(false);
      return;
    }

    // 4. Verificación de RFC Duplicado
    if (!inversionistaAEditar || formData.rfc !== inversionistaAEditar.rfc) {
      const rfcRepetido = await checarDuplicado('rfc', formData.rfc);
      if (rfcRepetido) {
        setErrores({ rfc: '⛔ Este RFC ya está registrado en el sistema.' });
        setErrorGlobal('El RFC ya existe.');
        setValidando(false);
        return;
      }
    }

    // ✅ 5. Verificación de CURP Duplicado (Solo si es Física)
    if (formData.tipo_inversionista === 'Física' && (!inversionistaAEditar || formData.curp !== inversionistaAEditar.curp)) {
      const curpRepetido = await checarDuplicado('curp', formData.curp);
      if (curpRepetido) {
        setErrores({ curp: '⛔ Este CURP ya está registrado en el sistema.' });
        setErrorGlobal('El CURP ingresado ya pertenece a otro inversionista.');
        setValidando(false);
        return;
      }
    }

    // Todo bien, pasamos al paso 3 (Bancarios)
    setPaso(3);
    setValidando(false);
  };

  // =========================================
  // VALIDACIÓN PASO 3: Datos Bancarios y Guardar
  // =========================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidando(true);
    setErrorGlobal('');
    const nuevosErrores = {};

    // 1. Validar Textos de Banco, CLABE y Titular
    if (!formData.nombre_cuenta_banco?.trim()) nuevosErrores.nombre_cuenta_banco = 'El nombre del titular es obligatorio';
    if (!formData.banco.trim()) nuevosErrores.banco = 'El banco es obligatorio';
    if (!formData.clabe.trim()) nuevosErrores.clabe = 'La CLABE es obligatoria';
    if (formData.clabe && formData.clabe.length !== 18) nuevosErrores.clabe = 'La CLABE debe tener 18 dígitos';
    if (!formData.cuenta_bancaria.trim()) nuevosErrores.cuenta_bancaria = 'El número de cuenta es obligatorio';

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      setValidando(false);
      return;
    }

    // 📸 2. NUEVO: VALIDACIÓN DEL DOCUMENTO BANCARIO
    if (!formData.doc_cuenta_banco) {
      setErrorGlobal('⚠️ Debes subir la Carátula del Estado de Cuenta para finalizar.');
      setValidando(false);
      return;
    }

    // 🏦 3. NUEVO: VERIFICAR CLABE DUPLICADA EN TIEMPO REAL
    if (!inversionistaAEditar || formData.clabe !== inversionistaAEditar.clabe) {
      const clabeRepetida = await checarDuplicado('clabe', formData.clabe);
      if (clabeRepetida) {
        setErrores({ clabe: '⛔ Esta CLABE ya está siendo utilizada por otro inversionista.' });
        setErrorGlobal('Verifica los datos bancarios, la CLABE ya existe.');
        setValidando(false);
        return;
      }
    }

    // 4. Ejecutar el guardado final al Backend
try {
      await onSave(formData);
    } catch (error) {
      // 1. Extraemos el mensaje de texto que nos mandó el backend
      const mensajeBackend = error.message || '';

      // 2. Buscamos palabras clave para saber qué input pintar de rojo
      if (mensajeBackend.includes('CLABE')) {
        setErrores({ clabe: '⛔ La CLABE ingresada ya pertenece a otro inversionista.' });
        setErrorGlobal('⚠️ Revisa los datos, esa CLABE ya está registrada.');
      } 
      else if (mensajeBackend.includes('RFC')) {
        setErrores({ rfc: '⛔ Este RFC ya está registrado.' });
        setPaso(2); // Lo regresamos a la pestaña de Fiscales para que vea el error
        setErrorGlobal('⚠️ El RFC ingresado ya existe.');
      } 
      else if (mensajeBackend.includes('Email')) {
        setErrores({ email: '⛔ Este correo ya está registrado.' });
        setPaso(1); // Lo regresamos a la pestaña de Personales
        setErrorGlobal('⚠️ El correo ingresado ya existe.');
      } 
      else {
        // Si es otro tipo de error (ej. se cayó el servidor)
        setErrorGlobal(mensajeBackend || 'Error interno al guardar el inversionista.');
      }
    } finally {
      setValidando(false);
    }
  };

  // ==========================================
  // FUNCIÓN PARA SUBIR ARCHIVOS A CLOUDINARY
  // ==========================================
  const handleFileUpload = async (e, campoBd) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Mostrar el spinner de carga en este recuadro específico
    setUploadingDocs(prev => ({ ...prev, [campoBd]: true }));
    setErrorGlobal('');

    // 2. Preparar el paquete de datos para Cloudinary
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', 'inversionistas_docs'); // ⚠️ Cambia esto
    data.append('cloud_name', 'dvh2t0afl');       // ⚠️ Cambia esto

    try {
      // 3. Enviar a Cloudinary
      const res = await fetch(`https://api.cloudinary.com/v1_1/dvh2t0afl/upload`, {
        method: 'POST',
        body: data
      });
      
      const uploadedFile = await res.json();
      
      if (uploadedFile.error) {
        throw new Error(uploadedFile.error.message);
      }

      // 4. Guardar el link seguro en nuestro formData
      setFormData(prev => ({ ...prev, [campoBd]: uploadedFile.secure_url }));
      
    } catch (error) {
      console.error("Error subiendo archivo:", error);
      setErrorGlobal(`Error al subir el documento. Intenta con un archivo más pequeño.`);
    } finally {
      // 5. Apagar el spinner
      setUploadingDocs(prev => ({ ...prev, [campoBd]: false }));
    }
  };

  // ==========================================
  // RENDERIZADOR DE CAJAS DE SUBIDA (MOBILE-FRIENDLY)
  // ==========================================
  const renderUploadBox = (campoBd, titulo, colorTheme = 'purple') => {
    const isUploading = uploadingDocs[campoBd];
    const isUploaded = !!formData[campoBd];

    // Clases dinámicas
    const baseColor = colorTheme === 'green' ? 'green' : 'cyan'; // Cambié a cyan/green para que haga match con tu UI
    const borderColor = isUploaded ? `border-${baseColor}-500` : `border-gray-600/50`;
    const bgColor = isUploaded ? `bg-${baseColor}-500/10` : `bg-black/30`;
    const textColor = isUploaded ? `text-${baseColor}-400` : `text-gray-400`;

    return (
      <div className={`relative h-28 border-2 border-dashed ${borderColor} ${bgColor} rounded-xl flex flex-col items-center justify-center ${textColor} transition-all overflow-hidden group p-2`}>
        
        {/* 🚀 INPUT GLOBAL: Solo se muestra si NO hay archivo subido */}
        {!isUploading && !isUploaded && (
          <input 
            type="file" 
            accept=".pdf, image/jpeg, image/png, image/webp, image/heic" 
            onChange={(e) => handleFileUpload(e, campoBd)}
            disabled={validando}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed" 
            title="Haz clic para subir archivo"
          />
        )}

        {/* Contenido visual */}
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
            <span className="text-xs font-medium text-white">Subiendo...</span>
          </div>
        ) : isUploaded ? (
          <div className="flex flex-col items-center justify-between h-full w-full py-1 z-20">
            
            {/* Título y Check */}
            <div className="flex flex-col items-center w-full px-4">
              <CheckCircle2 className={`w-5 h-5 text-${baseColor}-500 mb-1`} />
              <span className="text-xs font-medium truncate w-full text-center text-white" title={titulo}>
                {titulo}
              </span>
            </div>
            
            {/* 🚀 CONTROLES MÓVILES (Botones grandes y fáciles de tocar) */}
            <div className="flex gap-2 w-full mt-2">
              <a 
                href={formData[campoBd]} 
                target="_blank" 
                rel="noreferrer" 
                className={`flex-1 py-1.5 text-center bg-${baseColor}-500/20 hover:bg-${baseColor}-500/30 text-${baseColor}-300 rounded-lg text-xs font-bold active:scale-95 transition-all`}
                onClick={(e) => e.stopPropagation()}
              >
                Ver
              </a>
              
              {/* El botón "Cambiar" ahora tiene su propio input oculto adentro */}
              <label className="flex-1 py-1.5 text-center bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold active:scale-95 transition-all cursor-pointer">
                Cambiar
                <input 
                  type="file" 
                  accept=".pdf, image/jpeg, image/png, image/webp, image/heic" 
                  onChange={(e) => handleFileUpload(e, campoBd)}
                  disabled={validando}
                  className="hidden" // 👈 Está oculto, pero el label activa el buscador de archivos
                />
              </label>
            </div>

            {/* Botón "X" mejorado para dedos anchos */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setFormData(prev => ({ ...prev, [campoBd]: '' }));
              }}
              className="absolute top-0 right-0 p-2 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-bl-xl z-30 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl leading-none">+</span>
            <span className="text-xs text-center px-2 font-medium">{titulo}</span>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // 3. ZONA DE EFECTOS (useEffects)
  // ==========================================
  
  // Efecto Ensamblador de Dirección
  useEffect(() => {
    const partes = [];
    if (direccionParts.calle) partes.push(direccionParts.calle);
    
    let numeros = '';
    if (direccionParts.numExt) numeros += `Num. ${direccionParts.numExt}`;
    if (direccionParts.numInt) numeros += ` Int. ${direccionParts.numInt}`;
    if (numeros) partes.push(numeros.trim());

    if (direccionParts.colonia) partes.push(`Col. ${direccionParts.colonia}`);
    if (direccionParts.cp) partes.push(`C.P. ${direccionParts.cp}`);
    if (direccionParts.ciudad) partes.push(direccionParts.ciudad);
    if (direccionParts.estado) partes.push(direccionParts.estado);

    const direccionCompleta = partes.join(', ');
    handleInputChange({ target: { name: 'direccion', value: direccionCompleta } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direccionParts]);

// Efecto de Inicialización / Limpieza al abrir el modal
useEffect(() => {
    if (isOpen) {
      setPaso(1);
      
      if (inversionistaAEditar) {
        // MODO EDICIÓN: Llenamos con los datos del inversionista
        setFormData({
          nombre: inversionistaAEditar.nombre || '',
          email: inversionistaAEditar.email || '',
          telefono: inversionistaAEditar.telefono || '',
          whatsapp: inversionistaAEditar.whatsapp || '',
          direccion: inversionistaAEditar.direccion || '',
          rfc: inversionistaAEditar.rfc || '',
          banco: inversionistaAEditar.banco || '',
          cuenta_bancaria: inversionistaAEditar.cuenta_bancaria || '',
          clabe: inversionistaAEditar.clabe || '',
          tipo_inversionista: inversionistaAEditar.tipo_inversionista || 'Física',
          curp: inversionistaAEditar.curp || '',
          estado_civil: inversionistaAEditar.estado_civil || '',
          nombre_cuenta_banco: inversionistaAEditar.nombre_cuenta_banco || '',
          doc_identificacion: inversionistaAEditar.doc_identificacion || '',
          doc_constancia_fiscal: inversionistaAEditar.doc_constancia_fiscal || '',
          doc_comprobante_domicilio: inversionistaAEditar.doc_comprobante_domicilio || '',
          doc_acta_constitutiva: inversionistaAEditar.doc_acta_constitutiva || '',
          doc_poder_legal: inversionistaAEditar.doc_poder_legal || '',
          doc_cuenta_banco: inversionistaAEditar.doc_cuenta_banco || ''
        });

        // 🧩 NUEVO: DESENSAMBLAR DIRECCIÓN PARA LOS RECUDROS
        let dCalle = '', dNumExt = '', dNumInt = '', dColonia = '', dCp = '', dCiudad = '', dEstado = '';
        
        if (inversionistaAEditar.direccion) {
          const partes = inversionistaAEditar.direccion.split(',').map(p => p.trim());
          
          if (partes.length >= 6) {
            dCalle = partes[0];
            dNumExt = partes[1] ? partes[1].replace(/num\.\s*/i, '') : '';
            
            let offset = 0;
            // Checamos si la tercera parte es el número interior
            if (partes[2] && partes[2].toLowerCase().startsWith('int.')) {
              dNumInt = partes[2].replace(/int\.\s*/i, '');
              offset = 1;
            }
            
            dColonia = partes[2 + offset] ? partes[2 + offset].replace(/col\.\s*/i, '') : '';
            dCp = partes[3 + offset] ? partes[3 + offset].replace(/c\.p\.\s*/i, '') : '';
            dCiudad = partes[4 + offset] || '';
            dEstado = partes[5 + offset] || '';
          } else {
            // Fallback: Si es un registro muy viejo sin comas, lo ponemos todo en la calle
            dCalle = inversionistaAEditar.direccion;
          }
        }

        // Cargamos los pedazos limpios
        setDireccionParts({
          calle: dCalle, numExt: dNumExt, numInt: dNumInt, 
          colonia: dColonia, cp: dCp, ciudad: dCiudad, estado: dEstado
        });
        
      } else {
        // MODO CREACIÓN: Limpiamos absolutamente todo
        setFormData({
          nombre: '', email: '', telefono: '', whatsapp: '',
          direccion: '', rfc: '', banco: '', cuenta_bancaria: '', clabe: '',
          tipo_inversionista: 'Física', curp: '', estado_civil: '', nombre_cuenta_banco: '',
          doc_identificacion: '', doc_constancia_fiscal: '', doc_comprobante_domicilio: '',
          doc_acta_constitutiva: '', doc_poder_legal: '', doc_cuenta_banco: ''
        });
        setDireccionParts({
          calle: '', numExt: '', numInt: '', cp: '', colonia: '', estado: '', ciudad: ''
        });
      }
      
      // Limpiamos errores y estados de carga
      setErrores({});
      setErrorGlobal('');
      setValidando(false);
      setUploadingDocs({}); // Importante: resetear los spinners de Cloudinary
    }
  }, [isOpen, inversionistaAEditar]);

  // ==========================================
  // 4. ZONA DE CORTES (Early Return) - Siempre después de los Hooks
  // ==========================================
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-400" />
            {inversionistaAEditar ? 'Editar Inversionista' : 'Registrar Nuevo Inversionista'}
          </h2>
          <button onClick={onClose} disabled={validando} className="text-gray-400 hover:text-white transition-colors disabled:opacity-50">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 🚀 STEPPER ACTUALIZADO (3 Pestañas) */}
        <div className="flex bg-slate-800/30 border-b border-slate-800 text-xs sm:text-sm font-medium">
          
          {/* Paso 1: Personales */}
          <div className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 border-b-2 transition-colors ${paso === 1 ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5' : 'border-transparent text-gray-500'}`}>
            <User className="w-4 h-4" /> 
            <span className="hidden sm:inline">1. Personales</span>
            <span className="sm:hidden">1. Gral</span>
          </div>

          {/* Paso 2: Fiscales y Documentos */}
          <div className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 border-b-2 transition-colors ${paso === 2 ? 'border-purple-400 text-purple-400 bg-purple-400/5' : 'border-transparent text-gray-500'}`}>
            <FileText className="w-4 h-4" /> 
            <span className="hidden sm:inline">2. Fiscales</span>
            <span className="sm:hidden">2. Docs</span>
          </div>

          {/* Paso 3: Bancarios */}
          <div className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 border-b-2 transition-colors ${paso === 3 ? 'border-green-400 text-green-400 bg-green-400/5' : 'border-transparent text-gray-500'}`}>
            <Landmark className="w-4 h-4" /> 
            <span className="hidden sm:inline">3. Bancarios</span>
            <span className="sm:hidden">3. Banco</span>
          </div>

        </div>

        {/* Mensaje de Error Global */}
        {errorGlobal && (
            <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                {errorGlobal}
            </div>
        )}

        

<div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          
          {/* ========================================================= */}
          {/* PASO 1: DATOS PERSONALES Y GENERALES */}
          {/* ========================================================= */}
          {paso === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              
              {/* SELECTOR DE TIPO DE INVERSIONISTA */}
              <div className="col-span-1 md:col-span-2 mt-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  ¿Qué tipo de inversionista vas a registrar? <span className="text-red-400">*</span>
                </label>
                <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700">
                  <button type="button" onClick={() => handleInputChange({ target: { name: 'tipo_inversionista', value: 'Física' } })} className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${formData.tipo_inversionista === 'Física' ? 'bg-cyan-500 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-slate-700/50'}`}>
                    <User className="w-4 h-4" /> Persona Física
                  </button>
                  <button type="button" onClick={() => handleInputChange({ target: { name: 'tipo_inversionista', value: 'Moral' } })} className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${formData.tipo_inversionista === 'Moral' ? 'bg-purple-500 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-slate-700/50'}`}>
                    <Briefcase className="w-4 h-4" /> Persona Moral
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre / Razón Social */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    {formData.tipo_inversionista === 'Física' ? 'Nombre Completo' : 'Razón Social'} <span className="text-red-400">*</span>
                  </label>
                  <input type="text" name="nombre" value={formData.nombre} onChange={handleInputChange} disabled={validando} className={`w-full p-2.5 bg-slate-800/50 border rounded-lg text-white focus:outline-none focus:border-cyan-400 ${errores.nombre ? 'border-red-500' : 'border-slate-700'}`} placeholder="Ej. Juan Pérez García" />
                  {errores.nombre && <p className="text-red-400 text-xs mt-1">{errores.nombre}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    {formData.tipo_inversionista === 'Física' ? 'Correo Electrónico' : 'Correo del Representante'} <span className="text-red-400">*</span>
                  </label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} disabled={validando} className={`w-full p-2.5 bg-slate-800/50 border rounded-lg text-white focus:outline-none focus:border-cyan-400 ${errores.email ? 'border-red-500' : 'border-slate-700'}`} placeholder="correo@ejemplo.com" />
                  {errores.email && <p className="text-red-400 text-xs mt-1">{errores.email}</p>}
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    {formData.tipo_inversionista === 'Física' ? 'Teléfono Celular' : 'Teléfono del Representante'} <span className="text-red-400">*</span>
                  </label>
                  <input type="text" name="telefono" value={formData.telefono} onChange={handleInputChange} maxLength={10} disabled={validando} className={`w-full p-2.5 bg-slate-800/50 border rounded-lg text-white focus:outline-none focus:border-cyan-400 ${errores.telefono ? 'border-red-500' : 'border-slate-700'}`} placeholder="10 dígitos" />
                  {errores.telefono && <p className="text-red-400 text-xs mt-1">{errores.telefono}</p>}
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">WhatsApp <span className="text-gray-500 text-xs">(Opcional)</span></label>
                  <input type="text" name="whatsapp" value={formData.whatsapp} onChange={handleInputChange} maxLength={10} disabled={validando} className={`w-full p-2.5 bg-slate-800/50 border rounded-lg text-white focus:outline-none focus:border-cyan-400 ${errores.whatsapp ? 'border-red-500' : 'border-slate-700'}`} placeholder="10 dígitos" />
                  {errores.whatsapp && <p className="text-red-400 text-xs mt-1">{errores.whatsapp}</p>}
                </div>

                {/* SECCIÓN DE DIRECCIÓN ESTRUCTURADA */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Dirección Completa <span className="text-red-400">*</span></label>
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border bg-slate-800/30 ${errores.direccion ? 'border-red-500/50' : 'border-slate-700'}`}>
                    <div className="md:col-span-2">
                      <input type="text" name="calle" value={direccionParts.calle} onChange={handleDireccionChange} disabled={validando} placeholder="Calle (Ej. Av. Insurgentes)" className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input type="text" name="numExt" value={direccionParts.numExt} onChange={handleDireccionChange} disabled={validando} placeholder="N° Ext" className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400" />
                      <input type="text" name="numInt" value={direccionParts.numInt} onChange={handleDireccionChange} disabled={validando} placeholder="N° Int (Opc.)" className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400" />
                    </div>
                    <div className="grid grid-cols-5 gap-4">
                      <input type="text" name="cp" value={direccionParts.cp} onChange={handleDireccionChange} disabled={validando} placeholder="C.P." maxLength="5" className="col-span-2 w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400" />
                      <input type="text" name="colonia" value={direccionParts.colonia} onChange={handleDireccionChange} disabled={validando} placeholder="Colonia / Fracc." className="col-span-3 w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400" />
                    </div>
                    <div>
                      <select name="estado" value={direccionParts.estado} onChange={handleDireccionChange} disabled={validando} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400 appearance-none">
                        <option value="" className="text-gray-500">Selecciona un Estado...</option>
                        {ESTADOS_MEXICO.map(estado => (
                          <option key={estado} value={estado}>{estado}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input type="text" name="ciudad" value={direccionParts.ciudad} onChange={handleDireccionChange} disabled={validando} placeholder="Ciudad (Ej. Tepic)" className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400" />
                    </div>
                  </div>
                  {errores.direccion && <p className="text-red-400 text-xs mt-2">{errores.direccion}</p>}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASO 2: DATOS FISCALES Y DOCUMENTOS */}
          {/* ========================================================= */}
          {paso === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* RFC */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">RFC <span className="text-red-400">*</span></label>
                  <input type="text" name="rfc" value={formData.rfc} onChange={handleInputChange} maxLength={13} disabled={validando} className={`w-full p-2.5 bg-slate-800/50 border rounded-lg text-white focus:outline-none focus:border-purple-400 uppercase ${errores.rfc ? 'border-red-500' : 'border-slate-700'}`} placeholder="XAXX010101000" />
                  {errores.rfc && <p className="text-red-400 text-xs mt-1">{errores.rfc}</p>}
                </div>

                {/* Exclusivos Persona Física */}
                {formData.tipo_inversionista === 'Física' && (
                  <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">CURP <span className="text-red-400">*</span></label>
                      <input type="text" name="curp" value={formData.curp} onChange={handleInputChange} maxLength="18" disabled={validando} className={`w-full p-2.5 bg-slate-800/50 border rounded-lg text-white focus:outline-none focus:border-purple-400 uppercase ${errores.curp ? 'border-red-500' : 'border-slate-700'}`} placeholder="18 caracteres" />
                      {errores.curp && <p className="text-red-400 text-xs mt-1">{errores.curp}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Estado Civil <span className="text-red-400">*</span></label>
                      <select name="estado_civil" value={formData.estado_civil} onChange={handleInputChange} disabled={validando} className={`w-full p-2.5 bg-slate-800/50 border rounded-lg text-white focus:outline-none focus:border-purple-400 appearance-none ${errores.estado_civil ? 'border-red-500' : 'border-slate-700'}`}>
                        <option value="" className="text-gray-500">Selecciona una opción...</option>
                        <option value="Soltero(a)">Soltero(a)</option>
                        <option value="Casado(a)">Casado(a)</option>
                        <option value="Divorciado(a)">Divorciado(a)</option>
                        <option value="Viudo(a)">Viudo(a)</option>
                        <option value="Prefiero no decirlo">Prefiero no decirlo</option>
                      </select>
                      {errores.estado_civil && <p className="text-red-400 text-xs mt-1">{errores.estado_civil}</p>}
                    </div>
                  </div>
                )}
              </div>

{/* 📸 ZONA DE DOCUMENTOS (Placeholders de Cloudinary) */}
              <div className="mt-6">
                <h4 className="text-purple-400 font-medium mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
                  <FileText className="w-4 h-4"/> Documentación Requerida (PDF o JPG)
                </h4>

                {/* 🚨 NUEVO: AVISO EXCLUSIVO PARA PERSONA MORAL 🚨 */}
                {formData.tipo_inversionista === 'Moral' && (
                  <div className="mb-5 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
                    <span className="text-xl leading-none">⚠️</span>
                    <div className="text-sm">
                      <p className="font-semibold text-amber-400">Requisito estricto para Persona Moral</p>
                      <p className="text-amber-400/80 mt-1">
                        Por motivos legales, todos los documentos de la empresa (Acta Constitutiva, Poder, etc.) deben subirse <strong>digitalizados mediante escáner</strong>. No se aceptarán fotografías tomadas con el celular.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderUploadBox('doc_identificacion', 'Identificación Oficial')}
                  {renderUploadBox('doc_constancia_fiscal', 'Constancia Fiscal')}
                  {renderUploadBox('doc_comprobante_domicilio', 'Comprobante Domicilio')}
                  
                  {formData.tipo_inversionista === 'Moral' && (
                    <>
                      {renderUploadBox('doc_acta_constitutiva', 'Acta Constitutiva')}
                      {renderUploadBox('doc_poder_legal', 'Poder Legal')}
                    </>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* PASO 3: DATOS BANCARIOS */}
          {/* ========================================================= */}
          {paso === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg mb-4">
                <p className="text-blue-400 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Estos datos son vitales para realizar los depósitos de rendimientos.
                </p>
              </div>

              {/* 👤 Nombre del Titular */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Nombre del Titular de la Cuenta <span className="text-red-400">*</span></label>
                  <input type="text" name="nombre_cuenta_banco" value={formData.nombre_cuenta_banco} onChange={handleInputChange} maxLength={30} disabled={validando} className={`w-full p-2.5 bg-slate-800/50 border rounded-lg text-white focus:outline-none focus:border-green-400 ${errores.nombre_cuenta_banco ? 'border-red-500' : 'border-slate-700'}`} placeholder="Ej. Juan Pérez García" />
                  {errores.nombre_cuenta_banco && <p className="text-red-400 text-xs mt-1">{errores.nombre_cuenta_banco}</p>}
                </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 🏦 Banco (Combo Box Estandarizado) */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Banco <span className="text-red-400">*</span></label>
                  <select 
                    name="banco" 
                    value={formData.banco} 
                    onChange={handleInputChange} 
                    disabled={validando} 
                    className={`w-full p-2.5 bg-slate-800/50 border rounded-lg text-white focus:outline-none focus:border-green-400 appearance-none cursor-pointer ${errores.banco ? 'border-red-500' : 'border-slate-700'}`}
                  >
                    <option value="" disabled className="text-gray-500">Selecciona el banco del titular...</option>
                    {BANCOS_MEXICO.map((bancoNombre) => (
                      <option key={bancoNombre} value={bancoNombre}>
                        {bancoNombre}
                      </option>
                    ))}
                  </select>
                  {errores.banco && <p className="text-red-400 text-xs mt-1">{errores.banco}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Numero de cuenta <span className="text-red-400">*</span> </label>
                  <input type="text" name="cuenta_bancaria" value={formData.cuenta_bancaria} onChange={handleInputChange} maxLength={11} disabled={validando} className={`w-full p-2.5 bg-slate-800/50 border rounded-lg text-white focus:outline-none focus:border-green-400 ${errores.cuenta_bancaria ? 'border-red-500' : 'border-slate-700'}`} placeholder="10 dígitos" />
                  {errores.cuenta_bancaria && <p className="text-red-400 text-xs mt-1">{errores.cuenta_bancaria}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">CLABE Interbancaria <span className="text-red-400">*</span></label>
                  <input type="text" name="clabe" value={formData.clabe} onChange={handleInputChange} maxLength={18} disabled={validando} className={`w-full p-2.5 bg-slate-800/50 border rounded-lg text-white focus:outline-none focus:border-green-400 ${errores.clabe ? 'border-red-500' : 'border-slate-700'}`} placeholder="18 dígitos" />
                  {errores.clabe && <p className="text-red-400 text-xs mt-1">{errores.clabe}</p>}
                </div>  
              </div>
              {/* 📸 ZONA DE DOCUMENTO BANCARIO (Placeholder Cloudinary) */}
              <div className="mt-6 p-5 bg-green-500/5 border border-green-500/20 rounded-xl">
                <h4 className="text-green-400 font-medium mb-4 flex items-center gap-2 border-b border-green-500/20 pb-2">
                  <FileText className="w-4 h-4"/> Documento Bancario Requerido (PDF o JPG)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderUploadBox('doc_cuenta_banco', 'Carátula de Estado de Cuenta', 'green')}
                </div>
                </div>
            </div>
          )}
        </div>


{/* Footer / Botones Fijos */}
        <div className="p-5 border-t border-slate-800 bg-slate-900 flex justify-between">
          
          {paso === 1 && (
            <>
              <button onClick={onClose} disabled={validando} className="px-5 py-2.5 text-gray-400 hover:text-white transition-colors disabled:opacity-50">Cancelar</button>
              <button onClick={handleSiguiente} disabled={validando} className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-600/50 text-white rounded-lg flex items-center gap-2 transition-colors">
                {validando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Siguiente'} {!validando && <ChevronRight className="w-4 h-4" />}
              </button>
            </>
          )}

          {paso === 2 && (
            <>
              <button onClick={() => setPaso(1)} disabled={validando} className="px-5 py-2.5 text-gray-400 hover:text-white transition-colors flex items-center gap-2 disabled:opacity-50">
                <ChevronLeft className="w-4 h-4" /> Atrás
              </button>
              <button onClick={handleSiguiente2} disabled={validando} className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white rounded-lg flex items-center gap-2 transition-colors">
                {validando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Siguiente'} {!validando && <ChevronRight className="w-4 h-4" />}
              </button>
            </>
          )}

          {paso === 3 && (
            <>
              <button onClick={() => setPaso(2)} disabled={validando} className="px-5 py-2.5 text-gray-400 hover:text-white transition-colors flex items-center gap-2 disabled:opacity-50">
                <ChevronLeft className="w-4 h-4" /> Atrás
              </button>
              <button onClick={handleSubmit} disabled={validando} className="px-6 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-green-600/50 text-white rounded-lg flex items-center gap-2 transition-colors">
                {validando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Finalizar Registro'}
              </button>
            </>
          )}

        </div>

      </div>
    </div>
  );
};

export default ModalNuevoInversionista;