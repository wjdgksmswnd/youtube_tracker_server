// src/routes/admin.js - 관리자 라우터
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin');
const { ipRestrict } = require('../middleware/ipRestrict');
const { logger } = require('../utils/logger');

// 로컬호스트 접근 확인용 미들웨어
const checkLocalAccess = (req, res, next) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  logger.info(`슈퍼유저 페이지 접근 시도: IP=${clientIp}, URL=${req.originalUrl}`);
  next();
};

// 슈퍼유저 관리자 홈 페이지 (localhost에서만 접근 가능)
router.get('/', checkLocalAccess, ipRestrict(), (req, res) => {
  res.send(`
    <h1>관리자 페이지</h1>
    <p>이 페이지는 localhost에서만 접근 가능합니다.</p>
    <ul>
      <li><a href="/api/admin/su">슈퍼유저 관리</a></li>
    </ul>
  `);
});

// 슈퍼유저 생성 라우트 (localhost에서만 접근 가능)
router.post('/su/create', checkLocalAccess, ipRestrict(), adminController.createSuperUser);

// 슈퍼유저 페이지 (localhost에서만 접근 가능)
router.get('/su', checkLocalAccess, ipRestrict(), adminController.getSuperUserPage);

module.exports = router;