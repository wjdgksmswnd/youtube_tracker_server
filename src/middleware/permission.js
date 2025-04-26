// src/middleware/permission.js - 권한 검사 미들웨어
const db = require('../db');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * 권한 확인 미들웨어
 * @param {string} permission - 필요한 권한 키
 * @returns {Function} 미들웨어 함수
 */
const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      // 레거시 사용자는 기본 권한만 가짐
      if (req.user.legacy) {
        if (permission === 'dashboard.view' || permission === 'history.view') {
          return next();
        }
        return next(new AppError('권한이 없습니다', 403));
      }
      
      // 사용자 레벨의 권한 확인
      const permQuery = await db.query(`
        SELECT la.id FROM level_auth la
        JOIN auth a ON la.auth_id = a.id
        WHERE la.level_id = ? AND a.auth_key = ? AND la.is_active = TRUE AND a.is_active = TRUE
      `, [req.user.level_id, permission]);
      
      if (permQuery.rows.length > 0) {
        return next();
      }
      
      // 그룹별 특수 권한 확인 (해당하는 경우)
      if (req.user.group_id) {
        const groupPermQuery = await db.query(`
          SELECT ag.id FROM auth_group ag
          JOIN auth a ON ag.auth_id = a.id
          WHERE ag.group_id = ? AND ag.user_id = ? AND a.auth_key = ? 
            AND ag.is_active = TRUE AND a.is_active = TRUE
        `, [req.user.group_id, req.user.id, permission]);
        
        if (groupPermQuery.rows.length > 0) {
          return next();
        }
      }
      
      // 권한이 없는 경우
      return next(new AppError('권한이 없습니다', 403));
    } catch (err) {
      logger.error('권한 확인 중 오류:', err);
      return next(new AppError('서버 오류', 500));
    }
  };
};

module.exports = {
  checkPermission
};