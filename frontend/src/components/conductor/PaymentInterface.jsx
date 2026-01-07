import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, DollarSign, Calendar, AlertCircle, CheckCircle, Loader, X } from 'lucide-react';
import { paymentsService } from '../../services/paymentsService';

// Inicializar Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

// Estilos para el CardElement de Stripe con los colores de la marca
const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#24272c',
      fontFamily: '"Inter", system-ui, sans-serif',
      '::placeholder': {
        color: '#9ca3af',
      },
      iconColor: '#5cbfde',
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
};

// Componente del formulario de pago
const PaymentForm = ({ selectedPayment, onPaymentSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [clientSecret, setClientSecret] = useState('');

  // Crear payment intent cuando se selecciona un pago
  useEffect(() => {
    if (selectedPayment) {
      createPaymentIntent();
    }
  }, [selectedPayment]);

  const createPaymentIntent = async () => {
    try {
      setError(null);
      const data = await paymentsService.createPaymentIntent({
        amount: selectedPayment.monto,
        conductorId: selectedPayment.conductorId,
        rentaId: selectedPayment.isBulk ? null : selectedPayment.id,
        descripcion: selectedPayment.concepto,
        payAll: selectedPayment.isBulk
      });
      
      if (data.success) {
        setClientSecret(data.clientSecret);
      } else {
        setError(data.error || 'Error creando intención de pago');
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
      console.error('Error:', err);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setProcessing(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);

    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: selectedPayment.conductorNombre || 'Conductor',
          },
        }
      });

      if (stripeError) {
        setError(stripeError.message);
        setProcessing(false);
      } else if (paymentIntent.status === 'succeeded') {
        // Confirmar pago en el backend
        await confirmPayment(paymentIntent.id);
      }
    } catch (err) {
      setError('Error procesando el pago');
      setProcessing(false);
    }
  };

  const confirmPayment = async (paymentIntentId) => {
    try {
      const data = await paymentsService.confirmPayment(paymentIntentId);
      
      if (data.success) {
        onPaymentSuccess(data.paymentDetails);
      } else {
        setError(data.error || 'Error confirmando pago');
      }
    } catch (err) {
      setError('Error confirmando pago en el servidor');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold" style={{ color: '#24272c' }}>Procesar Pago</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Detalles del pago */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">Concepto:</span>
            <span className="font-medium" style={{ color: '#24272c' }}>{selectedPayment?.concepto}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">Periodo:</span>
            <span className="font-medium" style={{ color: '#24272c' }}>{selectedPayment?.periodo}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Monto:</span>
            <span className="text-2xl font-bold" style={{ color: '#5cbfde' }}>
              ${selectedPayment?.monto?.toLocaleString()} MXN
            </span>
          </div>
          {selectedPayment?.isBulk && (
            <p className="mt-2 text-sm text-gray-500">
              Incluye {selectedPayment?.rentaIds?.length || 0} adeudo(s) pendientes.
            </p>
          )}
        </div>

        {/* Formulario de pago */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: '#24272c' }}>
              Información de la tarjeta
            </label>
            <div className="border border-gray-300 rounded-lg p-3 bg-white focus-within:border-blue-400 transition-colors">
              <CardElement options={cardElementOptions} />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              disabled={processing}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!stripe || processing || !clientSecret}
              className="flex-1 py-3 px-4 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: processing ? '#9ca3af' : '#5cbfde' }}
            >
              {processing ? (
                <div className="flex items-center justify-center">
                  <Loader className="w-5 h-5 animate-spin mr-2" />
                  Procesando...
                </div>
              ) : (
                `${selectedPayment?.isBulk ? 'Pagar adeudos' : 'Pagar'} $${selectedPayment?.monto?.toLocaleString()}`
              )}
            </button>
          </div>
        </form>

        {/* Seguridad */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500 flex items-center justify-center">
            <span className="mr-1">🔒</span>
            Pago seguro procesado por Stripe
          </p>
        </div>
      </div>
    </div>
  );
};

// Componente principal de pagos
const PaymentInterface = () => {
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [conductorId, setConductorId] = useState(null);

  useEffect(() => {
    fetchPendingPayments();
  }, []);

  const fetchPendingPayments = async () => {
    try {
      setLoading(true);
      const data = await paymentsService.getPendingPayments();
      
      if (data.success) {
        setPendingPayments(data.pendingPayments || []);
        setConductorId(data.conductorId || null);
      } else {
        console.error('Error fetching payments:', data);
      }
    } catch (error) {
      console.error('Error fetching pending payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (paymentDetails) => {
    setPaymentSuccess(paymentDetails);
    setSelectedPayment(null);
    
    // Refrescar lista después de 2 segundos para dar tiempo a la UI
    setTimeout(() => {
      fetchPendingPayments();
    }, 2000);
    
    // Limpiar mensaje de éxito después de 5 segundos
    setTimeout(() => {
      setPaymentSuccess(null);
    }, 5000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin" style={{ color: '#5cbfde' }} />
        <span className="ml-3 text-gray-600">Cargando pagos pendientes...</span>
      </div>
    );
  }

  const oldestPayment = pendingPayments[0];
  const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + (p.monto || 0), 0);
  const blockedMessage = oldestPayment?.fechaVencimiento
    ? `Debes pagar primero la renta con vencimiento ${new Date(oldestPayment.fechaVencimiento).toLocaleDateString('es-MX')}.`
    : 'Debes pagar primero el adeudo más antiguo.';

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: '#24272c' }}>
          Pagos Pendientes
        </h1>
        <p className="text-gray-600">Gestiona tus pagos de renta de forma rápida y segura</p>
      </div>

      {/* Mensaje de éxito */}
      {paymentSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center animate-fade-in">
          <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" />
          <div>
            <p className="text-green-800 font-medium">¡Pago procesado exitosamente!</p>
            <p className="text-green-600 text-sm">
              ID: {paymentSuccess.id} • Monto: ${paymentSuccess.amount?.toLocaleString()} MXN
            </p>
          </div>
        </div>
      )}

      {/* Resumen de pagos pendientes */}
      {pendingPayments.length > 0 && (
        <div className="mb-6 p-4 rounded-lg border-l-4" style={{ backgroundColor: '#f8fafc', borderLeftColor: '#5cbfde' }}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium" style={{ color: '#24272c' }}>
                Tienes {pendingPayments.length} pago{pendingPayments.length !== 1 ? 's' : ''} pendiente{pendingPayments.length !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-gray-600">
                Total: ${totalPendingAmount.toLocaleString()} MXN
              </p>
              {pendingPayments.length > 1 && (
                <p className="text-xs text-gray-500 mt-1">
                  {blockedMessage}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8" style={{ color: '#5cbfde' }} />
              {pendingPayments.length > 1 && (
                <button
                  onClick={() => setSelectedPayment({
                    id: 'bulk',
                    monto: totalPendingAmount,
                    conductorId: conductorId,
                    concepto: 'Adeudos pendientes',
                    periodo: 'Todas las rentas pendientes',
                    isBulk: true,
                    rentaIds: pendingPayments.map((payment) => payment.id)
                  })}
                  className="px-4 py-2 text-white rounded-lg font-medium shadow-sm transition-all"
                  style={{ backgroundColor: '#5cbfde' }}
                >
                  Pagar todo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lista de pagos pendientes */}
      {pendingPayments.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
          <h3 className="text-xl font-medium mb-2" style={{ color: '#24272c' }}>
            ¡Estás al corriente!
          </h3>
          <p className="text-gray-600">No tienes pagos pendientes en este momento</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingPayments.map((payment) => (
            <div
              key={payment.id}
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-3">
                    <CreditCard className="w-5 h-5 mr-2" style={{ color: '#5cbfde' }} />
                    <h3 className="font-semibold" style={{ color: '#24272c' }}>
                      {payment.concepto}
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>Periodo: {payment.periodo}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <DollarSign className="w-4 h-4 mr-2" />
                      <span>Monto: ${payment.monto?.toLocaleString()} MXN</span>
                    </div>
                    {payment.fechaVencimiento && (
                      <div className="flex items-center text-sm text-gray-600">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        <span>
                          Vence: {new Date(payment.fechaVencimiento).toLocaleDateString('es-MX')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => setSelectedPayment({
                    ...payment,
                    conductorId: conductorId,
                    isBulk: false
                  })}
                  disabled={payment.id !== oldestPayment?.id}
                  className="ml-4 px-6 py-3 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#5cbfde' }}
                  title={payment.id !== oldestPayment?.id ? blockedMessage : undefined}
                >
                  Pagar Ahora
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de pago */}
      {selectedPayment && (
        <Elements stripe={stripePromise}>
          <PaymentForm
            selectedPayment={selectedPayment}
            onPaymentSuccess={handlePaymentSuccess}
            onCancel={() => setSelectedPayment(null)}
          />
        </Elements>
      )}
    </div>
  );
};

export default PaymentInterface;
