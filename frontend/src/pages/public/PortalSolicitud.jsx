import React, { useState, useMemo } from 'react';
import { 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  Phone, 
  User, 
  Home, 
  Users, 
  FileText, 
  Car,
  Upload,
  Camera,
  X,
  Calendar,
  MapPin,
  Briefcase,
  Shield,
  AlertCircle,
  Heart,
  UserCheck
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const PortalSolicitud = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitFeedback, setSubmitFeedback] = useState(null);
  const [imagesPreviews, setImagesPreviews] = useState({
    licencia_frente: null,
    licencia_reverso: null,
    ine_frente: null,
    ine_reverso: null,
    comprobante_domicilio: null
  });

  const [formData, setFormData] = useState({
    // Paso 1: Contacto Inicial
    nombre_completo: '',
    telefono: '',
    email: '',
    
    // Paso 2: Información Personal
    dia_nacimiento: '',
    mes_nacimiento: '',
    anio_nacimiento: '',
    curp: '',
    domicilio: '',
    estado_civil: '',
    tiene_responsabilidad_familiar: false,
    
    // Paso 3: Estabilidad y Experiencia
    tipo_vivienda: '',
    tiempo_renta_actual: '',
    experiencia_taxi: false,
    ultimo_empleo: '',
    
    // Paso 4: Referencias Familiares
    referencia_familiar_1_nombre: '',
    referencia_familiar_1_telefono: '',
    referencia_familiar_1_cohabita: false,
    referencia_familiar_2_nombre: '',
    referencia_familiar_2_telefono: '',
    
    // Paso 5: Documentación
    licencia_frente: null,
    licencia_reverso: null,
    ine_frente: null,
    ine_reverso: null,
    comprobante_domicilio: null,

    // Paso 6: Cita y depósito
    acepta_deposito_garantia: '',
    fecha_cita: ''
  });

  const steps = [
    { number: 1, title: 'Contacto', icon: Phone, description: 'Información básica' },
    { number: 2, title: 'Personal', icon: User, description: 'Datos personales' },
    { number: 3, title: 'Experiencia', icon: Briefcase, description: 'Estabilidad laboral' },
    { number: 4, title: 'Referencias', icon: Users, description: 'Contactos familiares' },
    { number: 5, title: 'Documentos', icon: FileText, description: 'Subir archivos' },
    { number: 6, title: 'Cita', icon: Calendar, description: 'Deposito y agenda' }
  ];

  const meses = [
    { value: '01', label: 'Enero' },
    { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' },
    { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' }
  ];

  // Usar useMemo para evitar recálculos innecesarios
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 70;
    const endYear = currentYear - 18;
    const yearsList = [];
    
    for (let year = endYear; year >= startYear; year--) {
      yearsList.push(year);
    }
    return yearsList;
  }, []);

  // Calcular edad solo cuando los valores cambien
  const calculatedAge = useMemo(() => {
    if (formData.anio_nacimiento && formData.mes_nacimiento && formData.dia_nacimiento) {
      const birthDate = new Date(
        parseInt(formData.anio_nacimiento),
        parseInt(formData.mes_nacimiento) - 1,
        parseInt(formData.dia_nacimiento)
      );
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      return age;
    }
    return null;
  }, [formData.anio_nacimiento, formData.mes_nacimiento, formData.dia_nacimiento]);

  const todayDate = useMemo(() => new Date().toLocaleDateString('en-CA'), []);
  const minCitaDate = useMemo(() => {
    const date = new Date();
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() + 1);
    }
    return date.toLocaleDateString('en-CA');
  }, []);

  const esDiaHabil = (dateString) => {
    if (!dateString) return false;
    const date = new Date(`${dateString}T12:00:00`);
    const day = date.getDay();
    return day >= 1 && day <= 5;
  };

  const phoneRegex = /^\d{10}$/;
  const curpRegex = /^[A-Z0-9]{18}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const formatFechaCitaLegible = (fechaISO) => {
    if (!fechaISO || !/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) return '';
    const [year, month, day] = fechaISO.split('-').map(Number);
    const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (Number.isNaN(parsed.getTime())) return '';

    return parsed.toLocaleDateString('es-MX', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (submitFeedback && submitFeedback.type !== 'success') {
      setSubmitFeedback(null);
    }
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleFileChange = (field, event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, [field]: 'El archivo no debe superar 5MB' }));
        return;
      }

      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setErrors(prev => ({ ...prev, [field]: 'Solo se permiten imágenes JPG, PNG o WebP' }));
        return;
      }

      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagesPreviews(prev => ({
          ...prev,
          [field]: reader.result
        }));
        setFormData(prev => ({
          ...prev,
          [field]: file
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = (field) => {
    setFormData(prev => ({
      ...prev,
      [field]: null
    }));
    setImagesPreviews(prev => ({
      ...prev,
      [field]: null
    }));
  };

  const validateStep = (step) => {
    const newErrors = {};
    
    switch (step) {
      case 1:
        if (!formData.nombre_completo) newErrors.nombre_completo = 'El nombre es requerido';
        if (!formData.telefono) newErrors.telefono = 'El teléfono es requerido';
        if (formData.telefono && !phoneRegex.test(formData.telefono)) {
          newErrors.telefono = 'El teléfono debe tener 10 dígitos';
        }
        if (!formData.email) {
          newErrors.email = 'El email es requerido';
        } else if (!emailRegex.test(formData.email.trim().toLowerCase())) {
          newErrors.email = 'Ingresa un email valido';
        }
        break;
        
      case 2:
        if (!formData.dia_nacimiento || !formData.mes_nacimiento || !formData.anio_nacimiento) {
          newErrors.fecha_nacimiento = 'La fecha de nacimiento es requerida';
        } else if (calculatedAge < 23) {
          newErrors.fecha_nacimiento = 'Debes tener al menos 23 años';
        }
        if (!formData.domicilio) newErrors.domicilio = 'El domicilio es requerido';
        if (!formData.estado_civil) newErrors.estado_civil = 'El estado civil es requerido';
        if (formData.curp && !curpRegex.test(formData.curp)) {
          newErrors.curp = 'La CURP debe tener 18 caracteres alfanumericos';
        }
        break;
        
      case 3:
        if (!formData.tipo_vivienda) newErrors.tipo_vivienda = 'El tipo de vivienda es requerido';
        if (formData.tipo_vivienda === 'Rentada' && !formData.tiempo_renta_actual) {
          newErrors.tiempo_renta_actual = 'Indica el tiempo en tu domicilio actual';
        }
        break;
        
      case 4:
        if (!formData.referencia_familiar_1_nombre) {
          newErrors.referencia_familiar_1_nombre = 'El nombre de la referencia 1 es requerido';
        }
        if (!formData.referencia_familiar_1_telefono) {
          newErrors.referencia_familiar_1_telefono = 'El teléfono de la referencia 1 es requerido';
        } else if (!phoneRegex.test(formData.referencia_familiar_1_telefono)) {
          newErrors.referencia_familiar_1_telefono = 'La referencia 1 debe tener 10 digitos';
        }
        if (!formData.referencia_familiar_2_nombre) {
          newErrors.referencia_familiar_2_nombre = 'El nombre de la referencia 2 es requerido';
        }
        if (!formData.referencia_familiar_2_telefono) {
          newErrors.referencia_familiar_2_telefono = 'El teléfono de la referencia 2 es requerido';
        } else if (!phoneRegex.test(formData.referencia_familiar_2_telefono)) {
          newErrors.referencia_familiar_2_telefono = 'La referencia 2 debe tener 10 digitos';
        }
        break;
        
      case 5:
        if (!formData.licencia_frente) newErrors.licencia_frente = 'La foto del frente de la licencia es requerida';
        if (!formData.licencia_reverso) newErrors.licencia_reverso = 'La foto del reverso de la licencia es requerida';
        if (!formData.ine_frente) newErrors.ine_frente = 'La foto del frente del INE es requerida';
        if (!formData.ine_reverso) newErrors.ine_reverso = 'La foto del reverso del INE es requerida';
        break;

      case 6:
        if (!formData.acepta_deposito_garantia) {
          newErrors.acepta_deposito_garantia = 'Selecciona una respuesta para continuar';
        }
        if (!formData.fecha_cita) {
          newErrors.fecha_cita = 'La fecha de cita es obligatoria';
        } else if (!esDiaHabil(formData.fecha_cita)) {
          newErrors.fecha_cita = 'Solo puedes agendar de lunes a viernes';
        } else if (formData.fecha_cita < todayDate) {
          newErrors.fecha_cita = 'No puedes seleccionar una fecha pasada';
        }
        break;
        
      default:
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep) && currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
  if (!validateStep(steps.length)) return;
  
  setLoading(true);
  setSubmitFeedback(null);
  
  try {
    // 🔥 CRÍTICO: Construir FormData correctamente
    const submitData = new FormData();

    // 1️⃣ PRIMERO: Agregar TODOS los campos de texto
    submitData.append('nombre_completo', formData.nombre_completo);
    submitData.append('telefono', formData.telefono);
    submitData.append('email', formData.email.trim().toLowerCase());
    submitData.append('curp', formData.curp || '');
    submitData.append('domicilio', formData.domicilio);
    submitData.append('estado_civil', formData.estado_civil);
    submitData.append('tiene_responsabilidad_familiar', String(formData.tiene_responsabilidad_familiar));
    submitData.append('tipo_vivienda', formData.tipo_vivienda);
    submitData.append('tiempo_renta_actual', formData.tiempo_renta_actual || '');
    submitData.append('experiencia_taxi', String(formData.experiencia_taxi));
    submitData.append('ultimo_empleo', formData.ultimo_empleo);
    submitData.append('referencia_familiar_1_nombre', formData.referencia_familiar_1_nombre);
    submitData.append('referencia_familiar_1_telefono', formData.referencia_familiar_1_telefono);
    submitData.append('referencia_familiar_1_cohabita', String(formData.referencia_familiar_1_cohabita));
    submitData.append('referencia_familiar_2_nombre', formData.referencia_familiar_2_nombre);
    submitData.append('referencia_familiar_2_telefono', formData.referencia_familiar_2_telefono);
    submitData.append('acepta_deposito_garantia', formData.acepta_deposito_garantia);
    submitData.append('deposito_garantia_pagado', String(formData.acepta_deposito_garantia === 'si'));
    submitData.append('fecha_cita', formData.fecha_cita || '');
    submitData.append('hora_cita', '13:00');

    // Fecha de nacimiento
    if (formData.dia_nacimiento && formData.mes_nacimiento && formData.anio_nacimiento) {
      const fechaNacimiento = `${formData.anio_nacimiento}-${String(formData.mes_nacimiento).padStart(2, '0')}-${String(formData.dia_nacimiento).padStart(2, '0')}`;
      submitData.append('fecha_nacimiento', fechaNacimiento);
    }

    // 2️⃣ SEGUNDO: Agregar archivos con sus nombres específicos
    // 🔥 IMPORTANTE: Solo agregar si existen
    if (formData.licencia_frente) {
      submitData.append('licencia_frente', formData.licencia_frente);
    }
    if (formData.licencia_reverso) {
      submitData.append('licencia_reverso', formData.licencia_reverso);
    }
    if (formData.ine_frente) {
      submitData.append('ine_frente', formData.ine_frente);
    }
    if (formData.ine_reverso) {
      submitData.append('ine_reverso', formData.ine_reverso);
    }
    if (formData.comprobante_domicilio) {
      submitData.append('comprobante_domicilio', formData.comprobante_domicilio);
    }

    // 3️⃣ Debug: Ver qué estamos enviando
    console.log('📤 Enviando solicitud...');
    console.log('📝 Campos de texto:');
    for (let [key, value] of submitData.entries()) {
      if (typeof value === 'string') {
        console.log(`  ${key}: ${value}`);
      } else {
        console.log(`  ${key}: [File] ${value.name} (${value.size} bytes)`);
      }
    }

    // 4️⃣ Enviar petición
    const response = await fetch(`${API_BASE_URL}/solicitudes`, {

      method: 'POST',
      body: submitData
      // NO incluir Content-Type, el navegador lo agrega automáticamente con boundary
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    // 5️⃣ Verificar tipo de respuesta
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const textResponse = await response.text();
      console.error('❌ Respuesta NO es JSON:', textResponse);
      setSubmitFeedback({
        type: 'error',
        title: 'No se pudo procesar tu solicitud',
        message: 'El servidor respondió con un formato inesperado. Intenta nuevamente en unos minutos.'
      });
      setLoading(false);
      return;
    }

    // 6️⃣ Parsear respuesta JSON
    const result = await response.json();
    console.log('📦 Result:', result);

    if (result.success) {
      setSubmitFeedback({
        type: 'success',
        title: 'Solicitud enviada correctamente',
        message: `Tu folio es ${result.solicitud.id}. Te contactaremos pronto para continuar el proceso.`
      });
      
      // Reset form
      setFormData({
        nombre_completo: '', 
        telefono: '', 
        email: '',
        dia_nacimiento: '', 
        mes_nacimiento: '', 
        anio_nacimiento: '',
        curp: '', 
        domicilio: '', 
        estado_civil: '',
        tiene_responsabilidad_familiar: false, 
        tipo_vivienda: '', 
        tiempo_renta_actual: '',
        experiencia_taxi: false, 
        ultimo_empleo: '',
        referencia_familiar_1_nombre: '', 
        referencia_familiar_1_telefono: '', 
        referencia_familiar_1_cohabita: false,
        referencia_familiar_2_nombre: '', 
        referencia_familiar_2_telefono: '',
        licencia_frente: null, 
        licencia_reverso: null, 
        ine_frente: null, 
        ine_reverso: null,
        comprobante_domicilio: null,
        acepta_deposito_garantia: '',
        fecha_cita: ''
      });
      
      setImagesPreviews({
        licencia_frente: null,
        licencia_reverso: null,
        ine_frente: null,
        ine_reverso: null,
        comprobante_domicilio: null
      });
      
      setCurrentStep(1);
      window.scrollTo(0, 0);
    } else {
      if (result?.conductor_id && ['Activo', 'Aprobado'].includes(result?.status)) {
        setSubmitFeedback({
          type: 'warning',
          title: 'Ya tienes un registro activo',
          message: 'Ya existe un conductor aprobado/activo con estos datos, por eso no es posible crear otra solicitud.',
          detail: `ID de conductor: ${result.conductor_id}. Si crees que es un error, contacta a RH para revisión.`
        });
      } else {
        setSubmitFeedback({
          type: 'error',
          title: 'No se pudo enviar la solicitud',
          message: result.message || 'Error al enviar solicitud'
        });
      }
    }
  } catch (error) {
    console.error('❌ Error completo:', error);
    console.error('Stack:', error.stack);
    setSubmitFeedback({
      type: 'error',
      title: 'Error de conexión',
      message: `No fue posible enviar la solicitud: ${error.message}`
    });
  } finally {
    setLoading(false);
  }
};

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Phone className="w-16 h-16 mx-auto mb-4 text-cyan-400" />
        <h2 className="text-3xl font-bold text-white mb-2">Información de Contacto</h2>
        <p className="text-gray-400">Empecemos con tus datos básicos para contactarte</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nombre Completo *
          </label>
          <input
            type="text"
            value={formData.nombre_completo}
            onChange={(e) => handleInputChange('nombre_completo', e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500 backdrop-blur-sm transition-all duration-200"
            placeholder="Juan Pérez García"
          />
          {errors.nombre_completo && (
            <p className="text-red-400 text-xs mt-1">{errors.nombre_completo}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Teléfono * (10 dígitos)
          </label>
          <input
            type="tel"
            value={formData.telefono}
            onChange={(e) => handleInputChange('telefono', e.target.value.replace(/\D/g, '').slice(0, 10))}
            inputMode="numeric"
            pattern="\d{10}"
            maxLength={10}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500 backdrop-blur-sm"
            placeholder="3111234567"
          />
          {errors.telefono && (
            <p className="text-red-400 text-xs mt-1">{errors.telefono}</p>
          )}
          {formData.telefono.length === 10 && !errors.telefono && (
            <p className="text-green-400 text-xs mt-1">✓ Número válido</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email *
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500 backdrop-blur-sm"
            placeholder="juan@email.com"
          />
          {errors.email && (
            <p className="text-red-400 text-xs mt-1">{errors.email}</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => {
    const estadosCiviles = [
      { value: 'Soltero', icon: User },
      { value: 'Casado', icon: Heart },
      { value: 'Unión Libre', icon: UserCheck },
      { value: 'Divorciado', icon: User },
      { value: 'Viudo', icon: User }
    ];

    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <User className="w-16 h-16 mx-auto mb-4 text-purple-400" />
          <h2 className="text-3xl font-bold text-white mb-2">Información Personal</h2>
          <p className="text-gray-400">Datos personales y de residencia</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Fecha de Nacimiento *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={formData.dia_nacimiento}
                onChange={(e) => handleInputChange('dia_nacimiento', e.target.value)}
                className="px-3 py-3 bg-white text-gray-900 border border-gray-200 rounded-lg"
              >
                <option value="" disabled hidden className="bg-white text-gray-500">
                  Día
                </option>
                {[...Array(31)].map((_, i) => (
                  <option key={i + 1} value={i + 1} className="bg-white text-gray-900">{i + 1}</option>
                ))}
              </select>

              <select
                value={formData.mes_nacimiento}
                onChange={(e) => handleInputChange('mes_nacimiento', e.target.value)}
                className="px-3 py-3 bg-white text-gray-900 border border-gray-200 rounded-lg"
              >
                <option value="" disabled hidden className="bg-white text-gray-500">
                  Mes
                </option>
                {meses.map(mes => (
                  <option key={mes.value} value={mes.value} className="bg-white text-gray-900">{mes.label}</option>
                ))}
              </select>

              <select
                value={formData.anio_nacimiento}
                onChange={(e) => handleInputChange('anio_nacimiento', e.target.value)}
                className="px-3 py-3 bg-white text-gray-900 border border-gray-200 rounded-lg"
              >
                <option value="" disabled hidden className="bg-white text-gray-500">
                  Año
                </option>
                {years.map(year => (
                  <option key={year} value={year} className="bg-white text-gray-900">{year}</option>
                ))}
              </select>
            </div>
            {errors.fecha_nacimiento && (
              <p className="text-red-400 text-xs mt-1">{errors.fecha_nacimiento}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              CURP (opcional)
            </label>
            <input
              type="text"
              value={formData.curp}
              onChange={(e) => handleInputChange('curp', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18))}
              maxLength={18}
              pattern="[A-Za-z0-9]{18}"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500"
              placeholder="PEGJ900515HNTRRN09"
            />
            {errors.curp && (
              <p className="text-red-400 text-xs mt-1">{errors.curp}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Domicilio Completo *
            </label>
            <textarea
              value={formData.domicilio}
              onChange={(e) => handleInputChange('domicilio', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500"
              placeholder="Calle 5 de Mayo #123, Col. Centro, Tepic, Nayarit"
            />
            {errors.domicilio && (
              <p className="text-red-400 text-xs mt-1">{errors.domicilio}</p>
            )}
          </div>

          {/* 🆕 ESTADO CIVIL CON BOTONES (MEJORA #1) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Estado Civil *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {estadosCiviles.map((estado) => {
                const Icon = estado.icon;
                return (
                  <button
                    key={estado.value}
                    type="button"
                    onClick={() => handleInputChange('estado_civil', estado.value)}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                      formData.estado_civil === estado.value
                        ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
                    }`}
                  >
                    <Icon className="w-6 h-6 mx-auto mb-2" />
                    <div className="text-xs font-medium">{estado.value}</div>
                  </button>
                );
              })}
            </div>
            {errors.estado_civil && (
              <p className="text-red-400 text-xs mt-1">{errors.estado_civil}</p>
            )}
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/10">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="responsabilidad_familiar"
                checked={formData.tiene_responsabilidad_familiar}
                onChange={(e) => handleInputChange('tiene_responsabilidad_familiar', e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <div className="ml-3">
                <label htmlFor="responsabilidad_familiar" className="text-white font-medium">
                  Tengo responsabilidades familiares directas
                </label>
                <p className="text-gray-400 text-sm mt-1">
                  Hijos, padres u otros dependientes económicos
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Briefcase className="w-16 h-16 mx-auto mb-4 text-green-400" />
        <h2 className="text-3xl font-bold text-white mb-2">Estabilidad y Experiencia</h2>
        <p className="text-gray-400">Tu situación laboral y de vivienda</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tipo de Vivienda *
          </label>
          <div className="grid grid-cols-3 gap-3">
            {['Propia', 'Familiar', 'Rentada'].map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => handleInputChange('tipo_vivienda', tipo)}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  formData.tipo_vivienda === tipo
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                    : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
                }`}
              >
                <Home className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">{tipo}</div>
              </button>
            ))}
          </div>
          {errors.tipo_vivienda && (
            <p className="text-red-400 text-xs mt-1">{errors.tipo_vivienda}</p>
          )}
        </div>

        {formData.tipo_vivienda === 'Rentada' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tiempo en Renta Actual *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {['Menos de 6 meses', '6 meses o más'].map((tiempo) => (
                <button
                  key={tiempo}
                  type="button"
                  onClick={() => handleInputChange('tiempo_renta_actual', tiempo)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.tiempo_renta_actual === tiempo
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                      : 'border-white/10 bg-white/5 text-gray-300'
                  }`}
                >
                  <Calendar className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-sm font-medium">{tiempo}</div>
                </button>
              ))}
            </div>
            {errors.tiempo_renta_actual && (
              <p className="text-red-400 text-xs mt-1">{errors.tiempo_renta_actual}</p>
            )}
          </div>
        )}

        <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/10">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="experiencia_taxi"
              checked={formData.experiencia_taxi}
              onChange={(e) => handleInputChange('experiencia_taxi', e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <div className="ml-3">
              <label htmlFor="experiencia_taxi" className="text-white font-medium">
                Tengo experiencia como conductor
              </label>
              <p className="text-gray-400 text-sm mt-1">
                Taxi, Uber, DiDi o servicio similar
              </p>
            </div>
          </div>
          {formData.experiencia_taxi && (
            <p className="text-green-400 text-xs mt-3">✓ Excelente, tu experiencia es valiosa</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Último Empleo o Actividad (opcional)
          </label>
          <textarea
            value={formData.ultimo_empleo}
            onChange={(e) => handleInputChange('ultimo_empleo', e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500"
            placeholder="Describe brevemente tu último trabajo..."
          />
          {errors.ultimo_empleo && (
            <p className="text-red-400 text-xs mt-1">{errors.ultimo_empleo}</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Users className="w-16 h-16 mx-auto mb-4 text-orange-400" />
        <h2 className="text-3xl font-bold text-white mb-2">Referencias Familiares</h2>
        <p className="text-gray-400">Dos contactos familiares de confianza</p>
      </div>

      <div className="space-y-6">
        <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 p-6 rounded-xl backdrop-blur-sm border border-white/10">
          <h3 className="text-lg font-bold text-white mb-4">Referencia Familiar 1 (contacto de emergencia)</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nombre Completo *
              </label>
              <input
                type="text"
                value={formData.referencia_familiar_1_nombre}
                onChange={(e) => handleInputChange('referencia_familiar_1_nombre', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500"
                placeholder="María Pérez García"
              />
              {errors.referencia_familiar_1_nombre && (
                <p className="text-red-400 text-xs mt-1">{errors.referencia_familiar_1_nombre}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Teléfono *
              </label>
              <input
                type="tel"
                value={formData.referencia_familiar_1_telefono}
                onChange={(e) => handleInputChange('referencia_familiar_1_telefono', e.target.value.replace(/\D/g, '').slice(0, 10))}
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500"
                placeholder="3119876543"
              />
              {errors.referencia_familiar_1_telefono && (
                <p className="text-red-400 text-xs mt-1">{errors.referencia_familiar_1_telefono}</p>
              )}
            </div>

            <div className="bg-white/5 p-3 rounded-lg">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="ref1_cohabita"
                  checked={formData.referencia_familiar_1_cohabita}
                  onChange={(e) => handleInputChange('referencia_familiar_1_cohabita', e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="ref1_cohabita" className="ml-2 text-white">
                  Vive conmigo en el mismo domicilio
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-6 rounded-xl backdrop-blur-sm border border-white/10">
          <h3 className="text-lg font-bold text-white mb-4">Referencia Familiar 2 (contacto de emergencia)</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nombre Completo *
              </label>
              <input
                type="text"
                value={formData.referencia_familiar_2_nombre}
                onChange={(e) => handleInputChange('referencia_familiar_2_nombre', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500"
                placeholder="Carlos García López"
              />
              {errors.referencia_familiar_2_nombre && (
                <p className="text-red-400 text-xs mt-1">{errors.referencia_familiar_2_nombre}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Teléfono *
              </label>
              <input
                type="tel"
                value={formData.referencia_familiar_2_telefono}
                onChange={(e) => handleInputChange('referencia_familiar_2_telefono', e.target.value.replace(/\D/g, '').slice(0, 10))}
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500"
                placeholder="3117654321"
              />
              {errors.referencia_familiar_2_telefono && (
                <p className="text-red-400 text-xs mt-1">{errors.referencia_familiar_2_telefono}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <FileText className="w-16 h-16 mx-auto mb-4 text-pink-400" />
        <h2 className="text-3xl font-bold text-white mb-2">Documentación</h2>
        <p className="text-gray-400">Sube fotos claras de tus documentos</p>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-amber-400 mb-2">📸 Consejos para las fotos:</h4>
        <ul className="text-sm text-amber-300 space-y-1">
          <li>• Asegúrate de que todos los datos sean legibles</li>
          <li>• Usa buena iluminación, evita sombras</li>
          <li>• Mantén el documento plano y completo</li>
          <li>• Tamaño máximo: 5MB por imagen</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">🚗 Licencia de Conducir</h3>
          
          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/10">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Frente de Licencia *
            </label>
            
            {imagesPreviews.licencia_frente ? (
              <div className="relative">
                <img 
                  src={imagesPreviews.licencia_frente} 
                  alt="Licencia Frente" 
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => removeFile('licencia_frente')}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-cyan-500/50 transition-colors">
                <Upload className="mx-auto mb-3 text-gray-400" size={32} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange('licencia_frente', e)}
                  className="hidden"
                  id="licencia_frente_input"
                />
                <label htmlFor="licencia_frente_input" className="cursor-pointer">
                  <p className="text-sm text-gray-300">Click para subir imagen</p>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG o WebP</p>
                </label>
              </div>
            )}
            {errors.licencia_frente && (
              <p className="text-red-400 text-xs mt-2">{errors.licencia_frente}</p>
            )}
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/10">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Reverso de Licencia *
            </label>
            
            {imagesPreviews.licencia_reverso ? (
              <div className="relative">
                <img 
                  src={imagesPreviews.licencia_reverso} 
                  alt="Licencia Reverso" 
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => removeFile('licencia_reverso')}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-cyan-500/50 transition-colors">
                <Upload className="mx-auto mb-3 text-gray-400" size={32} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange('licencia_reverso', e)}
                  className="hidden"
                  id="licencia_reverso_input"
                />
                <label htmlFor="licencia_reverso_input" className="cursor-pointer">
                  <p className="text-sm text-gray-300">Click para subir imagen</p>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG o WebP</p>
                </label>
              </div>
            )}
            {errors.licencia_reverso && (
              <p className="text-red-400 text-xs mt-2">{errors.licencia_reverso}</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">🆔 Identificación (INE/IFE)</h3>
          
          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/10">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Frente de INE *
            </label>
            
            {imagesPreviews.ine_frente ? (
              <div className="relative">
                <img 
                  src={imagesPreviews.ine_frente} 
                  alt="INE Frente" 
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => removeFile('ine_frente')}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-cyan-500/50 transition-colors">
                <Upload className="mx-auto mb-3 text-gray-400" size={32} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange('ine_frente', e)}
                  className="hidden"
                  id="ine_frente_input"
                />
                <label htmlFor="ine_frente_input" className="cursor-pointer">
                  <p className="text-sm text-gray-300">Click para subir imagen</p>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG o WebP</p>
                </label>
              </div>
            )}
            {errors.ine_frente && (
              <p className="text-red-400 text-xs mt-2">{errors.ine_frente}</p>
            )}
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/10">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Reverso de INE *
            </label>
            
            {imagesPreviews.ine_reverso ? (
              <div className="relative">
                <img 
                  src={imagesPreviews.ine_reverso} 
                  alt="INE Reverso" 
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => removeFile('ine_reverso')}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-cyan-500/50 transition-colors">
                <Upload className="mx-auto mb-3 text-gray-400" size={32} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange('ine_reverso', e)}
                  className="hidden"
                  id="ine_reverso_input"
                />
                <label htmlFor="ine_reverso_input" className="cursor-pointer">
                  <p className="text-sm text-gray-300">Click para subir imagen</p>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG o WebP</p>
                </label>
              </div>
            )}
            {errors.ine_reverso && (
              <p className="text-red-400 text-xs mt-2">{errors.ine_reverso}</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white">🏠 Comprobante de domicilio</h3>

        <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/10 max-w-xl">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Foto del comprobante de domicilio (opcional)
          </label>

          {imagesPreviews.comprobante_domicilio ? (
            <div className="relative">
              <img
                src={imagesPreviews.comprobante_domicilio}
                alt="Comprobante de domicilio"
                className="w-full h-48 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => removeFile('comprobante_domicilio')}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-cyan-500/50 transition-colors">
              <Upload className="mx-auto mb-3 text-gray-400" size={32} />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange('comprobante_domicilio', e)}
                className="hidden"
                id="comprobante_domicilio_input"
              />
              <label htmlFor="comprobante_domicilio_input" className="cursor-pointer">
                <p className="text-sm text-gray-300">Click para subir imagen</p>
                <p className="text-xs text-gray-500 mt-1">JPG, PNG o WebP</p>
              </label>
            </div>
          )}
          {errors.comprobante_domicilio && (
            <p className="text-red-400 text-xs mt-2">{errors.comprobante_domicilio}</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => {
    const direccionOficina = 'Lima 62, Cuatro Milpas, 63170 Tepic, Nay.';
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccionOficina)}`;
    const whatsappUrl = 'https://wa.me/5213112591884?text=Hola%2C%20quiero%20agendar%20mi%20cita%20para%20solicitud%20de%20conductor';

    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
          <h2 className="text-3xl font-bold text-white mb-2">Deposito y Cita</h2>
          <p className="text-gray-400">Ultimo paso: confirma deposito y agenda tu visita</p>
        </div>

        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
          <h4 className="font-medium text-cyan-300 mb-2">Deposito en garantia reintegrable</h4>
          <p className="text-sm text-cyan-100">
            Para continuar el proceso, considera un deposito en garantia reintegrable de <span className="font-semibold">$2,000 MXN</span>.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Estas de acuerdo con el deposito en garantia de $2,000 MXN? *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleInputChange('acepta_deposito_garantia', 'si')}
              className={`p-4 rounded-lg border-2 transition-all ${
                formData.acepta_deposito_garantia === 'si'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
              }`}
            >
              Si, estoy de acuerdo
            </button>
            <button
              type="button"
              onClick={() => handleInputChange('acepta_deposito_garantia', 'no')}
              className={`p-4 rounded-lg border-2 transition-all ${
                formData.acepta_deposito_garantia === 'no'
                  ? 'border-red-500 bg-red-500/10 text-red-400'
                  : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
              }`}
            >
              No estoy de acuerdo
            </button>
          </div>
          {errors.acepta_deposito_garantia && (
            <p className="text-red-400 text-xs mt-2">{errors.acepta_deposito_garantia}</p>
          )}
        </div>

        <div className="bg-white/5 backdrop-blur-sm p-5 rounded-lg border border-white/10 space-y-4">
          <h4 className="text-white font-semibold">Agenda tu cita obligatoria de lunes a viernes a la 1:00 pm</h4>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Fecha de cita *</label>
            <input
              type="date"
              min={minCitaDate}
              value={formData.fecha_cita}
              onChange={(e) => {
                const selectedDate = e.target.value;
                if (selectedDate && !esDiaHabil(selectedDate)) {
                  setErrors(prev => ({ ...prev, fecha_cita: 'Solo puedes seleccionar fechas de lunes a viernes' }));
                  handleInputChange('fecha_cita', '');
                  return;
                }
                handleInputChange('fecha_cita', selectedDate);
              }}
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white"
            />
            {formData.fecha_cita && (
              <p className="text-xs text-cyan-300 mt-2">
                Fecha seleccionada: {formatFechaCitaLegible(formData.fecha_cita)}
              </p>
            )}
            {errors.fecha_cita && (
              <p className="text-red-400 text-xs mt-1">{errors.fecha_cita}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-black/30 rounded-lg border border-white/10 p-4">
              <p className="text-gray-400 mb-1">Oficina</p>
              <p className="text-white">{direccionOficina}</p>
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 mt-2"
              >
                <MapPin size={14} />
                Abrir en mapa
              </a>
            </div>

            <div className="bg-black/30 rounded-lg border border-white/10 p-4">
              <p className="text-gray-400 mb-1">Contacto</p>
              <a href="tel:+523111705338" className="block text-white hover:text-cyan-300 transition-colors">
                Telefono: 311 170 5338
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 mt-2"
              >
                <Phone size={14} />
                WhatsApp +52 1 311 259 1884
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 🆕 MEJORA #2: Wrapper con animación para transiciones
  const renderStepContent = () => {
    let content;
    switch (currentStep) {
      case 1: content = renderStep1(); break;
      case 2: content = renderStep2(); break;
      case 3: content = renderStep3(); break;
      case 4: content = renderStep4(); break;
      case 5: content = renderStep5(); break;
      case 6: content = renderStep6(); break;
      default: content = renderStep1();
    }
    
    return (
      <div className="animate-fadeIn">
        {content}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#07425E]">
      {/* Patrón de fondo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <div className="relative bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">AM</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">AutoManager</h1>
                <p className="text-gray-400 text-sm">Solicitud de Conductor</p>
              </div>
            </div>
            {/*<button
              className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
            >
              ¿Ya aplicaste? Consulta tu estado →
            </button>*/}
          </div>
        </div>
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              
              return (
                <div key={step.number} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                      isCompleted ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30' : 
                      isActive ? 'bg-gradient-to-br from-cyan-500 to-purple-500 text-white shadow-lg shadow-cyan-500/30' : 
                      'bg-white/10 text-gray-400 backdrop-blur-sm'
                    }`}>
                      {isCompleted ? <CheckCircle size={20} /> : <Icon size={20} />}
                    </div>
                    <div className="mt-2 text-center">
                      <div className={`text-sm font-medium ${isActive ? 'text-cyan-400' : 'text-gray-400'}`}>
                        {step.title}
                      </div>
                      <div className="text-xs text-gray-500 hidden md:block">
                        {step.description}
                      </div>
                    </div>
                  </div>
                  
                  {index < steps.length - 1 && (
                    <div className="flex-1 max-w-[100px] mx-2">
                      <div className={`h-1 rounded-full transition-all duration-500 ${
                        isCompleted ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-white/10'
                      }`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-black/30 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 p-8">
          {submitFeedback && (
            <div className={`mb-6 rounded-xl border p-4 ${
              submitFeedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-400/40'
                : submitFeedback.type === 'warning'
                  ? 'bg-amber-500/10 border-amber-400/40'
                  : 'bg-red-500/10 border-red-400/40'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {submitFeedback.type === 'success' ? (
                    <CheckCircle className="text-emerald-400 mt-0.5" size={20} />
                  ) : (
                    <AlertCircle
                      className={submitFeedback.type === 'warning' ? 'text-amber-400 mt-0.5' : 'text-red-400 mt-0.5'}
                      size={20}
                    />
                  )}
                  <div>
                    <p className="text-white font-semibold">{submitFeedback.title}</p>
                    <p className="text-sm text-gray-200 mt-1">{submitFeedback.message}</p>
                    {submitFeedback.detail && (
                      <p className="text-xs text-gray-300 mt-2">{submitFeedback.detail}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitFeedback(null)}
                  className="text-gray-300 hover:text-white transition-colors"
                  aria-label="Cerrar mensaje"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {renderStepContent()}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                currentStep === 1 
                  ? 'bg-white/5 text-gray-500 cursor-not-allowed' 
                  : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm'
              }`}
            >
              <ArrowLeft className="mr-2" size={20} />
              Anterior
            </button>

            {currentStep < steps.length ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:shadow-lg hover:shadow-cyan-500/30"
              >
                Siguiente
                <ArrowRight className="ml-2" size={20} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className={`flex items-center px-8 py-3 rounded-lg font-medium transition-all duration-200 ${
                  !loading
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg hover:shadow-green-500/30'
                    : 'bg-white/10 text-gray-400 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2" size={20} />
                    Enviar Solicitud
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PortalSolicitud;
