const express = require('express');
const verifyToken = require('../middleware/auth');
const expenseController = require('../controllers/expenseController');

const router = express.Router({ mergeParams: true });

router.use(verifyToken);

// Direct expense endpoints
router.put('/:id', expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense);

// If mounted with mergeParams on /groups/:groupId/expenses
router.post('/', expenseController.createExpense);
router.get('/', expenseController.getExpenses);

module.exports = router;

