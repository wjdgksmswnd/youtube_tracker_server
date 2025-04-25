// src/middleware/ipRestrict.js - IP 제한 미들웨어
const { AppError } = require('../utils/errors');
const { logger } = require('../utils/logger');

/**
 * IP 제한 미들웨어
 * 특정 엔드포인트에 대한 접근을 특정 IP로 제한
 * @param {string[]} allowedIps - 허용된 IP 목록 (기본값: localhost)
 * @returns {Function} 미들웨어 함수
 */
const ipRestrict = (allowedIps = ['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1']) => {
  return (req, res, next) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // 로컬호스트 체크를 개선 (다양한 표현 방식 처리)
    const isLocalhost = isLocalhostIP(clientIp);
    
    logger.debug(`IP 접근 제한 체크: ${clientIp}, 로컬호스트 여부: ${isLocalhost}`);
    
    // IP 주소 확인 - 로컬호스트면 항상 허용
    if (isLocalhost || allowedIps.includes(clientIp)) {
      logger.debug(`IP 접근 허용: ${clientIp}`);
      return next();
    }
    
    logger.warn(`허용되지 않은 IP 접근 시도: ${clientIp}`);
    return next(new AppError('이 기능은 로컬 접근만 허용됩니다', 403));
  };
};

/**
 * 로컬호스트 IP인지 확인
 * @param {string} ip - 확인할 IP 주소
 * @returns {boolean} 로컬호스트 여부
 */
function isLocalhostIP(ip) {
  // 일반적인 로컬호스트 IP 주소들
  const localhostIPs = [
    '127.0.0.1',
    '::1',
    'localhost',
    '::ffff:127.0.0.1'
  ];
  
  // 정확한 일치 확인
  if (localhostIPs.includes(ip)) {
    return true;
  }
  
  // IPv6 형식의 로컬호스트 확인 (다양한 표현 가능)
  if (ip.startsWith('::ffff:127.')) {
    return true;
  }
  
  // 127.0.0.0/8 대역 확인 (모든 127.x.x.x는 로컬호스트)
  if (ip.startsWith('127.')) {
    return true;
  }
  
  return false;
}

module.exports = {
  ipRestrict
};