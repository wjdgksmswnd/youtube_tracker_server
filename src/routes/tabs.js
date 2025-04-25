// src/routes/tabs.js - 탭 관련 라우터
const express = require('express');
const router = express.Router();
const tabsController = require('../controllers/tab');
const authController = require('../controllers/auth');

// 접근 가능한 탭 목록 조회
router.get('/', 
  authController.authenticate, 
  tabsController.getAccessibleTabs
);

module.exports = router;