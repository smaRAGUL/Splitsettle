const express = require('express');
const verifyToken = require('../middleware/auth');
const groupController = require('../controllers/groupController');
const expenseController = require('../controllers/expenseController');
const settlementController = require('../controllers/settlementController');
const { pool } = require('../config/db');

const router = express.Router();

// All group routes require authentication
router.use(verifyToken);

router.post('/', groupController.createGroup);
router.get('/', groupController.getGroups);
router.get('/:id', groupController.getGroupById);
router.post('/:id/members', groupController.addMember);

// Direct member listing
router.get('/:id/members', async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    const membership = await groupController.checkGroupMembership(groupId, req.user.id);
    if (!membership) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this group.' });
    }

    const [members] = await pool.execute(
      `SELECT u.id, u.name, u.email, gm.role, gm.joined_at
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ?
       ORDER BY u.name ASC`,
      [groupId]
    );

    return res.status(200).json({ members });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch group members.' });
  }
});

// Expenses and settlements nested on group
router.post('/:id/expenses', expenseController.createExpense);
router.get('/:id/expenses', expenseController.getExpenses);
router.get('/:id/balances', settlementController.getBalances);
router.post('/:id/settle', settlementController.settleUp);

// Also support legacy /settlements/balances and /settlements
router.get('/:id/settlements/balances', settlementController.getBalances);
router.get('/:id/settlements', settlementController.getBalances);

module.exports = router;
