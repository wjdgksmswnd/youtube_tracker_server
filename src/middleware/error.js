// src/middleware/error.js - 에러 처리 미들웨어
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * 404 에러 처리 미들웨어
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const notFound = (req, res, next) => {
  next(new AppError(`요청한 리소스를 찾을 수 없습니다: ${req.originalUrl}`, 404));
};

/**
 * 글로벌 에러 처리 미들웨어
 * @param {Error} err - 발생한 에러
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const errorHandler = (err, req, res, next) => {
  // AppError가 아닌 경우 로깅 및 변환
  if (!(err instanceof AppError)) {
    logger.error('처리되지 않은 에러:', err);
    
    // MariaDB 특정 에러 처리
    if (err.code === 'ER_DUP_ENTRY') {
      err = new AppError('데이터 중복 오류가 발생했습니다', 409);
    } else if (err.code === 'ER_NO_REFERENCED_ROW') {
      err = new AppError('참조 무결성 오류가 발생했습니다', 400);
    } else {
      err = new AppError(err.message || '서버 오류가 발생했습니다', 500);
    }
  }
  
  // 응답 상태 코드 설정
  const statusCode = err.statusCode || 500;
  
  // 개발 환경에서는 스택 트레이스 포함, 프로덕션에서는 제외
  const response = {
    error: err.message,
    ...err.extras,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  };
  
  // 에러 로깅 (500 에러만)
  if (statusCode >= 500) {
    logger.error(`${statusCode} 에러: ${err.message}`);
    logger.error(err.stack);
  } else {
    logger.info(`${statusCode} 에러: ${err.message}`);
  }
  
  // 에러 응답
  res.status(statusCode).json(response);
};

module.exports = {
  notFound,
  errorHandler
};