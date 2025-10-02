// adminRoutes.js
const adminControllers = require('./adminControllers');
const { adminProtect, checkPermission, superAdminOnly } = require('./middleware/adminAuth');

module.exports = (app) => {
  // Admin Authentication
  app.post('/api/admin/login', adminControllers.adminLogin);
  
  // Dashboard
  app.get('/api/admin/dashboard/stats', adminProtect, adminControllers.getDashboardStats);
  
  // User Management
  app.get('/api/admin/users', adminProtect, checkPermission('users', 'view'), adminControllers.getUsers);
  app.get('/api/admin/users/:userId', adminProtect, checkPermission('users', 'view'), adminControllers.getUserDetails);
  app.put('/api/admin/users/:userId/status', adminProtect, checkPermission('users', 'ban'), adminControllers.updateUserStatus);
  app.post('/api/admin/users/:userId/balance', adminProtect, checkPermission('users', 'edit'), adminControllers.adjustUserBalance);
  
  // Transaction Management
  app.get('/api/admin/transactions/pending', adminProtect, checkPermission('transactions', 'view'), adminControllers.getPendingTransactions);
  app.put('/api/admin/transactions/:transactionId/approve', adminProtect, checkPermission('transactions', 'approve'), adminControllers.approveTransaction);
  app.put('/api/admin/transactions/:transactionId/reject', adminProtect, checkPermission('transactions', 'reject'), adminControllers.rejectTransaction);
  
  // Promo Code Management
  app.post('/api/admin/promos', adminProtect, checkPermission('promos', 'create'), adminControllers.createPromoCode);
  app.get('/api/admin/promos', adminProtect, checkPermission('promos', 'view'), adminControllers.getPromoCodes);
  app.put('/api/admin/promos/:promoId', adminProtect, checkPermission('promos', 'edit'), adminControllers.updatePromoCode);
  
  // Reports
  app.get('/api/admin/reports', adminProtect, checkPermission('reports', 'view'), adminControllers.generateReport);
};
