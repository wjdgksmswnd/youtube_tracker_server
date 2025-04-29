// src/routes/listening.js - 청취 관련 라우터
const express = require('express');
const router = express.Router();
const listeningController = require('../controllers/listening');
const authController = require('../controllers/auth');
const { checkPermission } = require('../middleware/permission');

// 청취 이벤트 전송 API
router.post('/event', authController.authenticateSession, listeningController.saveListeningEvent);

// 청취 기록 저장 API
// router.post('/', authController.authenticateSession, listeningController.saveListening);

// 청취 기록 조회 API
router.get('/history', 
  authController.authenticate, 
  checkPermission('history.view'), 
  listeningController.getListeningHistory
);

// 최근 청취 기록 조회 API
router.get('/recent', 
  authController.authenticate, 
  checkPermission('history.view'), 
  listeningController.getRecentListening
);

module.exports = router;