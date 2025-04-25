// src/routes/auth.js - 인증 관련 라우터
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const { rateLimit } = require('express-rate-limit');

// 로그인 요청 제한 (브루트포스 공격 방지)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 10, // IP당 최대 요청 수
  standardHeaders: true,
  message: { error: '너무 많은 로그인 시도. 15분 후에 다시 시도하세요.' }
});

// 로그인 라우트
router.post('/login', loginLimiter, authController.login);

// 세션 생성 라우트 (Chrome Extension용)
router.post('/session', authController.authenticate, authController.createSession);

// 세션 종료 라우트
router.delete('/session', authController.authenticate, authController.endSession);

// 토큰 검증 라우트
router.get('/user/verify', authController.authenticate, authController.verifyUser);

module.exports = router;