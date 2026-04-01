import express from 'express';
import { inviteUser, resendInvite, deleteUser, getSubscriptionDetails, registerPayment, renewUserSubscription } from '../controllers/userController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticate);

// Route to invite a new user
router.post('/invite', inviteUser);
router.post('/resend-invite', resendInvite);
router.delete('/:id', deleteUser);

// Subscription Routes
router.get('/:id/subscription/history', getSubscriptionDetails);
router.post('/:id/subscription/payment', registerPayment);
router.post('/:id/subscription/renew', renewUserSubscription);

export default router;
