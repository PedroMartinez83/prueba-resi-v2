import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import solicitudesService from '../../services/solicitudesService';
import { useAuth } from '../../contexts/AuthContext';
import { 
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Users,
  Car,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  UserCheck,
  Eye,
  Download,
  Calculator,
  Star,
  Zap,
  Target,
  Activity,
  Trash2,
  Copy,
  KeyRound
} from 'lucide-react';

const SolicitudDetalle = () => {
  const { id: solicitudId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [solicitud, setSolicitud] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [evaluando, setEvaluando] = useState(false);
  const [migrando, setMigrando] = useState(false);
  const [credencialesAcceso, setCredencialesAcceso] = useState(null);
  const [copiadoCampo, setCopiadoCampo] = useState('');
  const canDeleteSolicitud = ['super_admin', 'direccion', 'director', 'gerente_ops']
    .includes(String(user?.rol || user?.role || '').toLowerCase());

  useEffect(() => {
    cargarSolicitud();
  }, [solicitudId]);

  const cargarSolicitud = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await solicitudesService.getSolicitudById(solicitudId);
      console.log('📄 Solicitud cargada:', data);
      setSolicitud(data.solicitud || data);
    } catch (err) {
      console.error('❌ Error al cargar solicitud:', err);
      setError(err.message || 'Error al cargar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const ejecutarMotorEvaluacion = async () => {
    try {
      setEvaluando(true);
      const resultado = await solicitudesService.calcularDecision(solicitudId);
      
      if (resultado.success) {
        const puntajeTotal = resultado.puntaje_total ?? resultado.evaluacion?.puntaje_total ?? 0;
        const decisionMotor = resultado.resultado ?? resultado.evaluacion?.decision ?? null;
        const factoresEvaluados = resultado.evaluacion_detallada ?? resultado.evaluacion?.factores ?? null;
        const fechaEvaluacion = resultado.solicitud?.fecha_evaluacion ?? new Date().toISOString();

        setSolicitud(prev => ({
          ...prev,
          puntaje_motor: puntajeTotal,
          decision_motor: decisionMotor,
          factores_evaluados: factoresEvaluados,
          fecha_evaluacion: fechaEvaluacion,
          estatus_solicitud: resultado.solicitud?.estatus_solicitud || prev.estatus_solicitud
        }));
        
        alert(`✅ Motor ejecutado exitosamente!\n\nPuntaje: ${puntajeTotal}/100\nDecisión: ${decisionMotor || 'No disponible'}`);
      }
    } catch (err) {
      console.error('❌ Error en motor de evaluación:', err);
      alert(`❌ Error: ${err.message}`);
    } finally {
      setEvaluando(false);
    }
  };

  const copiarTexto = async (campo, valor) => {
    if (!valor) {
      alert('No hay informacion para copiar.');
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(valor);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = valor;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopiadoCampo(campo);
      setTimeout(() => setCopiadoCampo(''), 1600);
    } catch (error) {
      console.error('Error copiando al portapapeles:', error);
      alert('No se pudo copiar automaticamente.');
    }
  };

  const migrarAConductor = async () => {
    if (!window.confirm(`Estas seguro de migrar esta solicitud a conductor?\n\nEsta accion creara un nuevo conductor con:\n- Categoria: Oro\n- Poliza: POLIZA_100\n- Saldo: $50,000 MXN\n\nEsta accion no se puede deshacer.`)) {
      return;
    }

    try {
      setMigrando(true);
      setCredencialesAcceso(null);

      const resultado = await solicitudesService.migrarAConductor(solicitudId);

      if (resultado.success) {
        const emailLogin = resultado?.conductor?.email || '';
        const passwordTemp = resultado?.password_temporal || resultado?.passwordTemporal || '';

        setSolicitud(prev => ({
          ...prev,
          migrado_a_conductor: true,
          conductor_id: resultado.conductor.id,
          fecha_migracion: new Date().toISOString(),
          estatus_solicitud: 'Migrado'
        }));

        setCredencialesAcceso({
          email: emailLogin,
          password: passwordTemp,
          conductorId: resultado.conductor.id,
          conductorNombre: resultado.conductor.nombre_conductor
        });

        if (!passwordTemp) {
          alert('Migracion completada, pero no se recibio la contrasena temporal. Revisa el backend.');
        } else {
          alert('Migracion completada. Ya puedes copiar correo y contrasena en el panel de credenciales.');
        }
      }
    } catch (err) {
      console.error('Error al migrar:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setMigrando(false);
    }
  };

  const actualizarEstatus = async (nuevoEstatus) => {
    const mensajes = {
      'Aprobado': 'Aprobar esta solicitud',
      'Aprobado (a prueba)': 'Aprobar esta solicitud a prueba (30 días)',
      'Rechazado': 'Rechazar esta solicitud'
    };

    const mensajePrompt = solicitud.estatus_solicitud === 'Rechazado' 
      ? `¿Estás seguro de ${mensajes[nuevoEstatus]}?\nEsta acción cambiará el estado de 'Rechazado' a '${nuevoEstatus}'.`
      : mensajes[nuevoEstatus];

    const notas = window.prompt(`${mensajePrompt}\n\nIngresa notas de revisión (opcional):`);
    
    if (notas === null) return; // Usuario canceló
    
    try {
      const resultado = await solicitudesService.actualizarEstatus(solicitudId, nuevoEstatus, notas);
      
      if (resultado.success) {
        setSolicitud(prev => ({
          ...prev,
          estatus_solicitud: nuevoEstatus,
          notas_revision: notas || prev.notas_revision // Mantiene notas anteriores si las nuevas están vacías
        }));
        
        alert(`✅ Estatus actualizado a: ${nuevoEstatus}`);
        await cargarSolicitud();
      }
    } catch (err) {
      console.error('❌ Error al actualizar estatus:', err);
      alert(`❌ Error: ${err.message}`);
    }
  };

  const eliminarSolicitud = async () => {
    if (!window.confirm('¿Estás SEGURO de eliminar esta solicitud?\n\n⚠️ Esta acción es PERMANENTE y no se puede deshacer.')) {
      return;
    }
    
    try {
      const resultado = await solicitudesService.eliminarSolicitud(solicitudId);
      
      if (resultado.success) {
        alert('✅ Solicitud eliminada exitosamente.');
        navigate('/admin/solicitudes'); // Regresar a la lista
      }
    } catch (err) {
      console.error('❌ Error al eliminar:', err);
      alert(`❌ Error: ${err.message}`);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      'Pendiente': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Aprobado': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Aprobado (a prueba)': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Rechazado': 'bg-red-500/20 text-red-400 border-red-500/30',
      'Migrado': 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    };
    return styles[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const formatFecha = (fecha) => {
    if (!fecha) return 'N/A';
    try {
      return new Date(fecha).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  const repararMojibake = (texto) => {
    if (typeof texto !== 'string' || !texto) return texto;

    try {
      const bytes = Uint8Array.from(
        texto.split('').map((char) => char.charCodeAt(0) & 0xff)
      );
      const decodificado = new TextDecoder('utf-8').decode(bytes);

      const ruidoOriginal = (texto.match(/[ÃÂâ�]/g) || []).length;
      const ruidoDecodificado = (decodificado.match(/[ÃÂâ�]/g) || []).length;

      if (decodificado && ruidoDecodificado < ruidoOriginal) {
        return decodificado;
      }
    } catch (error) {
      console.error('No se pudo reparar texto con codificacion invalida:', error);
    }

    return texto;
  };

  const getPuntajeColor = (puntaje) => {
    if (puntaje >= 80) return 'text-green-400';
    if (puntaje >= 60) return 'text-yellow-400';
    if (puntaje >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const renderFactorEvaluacion = (factor, cumple, valor, peso, informativo = false) => {
    const puntos = Number(valor) || 0;

    return (
      <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-lg font-bold ${
              cumple ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {cumple ? '✓' : '✗'}
          </span>
          <span className="text-gray-300">{factor}</span>
        </div>
        <div className="flex items-center gap-2">
          {informativo ? (
            <span className="text-gray-400 text-sm">Informativo</span>
          ) : (
            <>
              <span className="text-white font-medium">{puntos}</span>
              <span className="text-gray-400 text-sm">({peso}pts)</span>
            </>
          )}
        </div>
      </div>
    );
  };

  const construirFactoresEvaluados = () => {
    if (!solicitud?.factores_evaluados) return [];

    const evaluacion = solicitud.factores_evaluados;
    const esVerdadero = (valor) =>
      valor === true || valor === 'true' || valor === 1 || valor === '1';

    if (Array.isArray(evaluacion.desglose_factores) && evaluacion.desglose_factores.length > 0) {
      return evaluacion.desglose_factores.map((factor) => {
        const valor = Number(factor?.valor ?? factor?.puntos ?? 0) || 0;
        const peso = Number(factor?.peso ?? factor?.maximo ?? 0) || 0;
        const cumple = typeof factor?.cumple === 'boolean' ? factor.cumple : valor > 0;

        return {
          nombre: factor?.nombre || factor?.factor || 'Factor',
          cumple,
          valor,
          peso,
          informativo: factor?.es_informativo === true
        };
      });
    }

    const usaModeloV3 =
      'cumple_responsabilidad_familiar' in evaluacion ||
      'cumple_estabilidad_domicilio' in evaluacion ||
      'cumple_deposito' in evaluacion;

    if (usaModeloV3) {
      const puntosEdad = esVerdadero(evaluacion.cumple_edad) ? 20 : esVerdadero(evaluacion.edad_en_rango_prueba) ? 10 : 0;
      const puntosResponsabilidad = esVerdadero(evaluacion.cumple_responsabilidad_familiar) ? 20 : 0;
      const puntosVivienda = esVerdadero(evaluacion.cumple_estabilidad_domicilio) ? 20 : 0;
      const puntosDocumentos = esVerdadero(evaluacion.cumple_documentacion) ? 15 : 0;
      const puntosReferencias = esVerdadero(evaluacion.cumple_referencias) ? 15 : 0;
      const puntosDeposito = esVerdadero(evaluacion.cumple_deposito) ? 10 : 0;
      const tieneExperienciaTaxi = esVerdadero(solicitud?.experiencia_taxi);

      return [
        { nombre: 'Edad adecuada', cumple: puntosEdad > 0, valor: puntosEdad, peso: 20 },
        { nombre: 'Responsabilidad familiar', cumple: puntosResponsabilidad > 0, valor: puntosResponsabilidad, peso: 20 },
        { nombre: 'Vivienda estable', cumple: puntosVivienda > 0, valor: puntosVivienda, peso: 20 },
        { nombre: 'Documentos validos', cumple: puntosDocumentos > 0, valor: puntosDocumentos, peso: 15 },
        { nombre: 'Referencias completas', cumple: puntosReferencias > 0, valor: puntosReferencias, peso: 15 },
        { nombre: 'Deposito en garantia', cumple: puntosDeposito > 0, valor: puntosDeposito, peso: 10 },
        { nombre: 'Experiencia taxi', cumple: tieneExperienciaTaxi, valor: 0, peso: 0, informativo: true }
      ];
    }

    // Fallback para evaluaciones legacy (modelo anterior de 5 factores).
    const usaModeloLegacy =
      'cumple_experiencia_taxi' in evaluacion ||
      'cumple_vivienda_estable' in evaluacion ||
      ('cumple_edad' in evaluacion && 'cumple_documentacion' in evaluacion);
    if (!usaModeloLegacy) return [];

    const puntosEdad = esVerdadero(evaluacion.cumple_edad) ? 20 : 0;
    const puntosExperiencia = esVerdadero(evaluacion.cumple_experiencia_taxi) ? 30 : 0;
    const puntosVivienda = esVerdadero(evaluacion.cumple_vivienda_estable) ? 25 : 0;
    const puntosReferencias = esVerdadero(evaluacion.cumple_referencias) ? 15 : 0;
    const puntosDocumentos = esVerdadero(evaluacion.cumple_documentacion) ? 10 : 0;

    return [
      { nombre: 'Edad adecuada', cumple: puntosEdad > 0, valor: puntosEdad, peso: 20 },
      { nombre: 'Experiencia taxi', cumple: puntosExperiencia > 0, valor: puntosExperiencia, peso: 30 },
      { nombre: 'Vivienda estable', cumple: puntosVivienda > 0, valor: puntosVivienda, peso: 25 },
      { nombre: 'Referencias completas', cumple: puntosReferencias > 0, valor: puntosReferencias, peso: 15 },
      { nombre: 'Documentos validos', cumple: puntosDocumentos > 0, valor: puntosDocumentos, peso: 10 }
    ];
  };

  const obtenerResumenPuntajeMotor = (factores) => {
    const evaluacion = solicitud?.factores_evaluados || {};
    const puntajeDesglose = (Array.isArray(factores) ? factores : []).reduce(
      (acumulado, factor) => acumulado + (factor?.informativo ? 0 : (Number(factor?.valor) || 0)),
      0
    );
    const rechazoPorIndispensables = evaluacion?.rechazo_por_indispensables === true;
    const alertaIndispensables = evaluacion?.alerta_indispensables === true;
    const rechazoCritico = evaluacion?.rechazo_critico === true;
    const motivosIndispensables = Array.isArray(evaluacion?.motivos_indispensables)
      ? evaluacion.motivos_indispensables
      : [];
    const puntajeBasePersistido = Number(evaluacion?.puntaje_base);
    const puntajeFinalPersistido = Number(evaluacion?.puntaje_final);
    const puntajeMotorPersistido = Number(solicitud?.puntaje_motor);
    const escalaBasePersistida = Number(evaluacion?.escala_puntaje_base);
    const escalaFinalPersistida = Number(evaluacion?.escala_puntaje_final);
    const puntajeBaseValido = Number.isFinite(puntajeBasePersistido) ? puntajeBasePersistido : null;
    const puntajeFinalValido = Number.isFinite(puntajeFinalPersistido) ? puntajeFinalPersistido : null;
    const puntajeMotorValido = Number.isFinite(puntajeMotorPersistido) ? puntajeMotorPersistido : null;
    const escalaBaseValida = Number.isFinite(escalaBasePersistida) ? escalaBasePersistida : 100;
    const escalaFinalValida = Number.isFinite(escalaFinalPersistida) ? escalaFinalPersistida : 100;

    let puntajeBase = puntajeBaseValido;
    let puntajeFinal = puntajeFinalValido ?? puntajeMotorValido;
    let puntajeAjustadoPorDesglose = false;

    if (!Number.isFinite(puntajeFinal) && puntajeDesglose > 0) {
      puntajeFinal = puntajeDesglose;
    }

    if (!Number.isFinite(puntajeBase) && Number.isFinite(puntajeFinal)) {
      puntajeBase = puntajeFinal;
    }

    if (puntajeDesglose > 0 && Number.isFinite(puntajeFinal) && puntajeFinal !== puntajeDesglose) {
      if (!Number.isFinite(puntajeFinalValido)) {
        puntajeAjustadoPorDesglose = true;
      }
    }

    return {
      puntajeBase: Number.isFinite(puntajeBase) ? puntajeBase : 0,
      puntajeFinal: Number.isFinite(puntajeFinal) ? puntajeFinal : 0,
      puntajeDesglose,
      puntajeAjustadoPorDesglose,
      rechazoPorIndispensables,
      alertaIndispensables,
      rechazoCritico,
      motivosIndispensables,
      escalaBase: escalaBaseValida,
      escalaFinal: escalaFinalValida
    };
  };

  const factoresEvaluados = construirFactoresEvaluados();
  const resumenPuntajeMotor = obtenerResumenPuntajeMotor(factoresEvaluados);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-cyan-500 mb-4"></div>
          <p className="text-gray-400">Cargando detalles de la solicitud...</p>
        </div>
      </div>
    );
  }

  if (error || !solicitud) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-8 max-w-md w-full">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-white text-lg font-medium mb-2">Error</p>
            <p className="text-gray-400 mb-6">{error || 'Solicitud no encontrada'}</p>
            <button
              onClick={() => navigate('/admin/solicitudes')}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all"
            >
              Volver a Solicitudes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/solicitudes')}
            className="p-2 bg-white/5 backdrop-blur-sm text-gray-300 rounded-lg hover:bg-white/10 transition-colors border border-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">
              Solicitud #{solicitud.id}
            </h1>
            <p className="text-gray-400">
              {solicitud.nombre_completo} • {formatFecha(solicitud.fecha_solicitud)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium border ${getStatusBadge(solicitud.estatus_solicitud)}`}>
            {solicitud.estatus_solicitud}
          </span>

          {solicitud.migrado_a_conductor && (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium border bg-purple-500/20 text-purple-400 border-purple-500/30">
              <UserCheck className="w-4 h-4" />
              Migrado
            </span>
          )}
        </div>
      </div>

      {/* Información Personal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Datos Personales */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <div className="flex items-center gap-3 p-6 border-b border-white/10">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <User className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Información Personal</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-gray-400 text-sm">Nombre Completo</p>
                <p className="text-white font-medium">{solicitud.nombre_completo}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-gray-400 text-sm">Fecha de Nacimiento</p>
                <p className="text-white font-medium">
                  {solicitud.fecha_nacimiento ? 
                    new Date(solicitud.fecha_nacimiento).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 
                    'No especificado'
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-gray-400 text-sm">CURP</p>
                <p className="text-white font-medium">{solicitud.curp || 'No especificado'}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <p className="text-gray-400 text-sm">Domicilio</p>
                <p className="text-white font-medium">{solicitud.domicilio}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-gray-400 text-sm">Estado Civil</p>
                <p className="text-white font-medium">{solicitud.estado_civil || 'No especificado'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <CheckCircle className={`w-5 h-5 ${solicitud.tiene_responsabilidad_familiar ? 'text-green-400' : 'text-gray-400'}`} />
              <div>
                <p className="text-gray-400 text-sm">Responsabilidades Familiares</p>
                <p className="text-white font-medium">
                  {solicitud.tiene_responsabilidad_familiar ? 'Sí' : 'No'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contacto */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <div className="flex items-center gap-3 p-6 border-b border-white/10">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Phone className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Información de Contacto</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-gray-400 text-sm">Teléfono</p>
                <p className="text-white font-medium">{solicitud.telefono}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-gray-400 text-sm">Email</p>
                <p className="text-white font-medium">{solicitud.email || 'No especificado'}</p>
              </div>
            </div>
            
            <div className="mt-6">
              <h4 className="text-white font-medium mb-3">Referencias Familiares</h4>
              
              <div className="space-y-3">
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <p className="text-white font-medium">{solicitud.referencia_familiar_1_nombre}</p>
                  <p className="text-gray-400 text-sm">{solicitud.referencia_familiar_1_telefono}</p>
                  {solicitud.referencia_familiar_1_cohabita && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30 mt-1">
                      Vive con el solicitante
                    </span>
                  )}
                </div>
                
                {solicitud.referencia_familiar_2_nombre && (
                  <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                    <p className="text-white font-medium">{solicitud.referencia_familiar_2_nombre}</p>
                    <p className="text-gray-400 text-sm">{solicitud.referencia_familiar_2_telefono}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Experiencia y Vivienda */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Experiencia */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <div className="flex items-center gap-3 p-6 border-b border-white/10">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Car className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Experiencia Laboral</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${solicitud.experiencia_taxi ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <div>
                <p className="text-gray-400 text-sm">Experiencia como Taxista</p>
                <p className="text-white font-medium">
                  {solicitud.experiencia_taxi ? 'Sí tiene experiencia' : 'Sin experiencia previa'}
                </p>
              </div>
            </div>
            
            <div className="mt-4">
              <p className="text-gray-400 text-sm mb-2">Último Empleo</p>
              <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                <p className="text-white">{solicitud.ultimo_empleo || 'No especificado'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Vivienda */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <div className="flex items-center gap-3 p-6 border-b border-white/10">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <MapPin className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Información de Vivienda</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-400"></div>
              <div>
                <p className="text-gray-400 text-sm">Tipo de Vivienda</p>
                <p className="text-white font-medium">{solicitud.tipo_vivienda}</p>
              </div>
            </div>
            
            {solicitud.tipo_vivienda === 'Rentada' && solicitud.tiempo_renta_actual && (
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-gray-400 text-sm">Tiempo en Renta Actual</p>
                  <p className="text-white font-medium">{solicitud.tiempo_renta_actual}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Documentación */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
        <div className="flex items-center gap-3 p-6 border-b border-white/10">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <FileText className="w-5 h-5 text-cyan-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Documentación</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Licencia (Frente)', url: solicitud.url_licencia_frente },
              { label: 'Licencia (Reverso)', url: solicitud.url_licencia_reverso },
              { label: 'INE (Frente)', url: solicitud.url_ine_frente },
              { label: 'INE (Reverso)', url: solicitud.url_ine_reverso },
              { label: 'Comprobante domicilio', url: solicitud.url_comprobante_domicilio }
            ].map((doc, index) => (
              <div key={index} className="bg-white/5 p-4 rounded-lg text-center border border-white/5">
                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-white text-sm font-medium mb-2">{doc.label}</p>
                {doc.url ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => window.open(doc.url, '_blank')}
                      className="w-full px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs hover:bg-cyan-500/30 transition-colors flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Ver
                    </button>
                    <button
                      onClick={() => window.open(doc.url, '_blank')}
                      className="w-full px-3 py-1 bg-white/5 text-gray-300 rounded text-xs hover:bg-white/10 transition-colors flex items-center justify-center gap-1 border border-white/10"
                    >
                      <Download className="w-3 h-3" />
                      Descargar
                    </button>
                  </div>
                ) : (
                  <span className="text-red-400 text-xs">No disponible</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Motor de Evaluación */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Calculator className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Motor de Evaluación Automática</h3>
          </div>
          <button
            onClick={ejecutarMotorEvaluacion}
            disabled={evaluando}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {evaluando ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Evaluando...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Ejecutar Motor
              </>
            )}
          </button>
        </div>
        <div className="p-6">
          {solicitud.puntaje_motor !== null && solicitud.puntaje_motor !== undefined ? (
            <div className="space-y-6">
              {/* Resultado General */}
              <div className="text-center">
                <div className={`text-6xl font-bold mb-2 ${getPuntajeColor(resumenPuntajeMotor.puntajeFinal)}`}>
                  {resumenPuntajeMotor.puntajeFinal}/100
                </div>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-300">Decisión del Motor:</span>
                  <span className={`font-bold ${
                    solicitud.decision_motor === 'Aprobado' ? 'text-green-400' :
                    solicitud.decision_motor === 'Aprobado (a prueba)' ? 'text-blue-400' :
                    'text-red-400'
                  }`}>
                    {solicitud.decision_motor}
                  </span>
                </div>
                {resumenPuntajeMotor.puntajeBase !== resumenPuntajeMotor.puntajeFinal && (
                  <p className="text-sm text-amber-300 mb-3">
                    Puntaje base (sin indispensables): {resumenPuntajeMotor.puntajeBase}/{resumenPuntajeMotor.escalaBase}. Puntaje final: {resumenPuntajeMotor.puntajeFinal}/{resumenPuntajeMotor.escalaFinal}.
                  </p>
                )}
                {resumenPuntajeMotor.puntajeAjustadoPorDesglose && resumenPuntajeMotor.puntajeBase === resumenPuntajeMotor.puntajeFinal && (
                  <p className="text-sm text-cyan-300 mb-3">
                    Puntaje sincronizado con el desglose de factores para evitar inconsistencias visuales.
                  </p>
                )}
                <p className="text-gray-400 text-sm">
                  Evaluado el {formatFecha(solicitud.fecha_evaluacion)}
                </p>
              </div>

              {resumenPuntajeMotor.motivosIndispensables.length > 0 && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-left">
                  <p className="text-red-300 font-semibold">
                    Alerta: No reune requisitos indispensables
                  </p>
                  <p className="text-gray-300 text-sm mt-1">
                    {solicitud.decision_motor === 'Rechazado'
                      ? 'Este caso quedo rechazado por escenario critico. Adicionalmente tiene alertas de indispensables.'
                      : 'El estado puede mantenerse en A prueba, pero requiere seguimiento sobre estos puntos antes de migrar.'}
                  </p>
                  {resumenPuntajeMotor.motivosIndispensables.length > 0 && (
                    <ul className="mt-2 text-sm text-red-200 list-disc pl-5">
                      {resumenPuntajeMotor.motivosIndispensables.map((motivo) => (
                        <li key={motivo}>{motivo}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Desglose de Factores */}
              {solicitud.factores_evaluados && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-400" />
                      Factores Evaluados
                    </h4>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                      {factoresEvaluados.map(({ nombre, cumple, valor, peso, informativo }) => (
                        <React.Fragment key={nombre}>
                          {renderFactorEvaluacion(nombre, cumple, valor, peso, informativo)}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      Observaciones
                    </h4>
                    <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-2">
                      {solicitud.factores_evaluados.observaciones && solicitud.factores_evaluados.observaciones.length > 0 ? (
                        solicitud.factores_evaluados.observaciones.map((obs, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                            <p className="text-gray-300 text-sm">{obs}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-400 text-sm">Sin observaciones adicionales</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calculator className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Aún no se ha ejecutado el motor de evaluación</p>
              <p className="text-gray-500 text-sm mt-2">
                Haz clic en "Ejecutar Motor" para obtener una evaluación automática
              </p>
            </div>
          )}
        </div>
      </div>

      {/* <--- CAMBIO 3: Lógica de Acciones Administrativas actualizada --- > */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
        <div className="flex items-center gap-3 p-6 border-b border-white/10">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Acciones Administrativas</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Botones de APROBACIÓN (Aparecen si está Pendiente O Rechazado) */}
            {(solicitud.estatus_solicitud === 'Pendiente' || solicitud.estatus_solicitud === 'Rechazado') && (
              <>
                <button
                  onClick={() => actualizarEstatus('Aprobado')}
                  className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg hover:bg-green-500/20 transition-all group"
                >
                  <CheckCircle className="w-6 h-6 text-green-400 mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-white font-medium">
                    {/* Texto dinámico */}
                    {solicitud.estatus_solicitud === 'Rechazado' ? 'Recuperar y Aprobar' : 'Aprobar'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Aprobación completa</p>
                </button>
                
                <button
                  onClick={() => actualizarEstatus('Aprobado (a prueba)')}
                  className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-all group"
                >
                  <Clock className="w-6 h-6 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-white font-medium">
                    {/* Texto dinámico */}
                    {solicitud.estatus_solicitud === 'Rechazado' ? 'Recuperar (a Prueba)' : 'Aprobar a Prueba'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">30 días de prueba</p>
                </button>
              </>
            )}
            
            {/* Botón RECHAZAR (Aparece solo si está Pendiente) */}
            {solicitud.estatus_solicitud === 'Pendiente' && (
              <button
                onClick={() => actualizarEstatus('Rechazado')}
                className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-all group"
              >
                <XCircle className="w-6 h-6 text-red-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-white font-medium">Rechazar</p>
                <p className="text-xs text-gray-400 mt-1">No cumple requisitos</p>
              </button>
            )}

            {/* Botón ELIMINAR (Aparece si está Pendiente O Rechazado) */}
            {canDeleteSolicitud && (solicitud.estatus_solicitud === 'Pendiente' || solicitud.estatus_solicitud === 'Rechazado') && (
              <button
                onClick={eliminarSolicitud}
                className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg hover:bg-red-900/30 transition-all group"
              >
                <Trash2 className="w-6 h-6 text-red-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-white font-medium">Eliminar Solicitud</p>
                <p className="text-xs text-gray-400 mt-1">Borrado permanente</p>
              </button>
            )}
            
            {/* Botón MIGRAR (Esta lógica no cambia) */}
            {((solicitud.estatus_solicitud === 'Aprobado' || solicitud.estatus_solicitud === 'Aprobado (a prueba)') && 
             !solicitud.migrado_a_conductor) && (
              <button
                onClick={migrarAConductor}
                disabled={migrando}
                className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {migrando ? (
                  <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mb-2 mx-auto" />
                ) : (
                  <UserCheck className="w-6 h-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                )}
                <p className="text-white font-medium">
                  {migrando ? 'Migrando...' : 'Migrar a Conductor'}
                </p>
                <p className="text-xs text-gray-400 mt-1">Crear perfil conductor</p>
              </button>
            )}
            
            <button
              onClick={() => navigate('/admin/solicitudes')}
              className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all group"
            >
              <ArrowLeft className="w-6 h-6 text-gray-400 mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-white font-medium">Regresar</p>
              <p className="text-xs text-gray-400 mt-1">Lista de solicitudes</p>
            </button>
          </div>
          
          {solicitud.notas_revision && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <h4 className="text-white font-medium mb-2">Notas de Revisión</h4>
              <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                <p className="text-gray-300">{repararMojibake(solicitud.notas_revision)}</p>
              </div>
            </div>
          )}
          

          {credencialesAcceso && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-emerald-300" />
                  <h4 className="text-white font-medium">Acceso generado para el conductor</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-black/25 border border-white/10 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Correo de acceso</p>
                    <p className="text-white break-all">{credencialesAcceso.email || 'Sin correo'}</p>
                    <button
                      onClick={() => copiarTexto('correo', credencialesAcceso.email)}
                      className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-xs"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiadoCampo === 'correo' ? 'Copiado' : 'Copiar correo'}
                    </button>
                  </div>

                  <div className="bg-black/25 border border-white/10 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Contrasena temporal</p>
                    <p className="text-white break-all">{credencialesAcceso.password || 'No disponible'}</p>
                    <button
                      onClick={() => copiarTexto('password', credencialesAcceso.password)}
                      className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 text-xs"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiadoCampo === 'password' ? 'Copiada' : 'Copiar contrasena'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    onClick={() => navigate(`/admin/conductores/${credencialesAcceso.conductorId}`)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm"
                  >
                    Ver perfil del conductor
                  </button>
                </div>
              </div>
            </div>
          )}
          {solicitud.migrado_a_conductor && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-5 h-5 text-purple-400" />
                  <h4 className="text-white font-medium">Solicitud Migrada</h4>
                </div>
                <p className="text-gray-300 text-sm">
                  Esta solicitud ha sido migrada exitosamente a conductor.
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  ID Conductor: {solicitud.conductor_id} | Migrado el: {formatFecha(solicitud.fecha_migracion)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SolicitudDetalle;
