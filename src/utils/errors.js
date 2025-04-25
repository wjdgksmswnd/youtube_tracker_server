// src/utils/errors.js - 에러 처리 유틸리티
/**
 * 애플리케이션 커스텀 에러 클래스
 */
class AppError extends Error {
    /**
     * 생성자
     * @param {string} message - 에러 메시지
     * @param {number} statusCode - HTTP 상태 코드
     * @param {Object} extras - 추가 정보
     */
    constructor(message, statusCode = 500, extras = {}) {
      super(message);
      this.statusCode = statusCode;
      this.extras = extras;
      this.name = this.constructor.name;
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  module.exports = {
    AppError
  };