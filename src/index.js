// src/index.js - 서버 진입점
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const { logger } = require('./utils/logger');
const { errorHandler } = require('./middleware');

// 라우터 가져오기
const authRouter = require('./routes/auth');
const userRouter = require('./routes/user');
const listeningRouter = require('./routes/listening');
const statsRouter = require('./routes/stats');
const groupRouter = require('./routes/group');
const playlistRouter = require('./routes/playlist');
const trackRouter = require('./routes/track');
const tabsRouter = require('./routes/tabs');
const myAdminRouter = require('./routes/admin');

// Express 앱 초기화
const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(helmet()); // 보안 헤더 설정
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID']
}));
app.use(bodyParser.json()); // JSON 요청 처리
app.use(bodyParser.urlencoded({ extended: true })); // URL-encoded 폼 데이터 처리
app.use(express.static('public')); // 정적 파일 제공

// 로깅 미들웨어
app.use((req, res, next) => {
  const start = Date.now();
  logger.info(`${req.method} ${req.originalUrl}`);
  
  const origSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    return origSend.apply(this, arguments);
  };
  
  next();
});

// 리디렉션 미들웨어
app.use((req, res, next) => {
  const host = req.headers.host;
  
  // Cloud Run URL인 경우 새 도메인으로 리디렉션
  if (host === 'youtube-music-tracker-928310990532.asia-northeast3.run.app') {
    return res.redirect(301, `https://odo.ist${req.originalUrl}`);
  }
  
  next();
});

// 기본 라우트
// 기본 라우트
app.get('/', (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || 
    clientIp === 'localhost' || clientIp === '::ffff:127.0.0.1' ||
    clientIp.startsWith('127.') || clientIp.startsWith('::ffff:127.');
  
  res.send(`
    <html>
    <head>
      <title>YouTube Music Tracker 서버</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #4285f4; }
        ul { line-height: 1.6; }
        .note { background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 20px; }
        .localhost-only { color: #ea4335; }
      </style>
    </head>
    <body>
      <h1>YouTube Music Tracker 서버 실행 중</h1>
      <p>현재 API 서버가 정상적으로 실행 중입니다.</p>
      
      <h2>주요 접근 경로:</h2>
      <ul>
        <li><a href="/api">API 서버 상태 확인</a></li>
        <li><a href="/dashboard.html">대시보드</a></li>
        ${isLocalhost ? '<li><a href="/api/admin">관리자 페이지 (로컬호스트에서만 접근 가능)</a></li>' : ''}
      </ul>
      
      <div class="note">
        <p>현재 접속 IP: ${clientIp}</p>
        <p>${isLocalhost ? '로컬호스트에서 접속 중입니다. 관리자 기능을 사용할 수 있습니다.' : 
          '<span class="localhost-only">로컬호스트(127.0.0.1)에서만 접근 가능한 관리자 기능이 있습니다.</span>'}</p>
      </div>
    </body>
    </html>
  `);
});

app.get('/api', (req, res) => res.json({ 
  message: 'API 서버 실행 중', 
  version: '2.0.0',
  datetime: new Date().toISOString()
}));

// API 라우터 설정
app.use('/api', authRouter);
app.use('/api/user', userRouter);
app.use('/api/listening', listeningRouter);
app.use('/api/stats', statsRouter);
app.use('/api/group', groupRouter);
app.use('/api/playlist', playlistRouter);
app.use('/api/track', trackRouter);
app.use('/api/tabs', tabsRouter);
app.use('/api/admin', myAdminRouter);

// 오류 처리 미들웨어
app.use(errorHandler);

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`서버가 포트 ${PORT}에서 실행 중`);
});