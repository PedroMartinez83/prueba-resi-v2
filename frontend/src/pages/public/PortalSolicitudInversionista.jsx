import React, { useState } from 'react';
import { 
  User, 
  FileText, 
  Landmark, 
  CheckCircle, 
  ChevronRight, 
  ChevronLeft, 
  UploadCloud,
  Building,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import logo from '../../assets/logo.png'; // Ajusta la ruta a tu logo según dónde guardes este archivo
import { API_BASE_URL } from '@/services/api'; // Ajusta la ruta si es necesario

const ESTADOS_MEXICO = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
  'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México',
  'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit',
  'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
  'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'
];

const BANCOS_MEXICO = [
  "BBVA", "Santander", "Banorte", "Citibanamex", "HSBC", "Scotiabank",
  "Banco Azteca", "BanCoppel", "Inbursa", "BanBajío", "Banregio", "Afirme",
  "Invex", "Mifel", "Banjército", "Openbank", "Nu México", "Mercado Pago",
  "Hey Banco", "Klar", "Spin by Oxxo", "Ualá", "Stori", "Fondeadora",
  "Albo", "Celo", "STP", "Otro"
].sort();

// ==========================================
// 🚀 COMPONENTES EXTRAÍDOS (ESTO ARREGLA EL PROBLEMA DEL FOCO)
// ==========================================
const InputGroup = ({ label, name, type = 'text', placeholder, required, options = null, value, error, onChange, disabled, maxLength }) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-semibold text-gray-300">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {options ? (
      <select
        name={name}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        className={`bg-[#0f172a] border ${error ? 'border-red-500' : 'border-gray-700'} text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-cyan-500 transition-colors`}
      >
        <option value="">Selecciona una opción...</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    ) : (
      <input
        type={type}
        name={name}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`bg-[#0f172a] border ${error ? 'border-red-500' : 'border-gray-700'} text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-cyan-500 transition-colors`}
      />
    )}
    {error && <span className="text-red-500 text-xs mt-0.5">{error}</span>}
  </div>
);

const FileUpload = ({ label, name, required, file, error, onChange }) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-semibold text-gray-300">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <label className={`flex items-center justify-center w-full h-24 px-4 transition bg-[#0f172a] border-2 border-dashed rounded-xl appearance-none cursor-pointer group
      ${error ? 'border-red-500/50 bg-red-500/5' : 'border-gray-700 hover:border-cyan-500 hover:bg-[#1e293b]'}`}>
      <div className="flex flex-col items-center space-y-2">
        <UploadCloud className={`w-6 h-6 ${error ? 'text-red-400' : 'text-gray-400 group-hover:text-cyan-400'}`} />
        <span className={`text-xs font-medium text-center ${error ? 'text-red-400' : 'text-gray-400 group-hover:text-cyan-400'}`}>
          {file ? file.name : (error || 'Click para subir documento')}
        </span>
      </div>
      <input type="file" name={name} onChange={onChange} className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
    </label>
  </div>
);

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
const PortalSolicitudInversionista = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Estado inicial con todos los campos de tu tabla
  const [formData, setFormData] = useState({
    nombre: '', email: '', telefono: '', whatsapp: '', tipo_inversionista: 'Física', 
    estado_civil: '', curp: '', direccion: '', como_nos_conocio: '', plan_preferido: '', 
    monto_interes: '', mensaje: '', rfc: '', doc_identificacion: null, doc_constancia_fiscal: null, 
    doc_comprobante_domicilio: null, doc_acta_constitutiva: null, doc_poder_legal: null, 
    doc_id_representante: null, banco: '', cuenta_bancaria: '', clabe: '', 
    nombre_cuenta_banco: '', doc_cuenta_banco: null
  });

  const [direccionParts, setDireccionParts] = useState({
    calle: '', numExt: '', numInt: '', cp: '', colonia: '', estado: '', ciudad: ''
  });

  const [errores, setErrores] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // 🚀 1. Lista de campos que tienen prohibido llevar espacios
    const camposSinEspacios = ['email', 'telefono', 'whatsapp', 'curp', 'rfc', 'clabe', 'cuenta_bancaria'];
    
    let valorFinal = value;

    // 🚀 2. Si el campo está en la lista, le exterminamos los espacios (incluso si copian y pegan)
    if (camposSinEspacios.includes(name)) {
      valorFinal = value.replace(/\s/g, ''); 
    }

    // 🚀 3. TIP PRO: Forzamos a que CURP y RFC siempre se escriban en MAYÚSCULAS
    if (['curp', 'rfc'].includes(name)) {
      valorFinal = valorFinal.toUpperCase();
    }

    // Actualizamos el estado con el valor ya limpio
    setFormData(prev => ({ ...prev, [name]: valorFinal }));
    
    // Limpiamos el error visual si es que lo había
    if (errores[name]) {
      setErrores(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleDireccionChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value.replace(/^\s+/, '').replace(/,/g, '');

    if (['calle', 'colonia', 'ciudad'].includes(name)) {
      finalValue = finalValue.replace(/(?:^|\s)\S/g, (letra) => letra.toUpperCase());
    }

    setDireccionParts(prev => ({ ...prev, [name]: finalValue }));
    if (errores.direccion) {
      setErrores(prev => ({ ...prev, direccion: null }));
    }
  };

  // Efecto Ensamblador de Dirección
  React.useEffect(() => {
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
    setFormData(prev => ({ ...prev, direccion: direccionCompleta }));
  }, [direccionParts]);

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    if (files.length > 0) {
      setFormData(prev => ({ ...prev, [name]: files[0] }));
      if (errores[name]) setErrores(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateStep = (step) => {
    const nuevosErrores = {};
    if (step === 1) {
      if (!formData.nombre) nuevosErrores.nombre = 'El nombre es obligatorio';
      if (!formData.email) nuevosErrores.email = 'El email es obligatorio';
      if (!formData.telefono || formData.telefono.length !== 10) nuevosErrores.telefono = 'El teléfono es obligatorio y debe tener 10 dígitos';
      if (!formData.tipo_inversionista) nuevosErrores.tipo_inversionista = 'Debe seleccionar un tipo de Persona';
      
      if (formData.tipo_inversionista === 'Física') {
        if (!formData.curp || formData.curp.length !== 18) nuevosErrores.curp = 'El CURP es obligatorio y debe tener 18 caracteres';
        if (!formData.estado_civil) nuevosErrores.estado_civil = 'Debe seleccionar un estado civil';
      }
    } else if (step === 2) {
      if (!formData.rfc || formData.rfc.length !== 13) nuevosErrores.rfc = 'El RFC es obligatorio y debe tener 13 caracteres';
      
      const { calle, numExt, cp, colonia, estado, ciudad } = direccionParts;
      if (!calle || !numExt || !cp || !colonia || !estado || !ciudad) {
        nuevosErrores.direccion = 'Faltan campos obligatorios en la dirección (El No. Int es opcional).';
      }

      if (!formData.doc_identificacion) nuevosErrores.doc_identificacion = 'Archivo obligatorio';
      if (!formData.doc_constancia_fiscal) nuevosErrores.doc_constancia_fiscal = 'Archivo obligatorio';
      if (!formData.doc_comprobante_domicilio) nuevosErrores.doc_comprobante_domicilio = 'Archivo obligatorio';

      if (formData.tipo_inversionista === 'Moral') {
        if (!formData.doc_acta_constitutiva) nuevosErrores.doc_acta_constitutiva = 'Archivo obligatorio';
        if (!formData.doc_poder_legal) nuevosErrores.doc_poder_legal = 'Archivo obligatorio';
        if (!formData.doc_id_representante) nuevosErrores.doc_id_representante = 'Archivo obligatorio';
      }
    } else if (step === 3) {
      if (!formData.banco) nuevosErrores.banco = 'El banco es obligatorio';
      if (!formData.clabe || formData.clabe.length !== 18) nuevosErrores.clabe = 'La CLABE debe tener 18 dígitos';
      if (!formData.nombre_cuenta_banco) nuevosErrores.nombre_cuenta_banco = 'El nombre del titular es obligatorio';
      if (!formData.doc_cuenta_banco) nuevosErrores.doc_cuenta_banco = 'El comprobante bancario es obligatorio para finalizar';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  // Función para consultar al backend público si el dato ya existe
  const verificarDuplicado = async (campo, valor) => {
    if (!valor) return false;
    try {
      // 🚀 Asegúrate de que esta ruta coincida con el endpoint público que creaste en el backend
      const response = await fetch(`/api/solicitudes-inversionistas/verificar?campo=${campo}&valor=${encodeURIComponent(valor)}`);
      const data = await response.json();
      return data.existe;
    } catch (error) {
      console.error(`Error validando ${campo}:`, error);
      return false; // Si falla el internet, lo dejamos pasar y lo atrapa el submit final
    }
  };

  const nextStep = async () => {
    // 1. Validaciones Locales primero
    if (!validateStep(currentStep)) return;

    // 2. Validaciones en Base de Datos (Solo si pasó las locales)
    setIsValidating(true);
    let tieneDuplicados = false;
    const nuevosErrores = {};

    if (currentStep === 1) {
      if (await verificarDuplicado('email', formData.email)) { nuevosErrores.email = 'Este correo ya está registrado en el sistema. Utilice otro por favor.'; tieneDuplicados = true; }
      if (await verificarDuplicado('telefono', formData.telefono)) { nuevosErrores.telefono = 'Este teléfono ya se encuentra en uso.'; tieneDuplicados = true; }
      if (formData.whatsapp && await verificarDuplicado('whatsapp', formData.whatsapp)) { nuevosErrores.whatsapp = 'Este WhatsApp ya se encuentra en uso.'; tieneDuplicados = true; }
      if (formData.tipo_inversionista === 'Física' && await verificarDuplicado('curp', formData.curp)) { nuevosErrores.curp = 'Este CURP ya se encuentra registrado.'; tieneDuplicados = true; }
    } 
    else if (currentStep === 2) {
      if (await verificarDuplicado('rfc', formData.rfc)) { nuevosErrores.rfc = 'Este RFC ya se encuentra registrado en el sistema.'; tieneDuplicados = true; }
    }

    setIsValidating(false);

    // Si encontramos duplicados, detenemos el avance y mostramos el error
    if (tieneDuplicados) {
      setErrores(prev => ({ ...prev, ...nuevosErrores }));
      return;
    }

    // Si todo está perfecto, avanzamos de paso
    setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => setCurrentStep(prev => prev - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(3)) return;

    setIsSubmitting(true);

    // Validar CLABE en el último paso antes de enviar todo
    if (await verificarDuplicado('clabe', formData.clabe)) {
      setErrores(prev => ({ ...prev, clabe: 'Esta CLABE bancaria ya se encuentra registrada por otro usuario.' }));
      setIsSubmitting(false);
      return;
    }

    try {
      // 🚀 1. Empaquetamos todo en un FormData nativo (necesario para enviar archivos)
      const dataToSend = new FormData();

      // Recorremos nuestro estado y metemos cada valor en la caja de envío
      Object.keys(formData).forEach(key => {
        // Solo enviamos los campos que tienen información (ignoramos nulls o vacíos)
        if (formData[key] !== null && formData[key] !== '') {
          dataToSend.append(key, formData[key]);
        }
      });

      // 🚀 2. Disparamos la petición al Backend
      const response = await fetch(`${API_BASE_URL}/solicitudes-inversionistas/nueva`, {
        method: 'POST',
        body: dataToSend
      });

      const data = await response.json();

      // 🚀 3. Evaluamos la respuesta de tu controlador
      if (response.ok && data.success) {
        // ¡Todo salió perfecto! Mostramos la pantalla verde de éxito
        setIsSuccess(true);
      } else {
        // Si tu backend rechazó algo (ej. falló una validación), mostramos el mensaje que programaste
        alert(`Error: ${data.message || 'No se pudo procesar la solicitud'}`);
      }

    } catch (error) {
      console.error("Error enviando solicitud:", error);
      alert("Hubo un error de conexión con el servidor. Revisa tu internet e intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // RENDERIZADO CONDICIONAL DE PASOS
  // ==========================================

  const renderStep1 = () => {
    const esFisica = formData.tipo_inversionista === 'Física';

    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputGroup 
            label="Tipo de Inversionista" 
            name="tipo_inversionista" 
            options={['Física', 'Moral']} 
            required 
            value={formData.tipo_inversionista}
            error={errores.tipo_inversionista}
            onChange={handleInputChange}
          />
          
          <InputGroup 
            label={esFisica ? "Nombre Completo" : "Razón Social"} 
            name="nombre" 
            placeholder={esFisica ? "Ej. Juan Pérez" : "Ej. Mi Empresa S.A. de C.V."} 
            required 
            value={formData.nombre}
            error={errores.nombre}
            onChange={handleInputChange}
          />
          <InputGroup 
            label={esFisica ? "Correo Electrónico" : "Correo del Representante"} 
            name="email" 
            type="email" 
            placeholder="correo@ejemplo.com" 
            required 
            value={formData.email}
            error={errores.email}
            onChange={handleInputChange}
          />
          <InputGroup 
            label={esFisica ? "Teléfono Celular" : "Teléfono del Representante"} 
            name="telefono" 
            placeholder="10 dígitos" 
            maxLength="10"
            required 
            value={formData.telefono}
            error={errores.telefono}
            onChange={handleInputChange}
          />
          <InputGroup 
            label="WhatsApp (Opcional)" 
            name="whatsapp" 
            placeholder="10 dígitos" 
            maxLength="10"
            value={formData.whatsapp}
            error={errores.whatsapp}
            onChange={handleInputChange}
          />
          
          {esFisica && (
            <>
              <InputGroup 
                label="CURP" 
                name="curp" 
                placeholder="18 caracteres" 
                maxLength="18"
                required={true} 
                value={formData.curp}
                error={errores.curp}
                onChange={handleInputChange}
              />
              <InputGroup 
                label="Estado Civil" 
                name="estado_civil" 
                options={['Soltero(a)', 'Casado(a)', 'Divorciado(a)', 'Viudo(a)', 'Prefiero no decir']} 
                required={true} 
                value={formData.estado_civil}
                error={errores.estado_civil}
                onChange={handleInputChange}
              />
            </>
          )}
        </div>
      </div>
    );
  };

  const renderStep2 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-cyan-900/20 border border-cyan-500/30 p-4 rounded-xl flex gap-4 mb-6">
        <ShieldCheck className="w-8 h-8 text-cyan-400 shrink-0" />
        <p className="text-sm text-cyan-100/80">Tus datos están protegidos. Requerimos esta información para cumplir con la ley antilavado (PLD) y generar tus contratos legales de inversión.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InputGroup 
          label="RFC (con homoclave)" 
          name="rfc" 
          placeholder="ABCD123456XYZ" 
          maxLength="13"
          required 
          value={formData.rfc}
          error={errores.rfc}
          onChange={handleInputChange}
        />
        
        {/* ========================================== */}
        {/* SECCIÓN DE DIRECCIÓN ESTRUCTURADA */}
        {/* ========================================== */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Dirección Fiscal Completa <span className="text-red-500">*</span>
          </label>
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-xl border bg-black/20 ${errores.direccion ? 'border-red-500/50' : 'border-gray-800'}`}>
            
            <div className="md:col-span-2">
              <input type="text" name="calle" value={direccionParts.calle} onChange={handleDireccionChange} disabled={isSubmitting} placeholder="Calle (Ej. Av. Insurgentes)" className="w-full p-2.5 bg-[#0f172a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <input type="text" name="numExt" value={direccionParts.numExt} onChange={handleDireccionChange} disabled={isSubmitting} placeholder="N° Ext" className="w-full p-2.5 bg-[#0f172a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors" />
              <input type="text" name="numInt" value={direccionParts.numInt} onChange={handleDireccionChange} disabled={isSubmitting} placeholder="N° Int (Opc.)" className="w-full p-2.5 bg-[#0f172a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors" />
            </div>
            
            <div className="grid grid-cols-5 gap-4">
              <input type="text" name="cp" value={direccionParts.cp} onChange={handleDireccionChange} disabled={isSubmitting} placeholder="C.P." maxLength="5" className="col-span-2 w-full p-2.5 bg-[#0f172a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors" />
              <input type="text" name="colonia" value={direccionParts.colonia} onChange={handleDireccionChange} disabled={isSubmitting} placeholder="Colonia / Fracc." className="col-span-3 w-full p-2.5 bg-[#0f172a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors" />
            </div>
            
            <div>
              <select name="estado" value={direccionParts.estado} onChange={handleDireccionChange} disabled={isSubmitting} className="w-full p-2.5 bg-[#0f172a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 appearance-none transition-colors">
                <option value="" className="text-gray-500">Selecciona un Estado...</option>
                {ESTADOS_MEXICO.map(estado => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </select>
            </div>
            
            <div>
              <input type="text" name="ciudad" value={direccionParts.ciudad} onChange={handleDireccionChange} disabled={isSubmitting} placeholder="Ciudad (Ej. Tepic)" className="w-full p-2.5 bg-[#0f172a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors" />
            </div>
          </div>
          
          {errores.direccion && <p className="text-red-500 text-xs mt-2">{errores.direccion}</p>}
        </div>
      </div>

      {/* Aviso Estricto solo para Persona Moral */}
      {formData.tipo_inversionista === 'Moral' && (
        <div className="bg-red-900/20 border-l-4 border-red-500 p-5 rounded-r-xl mb-8 mt-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h4 className="text-red-400 font-bold uppercase tracking-wider text-sm">
              Requisito estricto para Persona Moral
            </h4>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">
            Por motivos legales, todos los documentos de la empresa <span className="text-white font-bold">(Acta Constitutiva, Poder, etc.)</span> deben subirse <strong>digitalizados mediante escáner</strong>. No se aceptarán fotografías tomadas con el celular.
          </p>
        </div>
      )}

      <div className="border-t border-gray-800 pt-6 mt-6">
        <h3 className="text-lg font-bold text-white mb-4">Carga de Documentos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FileUpload label="Identificación Oficial (INE/Pasaporte)" name="doc_identificacion" required file={formData.doc_identificacion} error={errores.doc_identificacion} onChange={handleFileChange} />
          <FileUpload label="Constancia de Situación Fiscal (Actualizada)" name="doc_constancia_fiscal" required file={formData.doc_constancia_fiscal} error={errores.doc_constancia_fiscal} onChange={handleFileChange} />
          <FileUpload label="Comprobante de Domicilio (Menor a 3 meses)" name="doc_comprobante_domicilio" required file={formData.doc_comprobante_domicilio} error={errores.doc_comprobante_domicilio} onChange={handleFileChange} />
          
          {/* Documentos extra si es Persona Moral */}
          {formData.tipo_inversionista === 'Moral' && (
            <>
              <FileUpload label="Acta Constitutiva" name="doc_acta_constitutiva" required file={formData.doc_acta_constitutiva} error={errores.doc_acta_constitutiva} onChange={handleFileChange} />
              <FileUpload label="Poder Legal del Representante" name="doc_poder_legal" required file={formData.doc_poder_legal} error={errores.doc_poder_legal} onChange={handleFileChange} />
              <FileUpload label="Identificación del Representante Legal" name="doc_id_representante" required file={formData.doc_id_representante} error={errores.doc_id_representante} onChange={handleFileChange} />
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-emerald-900/20 border border-emerald-500/30 p-4 rounded-xl flex gap-4 mb-6">
        <Landmark className="w-8 h-8 text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-100/80">Aquí depositaremos tus rendimientos mensuales. La cuenta debe estar a nombre del titular o razón social registrada en el paso 1.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InputGroup 
          label="Institución Bancaria" 
          name="banco" 
          options={BANCOS_MEXICO}
          required 
          value={formData.banco}
          error={errores.banco}
          onChange={handleInputChange}
          disabled={isSubmitting}
        />
        <InputGroup 
          label="Cuenta CLABE (18 dígitos)" 
          name="clabe" 
          placeholder="000000000000000000" 
          maxLength="18"
          required 
          value={formData.clabe}
          error={errores.clabe}
          onChange={handleInputChange}
        />
        <InputGroup 
          label="Número de Cuenta (Opcional)" 
          name="cuenta_bancaria" 
          placeholder="Número de cuenta" 
          value={formData.cuenta_bancaria}
          error={errores.cuenta_bancaria}
          onChange={handleInputChange}
        />
        <InputGroup 
          label="Nombre en la Cuenta" 
          name="nombre_cuenta_banco" 
          placeholder="Nombre completo del titular" 
          required={true}
          value={formData.nombre_cuenta_banco}
          error={errores.nombre_cuenta_banco}
          onChange={handleInputChange}
        />
      </div>

      <div className="border-t border-gray-800 pt-6 mt-6">
        <FileUpload 
          label="Estado de Cuenta / Carátula (Para verificar CLABE)" 
          name="doc_cuenta_banco" 
          required
          file={formData.doc_cuenta_banco} 
          error={errores.doc_cuenta_banco} 
          onChange={handleFileChange} 
        />
      </div>
    </div>
  );

  // Pantalla de Éxito
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0b1120] flex items-center justify-center p-4">
        <div className="bg-[#121c2d] border border-emerald-500/30 max-w-lg w-full rounded-3xl p-10 text-center shadow-2xl">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-3xl font-black text-white mb-4">¡Solicitud Enviada!</h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Hemos recibido tus datos correctamente. Nuestro equipo de asesores revisará tu información (Validación PLD) y se pondrá en contacto contigo muy pronto para los siguientes pasos.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-8 rounded-xl transition-colors w-full"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07425E] flex flex-col items-center py-12 px-4 sm:px-6">
      
      {/* HEADER PORTAL */}
      <img src={logo} alt="Logo" className="h-20 w-auto" />
      <p className="text-3xl sm:text-4xl text-white mb-3">AutoManager</p>
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Portal de Inversionistas</h1>
        <p className="text-gray-400 max-w-xl mx-auto">Completa tu solicitud para unirte a nuestra red de socios. Este proceso toma menos de 5 minutos.</p>
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="bg-[#121c2d] border border-gray-800 shadow-2xl w-full max-w-4xl rounded-3xl overflow-hidden">
        
        {/* STEPPER INDICATOR */}
        <div className="bg-black/20 border-b border-gray-800 p-6">
          <div className="flex items-center justify-between max-w-2xl mx-auto relative">
            <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-800 -z-10 transform -translate-y-1/2"></div>
            <div className={`absolute top-1/2 left-0 h-1 bg-cyan-500 transition-all duration-500 -z-10 transform -translate-y-1/2`} style={{ width: `${((currentStep - 1) / 2) * 100}%` }}></div>

            <div className="flex flex-col items-center gap-2 bg-[#121c2d] px-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-colors ${currentStep >= 1 ? 'bg-cyan-500 border-cyan-500 text-white' : 'bg-[#0f172a] border-gray-700 text-gray-500'}`}>
                <User className="w-5 h-5" />
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider hidden sm:block ${currentStep >= 1 ? 'text-cyan-400' : 'text-gray-500'}`}>Perfil</span>
            </div>
            
            <div className="flex flex-col items-center gap-2 bg-[#121c2d] px-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-colors ${currentStep >= 2 ? 'bg-cyan-500 border-cyan-500 text-white' : 'bg-[#0f172a] border-gray-700 text-gray-500'}`}>
                <Building className="w-5 h-5" />
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider hidden sm:block ${currentStep >= 2 ? 'text-cyan-400' : 'text-gray-500'}`}>Fiscales</span>
            </div>

            <div className="flex flex-col items-center gap-2 bg-[#121c2d] px-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-colors ${currentStep >= 3 ? 'bg-cyan-500 border-cyan-500 text-white' : 'bg-[#0f172a] border-gray-700 text-gray-500'}`}>
                <Landmark className="w-5 h-5" />
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider hidden sm:block ${currentStep >= 3 ? 'text-cyan-400' : 'text-gray-500'}`}>Bancarios</span>
            </div>
          </div>
        </div>

        {/* CONTENIDO DEL FORMULARIO */}
        <div className="p-6 sm:p-10">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        {/* FOOTER BTONES */}
        <div className="bg-black/20 border-t border-gray-800 p-6 flex items-center justify-between">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors ${currentStep === 1 ? 'opacity-0 cursor-default' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            <ChevronLeft className="w-5 h-5" /> Atrás
          </button>
          
          {currentStep < 3 ? (
            <button
              onClick={nextStep}
              disabled={isValidating}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-[0_0_15px_rgba(8,145,178,0.4)]"
            >
              {isValidating ? (
                <>Verificando... <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div></>
              ) : (
                <>Siguiente <ChevronRight className="w-5 h-5" /></>
              )}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-[0_0_15px_rgba(5,150,105,0.4)] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>Enviando... <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div></>
              ) : (
                <>Finalizar Solicitud <CheckCircle className="w-5 h-5" /></>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default PortalSolicitudInversionista;