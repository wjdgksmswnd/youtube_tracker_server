// src/utils/logger.js - 로깅 유틸리티
const winston = require('winston');
const path = require('path');

// 로그 레벨 정의
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// 환경에 따른 로그 레벨 선택
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

// 로그 형식 정의
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    return `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}`;
  })
);

// 로그 파일 저장 위치
const logDir = process.env.LOG_DIR || 'logs';
const logPath = path.join(logDir, 'app.log');

// 로거 인스턴스 생성
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports: [
    // 콘솔 출력
    new winston.transports.Console({
      format: winston.format.combine(
        // winston.format.colorize(),
        format
      ),
    }),
    // 파일 저장
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: logPath,
    }),
  ],
});

module.exports = {
  logger,
};