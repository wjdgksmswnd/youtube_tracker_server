// src/routes/stats.js - 통계 관련 라우터
const express = require('express');
const router = express.Router();
const statsController = require('../controllers/stats');
const authController = require('../controllers/auth');
const { checkPermission } = require('../middleware/permission');

// 요약 통계 조회
router.get('/summary',
  authController.authenticate,
  checkPermission('stats.view'),
  statsController.getSummary
);

// 일별 통계 조회
router.get('/daily',
  authController.authenticate,
  checkPermission('stats.view'),
  statsController.getDailyStats
);

// 시간별 통계 조회
router.get('/hourly',
  authController.authenticate,
  checkPermission('stats.view'),
  statsController.getHourlyStats
);

// 그룹별 통계 조회
router.get('/groups',
  authController.authenticate,
  checkPermission('stats.view'),
  statsController.getGroupStats
);

// 플레이리스트별 통계 조회
router.get('/playlists',
  authController.authenticate,
  checkPermission('stats.view'),
  statsController.getPlaylistStats
);

// 트랙별 통계 조회
router.get('/tracks',
  authController.authenticate,
  checkPermission('stats.view'),
  statsController.getTrackStats
);

// 통계 내보내기
router.get('/export',
  authController.authenticate,
  checkPermission('stats.export'),
  statsController.exportStats
);

// 그룹별 일별 통계 조회
router.get('/group/:groupId',
  authController.authenticate,
  checkPermission('group.report'),
  statsController.getGroupDailyStats
);

module.exports = router;