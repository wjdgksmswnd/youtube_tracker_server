// src/routes/group.js - 그룹 관련 라우터
const express = require('express');
const router = express.Router();
const groupController = require('../controllers/group');
const authController = require('../controllers/auth');
const { checkPermission } = require('../middleware/permission');

// 그룹 목록 조회
router.get('/', 
  authController.authenticate, 
  checkPermission('group.view'), 
  groupController.listGroups
);

// 특정 그룹 조회
router.get('/:groupId', 
  authController.authenticate, 
  checkPermission('group.view'), 
  groupController.getGroup
);

// 그룹 생성
router.post('/', 
  authController.authenticate, 
  checkPermission('group.create'), 
  groupController.createGroup
);

// 그룹 수정
router.put('/:groupId', 
  authController.authenticate, 
  checkPermission('group.edit'), 
  groupController.updateGroup
);

// 그룹 내 사용자 목록 조회
router.get('/:groupId/users', 
  authController.authenticate, 
  checkPermission('group.view'), 
  groupController.getGroupUsers
);

// 그룹에 사용자 추가
router.post('/:groupId/users', 
  authController.authenticate, 
  checkPermission('group.user.manage'), 
  groupController.addUserToGroup
);

// 그룹에서 사용자 제거
router.delete('/:groupId/users/:userId', 
  authController.authenticate, 
  checkPermission('group.user.manage'), 
  groupController.removeUserFromGroup
);

module.exports = router;