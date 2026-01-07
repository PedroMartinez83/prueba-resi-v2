import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Lock, ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react';
import InputOTP from '@/components/InputOTP';
import { requestPasswordReset, resetPassword } from '@/services/authService';
import './ForgotPassword.css';

const steps = [
  { id: 'request', title: 'Solicitar código', description: 'Enviaremos un código a tu correo registrado.' },
  { id: 'verify', title: 'Validar código', description: 'Introduce el código de verificación recibido.' },
  { id: 'reset', title: 'Nueva contraseña', description: 'Configura y confirma tu nueva contraseña.' },
];

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('request');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setMessage('');
    setError('');
  }, [status]);

  const currentStepIndex = useMemo(() => steps.findIndex((step) => step.id === status), [status]);

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await requestPasswordReset(email);
      setMessage(data.message || 'Hemos enviado un código de verificación a tu correo.');
      setStatus('verify');
    } catch (err) {
      setError(err.response?.data?.message || 'No pudimos enviar el código. Inténtalo nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateCode = (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (code.length !== 6) {
      setError('Ingresa los 6 dígitos del código.');
      return;
    }

    setStatus('reset');
    setMessage('Código validado. Ahora crea tu nueva contraseña.');
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setIsLoading(false);
      setError('Las contraseñas no coinciden.');
      return;
    }

    try {
      const data = await resetPassword({ email, code, newPassword, confirmPassword });
      setMessage(data.message || 'Contraseña actualizada correctamente. Revisa tu correo para la confirmación.');
      setStatus('completed');
    } catch (err) {
      setError(err.response?.data?.message || 'No pudimos actualizar tu contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStatusBadge = () => (
    <div className="status-badge glass">
      <ShieldCheck size={18} />
      <span>Recupera tu acceso de forma segura</span>
    </div>
  );

  const renderStepper = () => (
    <div className="stepper">
      {steps.map((step, index) => {
        const isActive = index === currentStepIndex;
        const isCompleted = index < currentStepIndex || status === 'completed';

        return (
          <div key={step.id} className={`step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
            <div className="step-indicator">
              {isCompleted ? <CheckCircle2 size={18} /> : index + 1}
            </div>
            <div>
              <p className="step-title">{step.title}</p>
              <p className="step-description">{step.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderRequestForm = () => (
    <form className="card" onSubmit={handleRequestCode}>
      <div className="card-header">
        <div className="icon-circle">
          <Mail size={20} />
        </div>
        <div>
          <h2>Recuperar contraseña</h2>
          <p>Ingresa tu correo para enviarte un código de verificación.</p>
        </div>
      </div>
      <label className="field-label" htmlFor="email">Correo electrónico</label>
      <div className="input-wrapper">
        <Mail className="input-icon" />
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@ejemplo.com"
          required
        />
      </div>
      <button type="submit" className="btn-primary" disabled={isLoading}>
        {isLoading ? 'Enviando código...' : 'Enviar código'}
      </button>
    </form>
  );

  const renderCodeForm = () => (
    <form className="card" onSubmit={handleValidateCode}>
      <div className="card-header">
        <div className="icon-circle">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h2>Valida tu código</h2>
          <p>Introduce el código de 6 dígitos que enviamos a tu correo.</p>
        </div>
      </div>
      <InputOTP value={code} onChange={setCode} length={6} autoFocus />
      <div className="actions">
        <button type="button" className="btn-link" onClick={() => setStatus('request')}>
          <ArrowLeft size={16} /> Cambiar correo
        </button>
        <button type="submit" className="btn-primary" disabled={isLoading}>
          Validar código
        </button>
      </div>
    </form>
  );

  const renderResetForm = () => (
    <form className="card" onSubmit={handleResetPassword}>
      <div className="card-header">
        <div className="icon-circle">
          <Lock size={20} />
        </div>
        <div>
          <h2>Establece tu nueva contraseña</h2>
          <p>Debe contener al menos 8 caracteres.</p>
        </div>
      </div>
      <label className="field-label" htmlFor="newPassword">Nueva contraseña</label>
      <div className="input-wrapper">
        <Lock className="input-icon" />
        <input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="••••••••"
          required
          minLength={8}
        />
      </div>
      <label className="field-label" htmlFor="confirmPassword">Confirmar contraseña</label>
      <div className="input-wrapper">
        <Lock className="input-icon" />
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
          minLength={8}
        />
      </div>
      <button type="submit" className="btn-primary" disabled={isLoading}>
        {isLoading ? 'Actualizando...' : 'Cambiar contraseña'}
      </button>
    </form>
  );

  const renderSuccess = () => (
    <div className="card success-card">
      <div className="success-icon">
        <CheckCircle2 size={48} />
      </div>
      <h2>¡Contraseña actualizada!</h2>
      <p>Te enviamos un correo confirmando el cambio. Ahora puedes iniciar sesión.</p>
      <a className="btn-primary" href="/login">Volver al inicio de sesión</a>
    </div>
  );

  return (
    <div className="forgot-container">
      <div className="background-grid" />
      <div className="forgot-card glass">
        {renderStatusBadge()}
        <h1>¿Olvidaste tu contraseña?</h1>
        <p className="subtitle">Sigue los pasos para recuperar el acceso a tu cuenta de Auto Manager.</p>
        {renderStepper()}

        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}

        {status === 'request' && renderRequestForm()}
        {status === 'verify' && renderCodeForm()}
        {status === 'reset' && renderResetForm()}
        {status === 'completed' && renderSuccess()}
      </div>
    </div>
  );
};

export default ForgotPassword;