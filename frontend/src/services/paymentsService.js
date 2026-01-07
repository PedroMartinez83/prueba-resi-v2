import api from './api';

export const paymentsService = {
  // Obtener pagos pendientes
  getPendingPayments: async () => {
    try {
      const response = await api.get('/payments/pending');
      return response.data;
    } catch (error) {
      console.error('Error obteniendo pagos pendientes:', error);
      throw error;
    }
  },

  // Obtener historial de pagos
  getPaymentHistory: async () => {
    try {
      const response = await api.get('/payments/history');
      return response.data;
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      throw error;
    }
  },

  // Crear intención de pago
  createPaymentIntent: async (paymentData) => {
    try {
      const response = await api.post('/payments/create-payment-intent', paymentData);
      return response.data;
    } catch (error) {
      console.error('Error creando payment intent:', error);
      throw error;
    }
  },

  // Confirmar pago
  confirmPayment: async (paymentIntentId) => {
    try {
      const response = await api.post('/payments/confirm-payment', { paymentIntentId });
      return response.data;
    } catch (error) {
      console.error('Error confirmando pago:', error);
      throw error;
    }
  }
};