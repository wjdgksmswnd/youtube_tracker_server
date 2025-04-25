// src/routes/playlist.js - 플레이리스트 관련 라우터
const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlist');
const authController = require('../controllers/auth');
const { checkPermission } = require('../middleware/permission');

// 플레이리스트 목록 조회
router.get('/list', authController.authenticate, playlistController.listPlaylists);

// 추천 플레이리스트 조회
router.get('/recommended', authController.authenticate, playlistController.getRecommendedPlaylists);

// 특정 플레이리스트 조회
router.get('/:playlistId', authController.authenticate, playlistController.getPlaylist);

// 플레이리스트 생성
router.post('/', 
  authController.authenticate, 
  checkPermission('playlist.create'), 
  playlistController.createPlaylist
);

// 플레이리스트 수정
router.put('/:playlistId', 
  authController.authenticate, 
  checkPermission('playlist.edit'), 
  playlistController.updatePlaylist
);

// 플레이리스트 삭제
router.delete('/:playlistId', 
  authController.authenticate, 
  checkPermission('playlist.delete'), 
  playlistController.deletePlaylist
);

// YouTube 플레이리스트 검색
router.get('/youtube/search', 
  authController.authenticate, 
  checkPermission('playlist.admin'), 
  playlistController.searchYouTubePlaylist
);

// YouTube 플레이리스트 정보 조회
router.get('/youtube/:youtubePlaylistId', 
  authController.authenticate, 
  playlistController.getYouTubePlaylist
);

// YouTube 플레이리스트 동기화
router.post('/youtube/sync/:playlistId', 
  authController.authenticate, 
  checkPermission('playlist.edit'), 
  playlistController.syncYouTubePlaylist
);

module.exports = router;