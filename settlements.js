const express = require('express');
const verifyToken = require('../middleware/auth');
const settlementController = require('../controllers/settlementController');

const router = express.Router({ mergeParams: true });

router.use(verifyToken);

router.get('/balances', settlementController.getBalances);
router.post('/settle', settlementController.settleUp);
router.post('/', settlementController.settleUp);

module.exports = router;

