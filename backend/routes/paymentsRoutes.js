const express = require('express');
const router = express.Router();
const { 
  createPaymentIntent,
  confirmPayment,
  stripeWebhook,
  getPaymentHistory,
  getPendingPayments
} = require('../controllers/paymentsController');
const { verifyToken } = require('../middleware/authMiddleware');

// Rutas que requieren autenticación (conductores logueados)
router.post('/create-payment-intent', verifyToken, createPaymentIntent);
router.post('/confirm-payment', verifyToken, confirmPayment);
router.get('/history', verifyToken, getPaymentHistory);
router.get('/pending', verifyToken, getPendingPayments);

// Webhook de Stripe (público - viene directo de Stripe)
router.post('/webhook', stripeWebhook);

module.exports = router;