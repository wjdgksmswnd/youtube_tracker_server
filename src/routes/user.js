// src/routes/user.js - 사용자 관련 라우터
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const authController = require('../controllers/auth');
const { checkPermission } = require('../middleware/permission');

// 사용자 생성 라우트
router.post('/create', 
  authController.authenticate, 
  checkPermission('user.create'), 
  userController.createUser
);

// 다수 사용자 생성 라우트
router.post('/bulk-create', 
  authController.authenticate, 
  checkPermission('user.admin'), 
  userController.bulkCreateUsers
);

// 사용자 목록 조회 라우트
router.get('/list', 
  authController.authenticate, 
  checkPermission('user.admin'), 
  userController.listUsers
);

// 사용자 정보 업데이트 라우트
router.put('/:userId', 
  authController.authenticate, 
  checkPermission('user.admin'), 
  userController.updateUser
);

// 비밀번호 초기화 라우트
router.put('/:userId/password-reset', 
  authController.authenticate, 
  checkPermission('user.admin'), 
  userController.resetPassword
);

// 사용자 레벨 변경 라우트
router.put('/:userId/level', 
  authController.authenticate, 
  checkPermission('user.level'), 
  userController.changeLevel
);

// 사용자 그룹 변경 라우트
router.put('/:userId/group', 
  authController.authenticate, 
  checkPermission('user.group'), 
  userController.changeGroup
);

// 현재 사용자 비밀번호 변경 라우트
router.put('/change-password', 
  authController.authenticate, 
  userController.changePassword
);

module.exports = router;