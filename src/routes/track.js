// src/routes/track.js - 트랙 관련 라우터
const express = require('express');
const router = express.Router();
const trackController = require('../controllers/track');
const authController = require('../controllers/auth');
const { checkPermission } = require('../middleware/permission');

// 트랙 목록 조회
router.get('/list', 
  authController.authenticate, 
  checkPermission('playlist.view'), 
  trackController.listTracks
);

// 특정 트랙 조회
router.get('/:trackId', 
  authController.authenticate, 
  trackController.getTrack
);

// 트랙 승인 확인 (Chrome Extension용)
router.get('/verify/:youtubeTrackId', 
  authController.authenticate, 
  trackController.verifyTrack
);

module.exports = router;