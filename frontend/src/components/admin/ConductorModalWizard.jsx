// frontend/src/components/admin/ConductorModalWizard.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  User,
  FileText,
  Car,
  CheckCircle,
  Upload,
  AlertCircle,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Shield,
  MessageCircle,
  DollarSign,
  TrendingUp,
  Clock,
  Camera,
  File,
  Check,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

// Componente para upload de archivos con preview
const FileUploadZone = ({ label, accept, value, onChange, required = false, helpText }) => {
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (file) => {
    if (file) {
      onChange(file);
      
      // Crear preview si es imagen
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && accept.includes(file.type)) {
      handleFileChange(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      
      <div
        className={`relative border-2 border-dashed rounded-lg p-4 transition-all cursor-pointer
          ${isDragging 
            ? 'border-cyan-400 bg-cyan-500/10' 
            : 'border-white/20 hover:border-white/30 bg-white/5'
          }
          ${value ? 'bg-green-500/10 border-green-500/30' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={(e) => handleFileChange(e.target.files[0])}
          className="hidden"
        />
        
        <div className="flex flex-col items-center justify-center">
          {preview ? (
            <div className="relative">
              <img src={preview} alt="Preview" className="max-h-32 rounded-lg" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreview(null);
                  onChange(null);
                }}
                className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : value ? (
            <div className="flex items-center gap-3">
              <File className="w-8 h-8 text-green-400" />
              <div className="text-left">
                <p className="text-sm text-white font-medium">{value.name}</p>
                <p className="text-xs text-gray-400">{(value.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-300">
                Arrastra un archivo o haz clic para seleccionar
              </p>
            </>
          )}
        </div>
      </div>
      
      {helpText && (
        <p className="text-xs text-gray-400">{helpText}</p>
      )}
    </div>
  );
};

// Componente principal del Modal Wizard
const ConductorModalWizard = ({ isOpen, onClose, conductor, onSubmit }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Estado del formulario - USAR SNAKE_CASE para coincidir con PostgreSQL
  const [formData, setFormData] = useState({
    // Paso 1: Información Personal
    nombre_conductor: '',
    numero_telefono: '',
    email: '',
    direccion_completa: '',
    curp: '',
    fecha_nacimiento: '',
    estado_civil: '',
    contacto_emergencia: '',
    telefono_emergencia: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    fecha_registro: new Date().toISOString().split('T')[0],
    deposito: 0,
    
    // Paso 2: Documentación
    rfc: '',
    numero_de_ine_ife: '',
    licencia_conducir: '',
    licencia_vigencia: '',
    seguro_vehiculo_vencimiento: '',
    // Archivos
    ine_frente: null,
    ine_reverso: null,
    licencia_frente: null,
    licencia_reverso: null,
    comprobante_domicilio: null,
    
    // Paso 3: Configuración de Trabajo
    status: 'Pendiente',
    status_trabajo: 'desconectado',
    categoria: '',
    chat_id_telegram: '',
    username_telegram: '',
    bot_configurado: false,
    vehiculo_asignado: '',
    zona_trabajo: '',
    horario_preferido: '',
    tipo_socio: '',
    
    // Paso 4: Métricas y Finanzas
    saldo_ganancias: 0,
    tasa_aceptacion: 0,
    tasa_cancelacion: 0,
    tasa_completacion: 0,
    calificacion_promedio: 0,
    total_viajes: 0,
    horas_trabajadas: 0,
    ingreso_promedio_diario: 0,
    
    // Polizas y billetera
    tipo_poliza: 'POLIZA_100',
    saldo_poliza_mecanica: 50000,
    total_aportado_poliza: 0,
    saldo_billetera_digital: 0,
    saldo_ahorro_mantenimiento: 0,
    usa_uniforme: false,
    
    // Observaciones
    observaciones: ''
  });

  const sanitizePhoneNumber = (phone) => phone?.toString().replace(/\D/g, '') || '';

  const getEmailForSubmission = (data = formData) => {
    const providedEmail = data.email?.trim();
    if (providedEmail) return providedEmail.toLowerCase();

    const phoneLocalPart = sanitizePhoneNumber(data.numero_telefono);
    if (!phoneLocalPart) return '';

    return `${phoneLocalPart}@driver.automanager.com`;
  };

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  // Inicializar con datos existentes si es edición
useEffect(() => {
  if (conductor) {
    console.log('📝 Cargando conductor para edición:', conductor);
    
    setFormData(prev => ({
      ...prev,
      // ========== PASO 1: INFORMACIÓN PERSONAL ==========
      nombre_conductor: conductor.nombre_conductor || '',
      numero_telefono: conductor.numero_telefono || '',
      email: conductor.email || '',
      direccion_completa: conductor.direccion_completa || '',
      curp: conductor.curp || '',
      fecha_nacimiento: conductor.fecha_nacimiento?.split('T')[0] || '',
      estado_civil: conductor.estado_civil || '',
      contacto_emergencia: conductor.contacto_emergencia || '',
      telefono_emergencia: conductor.telefono_emergencia || '',
      fecha_ingreso: conductor.fecha_ingreso?.split('T')[0] || new Date().toISOString().split('T')[0],
      fecha_registro: conductor.fecha_registro?.split('T')[0] || new Date().toISOString().split('T')[0],
      deposito: conductor.deposito || 0,
      
      // ========== PASO 2: DOCUMENTACIÓN ==========
      rfc: conductor.rfc || '',
      numero_de_ine_ife: conductor.numero_de_ine_ife || '',
      licencia_conducir: conductor.licencia_conducir || '',
      licencia_vigencia: conductor.licencia_vigencia?.split('T')[0] || '',
      seguro_vehiculo_vencimiento: conductor.seguro_vehiculo_vencimiento?.split('T')[0] || '',
      // Archivos (no se pueden pre-cargar, son nuevos uploads)
      
      // ========== PASO 3: CONFIGURACIÓN - 🔥 ESTOS FALTABAN ==========
      status: conductor.status || 'Pendiente',
      status_trabajo: conductor.status_trabajo || 'desconectado',
      categoria: conductor.categoria || '',
      tipo_socio: conductor.tipo_socio || '',
      zona_trabajo: conductor.zona_trabajo || '', // 🔥 CRÍTICO - FALTABA
      horario_preferido: conductor.horario_preferido || '', // 🔥 CRÍTICO - FALTABA
      
      // Telegram
      chat_id_telegram: conductor.chat_id_telegram || '',
      username_telegram: conductor.username_telegram || '',
      bot_configurado: conductor.bot_configurado || false,
      vehiculo_asignado: conductor.vehiculo_asignado || '',
      
      // ========== PASO 4: MÉTRICAS Y FINANZAS ==========
      saldo_ganancias: conductor.saldo_ganancias || 0,
      tasa_aceptacion: conductor.tasa_aceptacion || 0,
      tasa_cancelacion: conductor.tasa_cancelacion || 0,
      tasa_completacion: conductor.tasa_completacion || 0,
      calificacion_promedio: conductor.calificacion_promedio || 0,
      total_viajes: conductor.total_viajes || 0,
      horas_trabajadas: conductor.horas_trabajadas || 0,
      ingreso_promedio_diario: conductor.ingreso_promedio_diario || 0,
      
      // Pólizas y billetera
      tipo_poliza: conductor.tipo_poliza || 'POLIZA_100',
      saldo_poliza_mecanica: conductor.saldo_poliza_mecanica || 50000,
      total_aportado_poliza: conductor.total_aportado_poliza || 0,
      saldo_billetera_digital: conductor.saldo_billetera_digital || 0,
      saldo_ahorro_mantenimiento: conductor.saldo_ahorro_mantenimiento || 0,
      usa_uniforme: conductor.usa_uniforme || false,
      
      // Observaciones
      observaciones: conductor.observaciones || ''
    }));
    
    console.log('✅ FormData inicializado con datos del conductor');
  } else {
    console.log('🆕 Creando nuevo conductor - usando valores por defecto');
  }
}, [conductor]);

  const steps = [
    {
      id: 1,
      title: 'Información Personal',
      icon: User,
      description: 'Datos básicos del conductor'
    },
    {
      id: 2,
      title: 'Documentación',
      icon: FileText,
      description: 'Documentos legales y verificación'
    },
    {
      id: 3,
      title: 'Configuración',
      icon: Car,
      description: 'Asignación y configuración de trabajo'
    },
    {
      id: 4,
      title: 'Métricas',
      icon: TrendingUp,
      description: 'Desempeño y finanzas'
    }
  ];

  const validateStep = (step) => {
    const newErrors = {};
    
    console.log('🔍 Validando paso:', step);
    console.log('📋 Datos del formulario:', formData);
    
    switch (step) {
      case 1:
        if (!formData.nombre_conductor?.trim()) {
          newErrors.nombre_conductor = 'Nombre requerido';
        }
        if (!formData.numero_telefono?.trim()) {
          newErrors.numero_telefono = 'Teléfono requerido';
        }
        const finalEmail = getEmailForSubmission(formData);
        if (!finalEmail) {
          newErrors.email = 'Email requerido. Si el conductor no tiene, se generará uno temporal con el teléfono';
        } else if (formData.email?.trim() && !/\S+@\S+\.\S+/.test(formData.email.trim())) {
          newErrors.email = 'Email inválido';
        }
        break;
        
      case 2:
        // Los documentos son OPCIONALES - No bloquear avance
        console.log('✅ Paso 2: Documentos opcionales');
        
        // Solo validar formato si el campo tiene valor
        if (formData.rfc && formData.rfc.length !== 13) {
          newErrors.rfc = 'RFC debe tener 13 caracteres';
        }
        if (formData.curp && formData.curp.length !== 18) {
          newErrors.curp = 'CURP debe tener 18 caracteres';
        }
        if (!formData.rfc?.trim()) {
          newErrors.rfc = 'RFC requerido';
        }
        if (!formData.licencia_conducir?.trim()) {
          newErrors.licencia_conducir = 'Licencia conducir requerida';
        }
        if (!formData.licencia_vigencia?.trim()) {
          newErrors.licencia_vigencia = 'Licencia vigencia requerida';
        }
        break;
        
      case 3:
        // Configuración - todo opcional
        console.log('✅ Paso 3: Configuración - todo opcional');
        break;
        
      case 4:
        // Métricas - todo opcional
        console.log('✅ Paso 4: Métricas - todo opcional');
        break;
    }
    
    console.log('❌ Errores encontrados:', newErrors);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    console.log('🔘 Botón SIGUIENTE presionado');
    console.log('📍 Paso actual:', currentStep);
    console.log('📋 FormData actual:', formData);
    
    const isValid = validateStep(currentStep);
    console.log('✅ ¿Validación exitosa?', isValid);
    
    if (isValid && currentStep < steps.length) {
      console.log('➡️ Avanzando al paso:', currentStep + 1);
      setCurrentStep(currentStep + 1);
    } else {
      console.log('⚠️ No se puede avanzar. Errores:', errors);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    setIsSubmitting(true);
    try {
      const finalEmail = getEmailForSubmission(formData);
      if (!finalEmail) {
        throw new Error('Debes capturar un email o un teléfono para generar uno temporal');
      }

      // Crear FormData para manejar archivos
      const dataToSubmit = new FormData();
      
      // Agregar todos los campos NO-archivo
      Object.keys(formData).forEach(key => {
        const value = formData[key];
        
        // Detectar si es un archivo (tiene propiedad 'name' y 'size')
        const isFile = value && typeof value === 'object' && 'name' in value && 'size' in value;
        
        if (isFile) {
          // Es un archivo, agregarlo como File
          dataToSubmit.append(key, value);
        } else if (value !== null && value !== undefined && value !== '') {
          // Es un valor normal, convertir a string
          dataToSubmit.append(key, String(value));
        }
      });

      // Asegurar que siempre enviamos un email (real o temporal)
      dataToSubmit.set('email', finalEmail);
      
      
      // Log para debugging
      console.log('Datos a enviar:');
      for (let pair of dataToSubmit.entries()) {
        console.log(pair[0], pair[1]);
      }
       // 🔥 AGREGAR ESTE LOG
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 DATOS QUE SE VAN A ENVIAR:');
    for (let pair of dataToSubmit.entries()) {
      console.log(`   ${pair[0]}: ${pair[1]}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      await onSubmit(dataToSubmit);
      onClose();
    } catch (error) {
      console.error('Error al guardar conductor:', error);
      setErrors({ submit: error.message || 'Error al guardar conductor' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nombre Completo *
          </label>
          <input
            type="text"
            value={formData.nombre_conductor}
            onChange={(e) => setFormData({...formData, nombre_conductor: e.target.value})}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
            placeholder="Nombre completo del conductor"
          />
          {errors.nombre_conductor && (
            <p className="text-red-400 text-xs mt-1">{errors.nombre_conductor}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Teléfono *
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="tel"
              value={formData.numero_telefono}
              onChange={(e) => setFormData({...formData, numero_telefono: e.target.value})}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              placeholder="+52 311 123 4567"
            />
          </div>
          {errors.numero_telefono && (
            <p className="text-red-400 text-xs mt-1">{errors.numero_telefono}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email *
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              placeholder="conductor@email.com"
            />
          </div>
          {errors.email && (
            <p className="text-red-400 text-xs mt-1">{errors.email}</p>
          )}
          {!errors.email && (
            <p className="text-xs text-gray-400 mt-1">
              Este correo será el usuario de acceso. Si el conductor no tiene, se generará uno temporal con su teléfono.
            </p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Dirección Completa
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={formData.direccion_completa}
              onChange={(e) => setFormData({...formData, direccion_completa: e.target.value})}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              placeholder="Calle, Número, Colonia, Ciudad"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Fecha de Nacimiento
          </label>
          <input
            type="date"
            value={formData.fecha_nacimiento}
            onChange={(e) => setFormData({...formData, fecha_nacimiento: e.target.value})}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            CURP
          </label>
          <input
            type="text"
            value={formData.curp}
            onChange={(e) => setFormData({...formData, curp: e.target.value.toUpperCase()})}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            placeholder="ABCD123456HMNXYZ00"
            maxLength="18"
          />
          {errors.curp && (
            <p className="text-red-400 text-xs mt-1">{errors.curp}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Estado Civil
          </label>
          <select
            value={formData.estado_civil || ''}
            onChange={(e) => setFormData({...formData, estado_civil: e.target.value})}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <option value="">Seleccionar</option>
            <option value="Soltero">Soltero(a)</option>
            <option value="Casado">Casado(a)</option>
            <option value="Divorciado">Divorciado(a)</option>
            <option value="Viudo">Viudo(a)</option>
            <option value="Union Libre">Unión Libre</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Contacto de Emergencia
          </label>
          <input
            type="text"
            value={formData.contacto_emergencia}
            onChange={(e) => setFormData({...formData, contacto_emergencia: e.target.value})}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            placeholder="Nombre del contacto"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Teléfono de Emergencia
          </label>
          <input
            type="tel"
            value={formData.telefono_emergencia}
            onChange={(e) => setFormData({...formData, telefono_emergencia: e.target.value})}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            placeholder="+52 311 123 4567"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Depósito Inicial
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="number"
              value={formData.deposito}
              onChange={(e) => setFormData({...formData, deposito: parseFloat(e.target.value) || 0})}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              step="100"
              min="0"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            RFC *
          </label>
          <input
            type="text"
            value={formData.rfc}
            onChange={(e) => setFormData({...formData, rfc: e.target.value.toUpperCase()})}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            placeholder="ABCD123456789"
            maxLength="13"
          />
          {errors.rfc && (
            <p className="text-red-400 text-xs mt-1">{errors.rfc}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Número de INE/IFE
          </label>
          <input
            type="text"
            value={formData.numero_de_ine_ife}
            onChange={(e) => setFormData({...formData, numero_de_ine_ife: e.target.value})}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            placeholder="1234567890123"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Número de Licencia *
          </label>
          <input
            type="text"
            value={formData.licencia_conducir}
            onChange={(e) => setFormData({...formData, licencia_conducir: e.target.value})}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            placeholder="Número de licencia"
          />
          {errors.licencia_conducir && (
            <p className="text-red-400 text-xs mt-1">{errors.licencia_conducir}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Vencimiento de Licencia *
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="date"
              value={formData.licencia_vigencia}
              onChange={(e) => setFormData({...formData, licencia_vigencia: e.target.value})}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
            {errors.licencia_vigencia && (
              <p className="text-red-400 text-xs mt-1">{errors.licencia_vigencia}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Vencimiento Seguro Vehículo
          </label>
          <div className="relative">
            <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="date"
              value={formData.seguro_vehiculo_vencimiento}
              onChange={(e) => setFormData({...formData, seguro_vehiculo_vencimiento: e.target.value})}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 pt-6">
        <h4 className="text-lg font-medium text-white mb-4">Documentos Digitales</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileUploadZone
            label="INE - Frente"
            accept="image/*"
            value={formData.ine_frente}
            onChange={(file) => setFormData({...formData, ine_frente: file})}
            helpText="Foto clara del frente de la INE"
          />
          
          <FileUploadZone
            label="INE - Reverso"
            accept="image/*"
            value={formData.ine_reverso}
            onChange={(file) => setFormData({...formData, ine_reverso: file})}
            helpText="Foto clara del reverso de la INE"
          />
          
          <FileUploadZone
            label="Licencia - Frente"
            accept="image/*"
            value={formData.licencia_frente}
            onChange={(file) => setFormData({...formData, licencia_frente: file})}
            helpText="Foto clara del frente de la licencia"
          />
          
          <FileUploadZone
            label="Licencia - Reverso"
            accept="image/*"
            value={formData.licencia_reverso}
            onChange={(file) => setFormData({...formData, licencia_reverso: file})}
            helpText="Foto clara del reverso de la licencia"
          />
          
          <div className="md:col-span-2">
            <FileUploadZone
              label="Comprobante de Domicilio"
              accept="image/*,application/pdf"
              value={formData.comprobante_domicilio}
              onChange={(file) => setFormData({...formData, comprobante_domicilio: file})}
              helpText="Recibo de luz, agua, teléfono o estado de cuenta bancario (no mayor a 3 meses)"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Estado del Conductor
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({...formData, status: e.target.value})}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <option value="Pendiente">Pendiente</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
            <option value="Suspendido">Suspendido</option>
            <option value="Rechazado">Rechazado</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Estado de Trabajo
          </label>
          <select
            value={formData.status_trabajo}
            onChange={(e) => setFormData({...formData, status_trabajo: e.target.value})}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <option value="desconectado">Desconectado</option>
            <option value="conectado">Conectado</option>
            <option value="en_servicio">En Servicio</option>
            <option value="ocupado">Ocupado</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Categoría
          </label>
          <select
            value={formData.categoria}
            onChange={(e) => setFormData({...formData, categoria: e.target.value})}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <option value="">Sin categoría</option>
            <option value="Bronce">Bronce</option>
            <option value="Plata">Plata</option>
            <option value="Oro">Oro</option>
            <option value="Platino">Platino</option>
            <option value="Diamante">Diamante</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tipo de Socio
          </label>
          <select
            value={formData.tipo_socio}
            onChange={(e) => setFormData({...formData, tipo_socio: e.target.value})}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <option value="">Seleccionar</option>
            <option value="SD">SD - Socio Dueño</option>
            <option value="SI">SI - Socio Inversionista</option>
            <option value="SA">SA - Socio Asalariado</option>
            <option value="EXTERNO">Externo</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Zona de Trabajo
          </label>
          <input
            type="text"
            value={formData.zona_trabajo}
            onChange={(e) => setFormData({...formData, zona_trabajo: e.target.value})}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            placeholder="Centro, Norte, Sur..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Horario Preferido
          </label>
          <select
            value={formData.horario_preferido}
            onChange={(e) => setFormData({...formData, horario_preferido: e.target.value})}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <option value="">Sin preferencia</option>
            <option value="Matutino">Matutino (6:00 - 14:00)</option>
            <option value="Vespertino">Vespertino (14:00 - 22:00)</option>
            <option value="Nocturno">Nocturno (22:00 - 6:00)</option>
            <option value="Mixto">Mixto</option>
          </select>
        </div>
      </div>

      <div className="border-t border-white/10 pt-6">
        <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-cyan-400" />
          Configuración Telegram
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Chat ID Telegram
            </label>
            <input
              type="text"
              value={formData.chat_id_telegram}
              onChange={(e) => setFormData({...formData, chat_id_telegram: e.target.value})}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              placeholder="123456789"
              disabled={conductor}
            />
            {conductor && (
              <p className="text-xs text-gray-400 mt-1">Se genera automáticamente al conectar con el bot</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Username Telegram
            </label>
            <input
              type="text"
              value={formData.username_telegram}
              onChange={(e) => setFormData({...formData, username_telegram: e.target.value})}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              placeholder="@usuario"
            />
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.bot_configurado}
                onChange={(e) => setFormData({...formData, bot_configurado: e.target.checked})}
                className="w-5 h-5 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500/50"
              />
              <span className="text-sm text-gray-300">Bot de Telegram configurado y activo</span>
            </label>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 pt-6">
        <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-400" />
          Configuración de Póliza
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tipo de Póliza
            </label>
            <select
              value={formData.tipo_poliza}
              onChange={(e) => setFormData({...formData, tipo_poliza: e.target.value})}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <option value="POLIZA_100">Póliza 100%</option>
              <option value="POLIZA_50">Póliza 50%</option>
              <option value="SIN_POLIZA">Sin Póliza</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer mt-8">
              <input
                type="checkbox"
                checked={formData.usa_uniforme}
                onChange={(e) => setFormData({...formData, usa_uniforme: e.target.checked})}
                className="w-5 h-5 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500/50"
              />
              <span className="text-sm text-gray-300">Usa uniforme de la empresa</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Saldo de Ganancias
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="number"
              value={formData.saldo_ganancias}
              onChange={(e) => setFormData({...formData, saldo_ganancias: parseFloat(e.target.value) || 0})}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              step="0.01"
              min="0"
              disabled={conductor}
            />
          </div>
          {conductor && (
            <p className="text-xs text-gray-400 mt-1">Se calcula automáticamente</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Billetera Digital
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="number"
              value={formData.saldo_billetera_digital}
              onChange={(e) => setFormData({...formData, saldo_billetera_digital: parseFloat(e.target.value) || 0})}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              step="0.01"
              min="0"
              disabled={conductor}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Ahorro Mantenimiento
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="number"
              value={formData.saldo_ahorro_mantenimiento}
              onChange={(e) => setFormData({...formData, saldo_ahorro_mantenimiento: parseFloat(e.target.value) || 0})}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              step="0.01"
              min="0"
              disabled={conductor}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 pt-6">
        <h4 className="text-lg font-medium text-white mb-4">Métricas de Desempeño</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tasa de Aceptación
            </label>
            <div className="relative">
              <input
                type="number"
                value={formData.tasa_aceptacion}
                onChange={(e) => setFormData({...formData, tasa_aceptacion: parseFloat(e.target.value) || 0})}
                className="w-full pr-8 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                min="0"
                max="100"
                step="0.1"
                disabled={conductor}
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tasa de Cancelación
            </label>
            <div className="relative">
              <input
                type="number"
                value={formData.tasa_cancelacion}
                onChange={(e) => setFormData({...formData, tasa_cancelacion: parseFloat(e.target.value) || 0})}
                className="w-full pr-8 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                min="0"
                max="100"
                step="0.1"
                disabled={conductor}
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tasa de Completación
            </label>
            <div className="relative">
              <input
                type="number"
                value={formData.tasa_completacion}
                onChange={(e) => setFormData({...formData, tasa_completacion: parseFloat(e.target.value) || 0})}
                className="w-full pr-8 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                min="0"
                max="100"
                step="0.1"
                disabled={conductor}
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Calificación Promedio
            </label>
            <div className="relative">
              <input
                type="number"
                value={formData.calificacion_promedio}
                onChange={(e) => setFormData({...formData, calificacion_promedio: parseFloat(e.target.value) || 0})}
                className="w-full pr-12 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                min="0"
                max="5"
                step="0.1"
                disabled={conductor}
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">/5.0</span>
            </div>
            {conductor && (
              <p className="text-xs text-gray-400 mt-1">Se calcula automáticamente</p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 pt-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Observaciones / Notas
        </label>
        <textarea
          value={formData.observaciones}
          onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          rows="4"
          placeholder="Notas adicionales sobre el conductor..."
        />
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-white/10">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 px-6 py-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              {conductor ? 'Editar Conductor' : 'Nuevo Conductor'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                          : isCompleted
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-white/5 text-gray-400 border border-white/10'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <span className={`text-xs mt-2 ${isActive ? 'text-white' : 'text-gray-400'}`}>
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-24 h-0.5 mx-2 transition-all ${
                        currentStep > step.id
                          ? 'bg-green-500/50'
                          : 'bg-white/10'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 250px)' }}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/20">
          {errors.submit && (
            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {errors.submit}
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            
            <div className="flex items-center gap-3">
              {currentStep > 1 && (
                <button
                  onClick={handlePrevious}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-all border border-white/10"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
              )}
              
              {currentStep < steps.length ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg"
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      {conductor ? 'Actualizar' : 'Crear'} Conductor
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConductorModalWizard;
