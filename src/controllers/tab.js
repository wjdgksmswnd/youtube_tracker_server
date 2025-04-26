// src/controllers/tabs.js - 탭 관련 컨트롤러
const db = require('../db');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * 사용자가 접근 가능한 탭 목록 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
async function getAccessibleTabs(req, res, next) {
  try {
    // 기본 탭 목록 (모든 사용자 접근 가능)
    const defaultTabs = [
      { id: 'dashboard', title: '대시보드', icon: 'fas fa-home', default: true },
      { id: 'history', title: '청취 기록', icon: 'fas fa-history' }
    ];
    
    // 레거시 사용자인 경우 기본 탭만 반환
    if (req.user.legacy) {
      return res.json({ tabs: defaultTabs });
    }
    
    // 사용자 권한 조회
    const permissionQuery = `
      SELECT DISTINCT a.auth_key
      FROM level_auth la
      JOIN auth a ON la.auth_id = a.id
      WHERE la.level_id = $1 AND la.is_active = TRUE AND a.is_active = TRUE
      
      UNION
      
      SELECT DISTINCT a.auth_key
      FROM auth_group ag
      JOIN auth a ON ag.auth_id = a.id
      WHERE ag.group_id = $2 AND ag.user_id = $3 
        AND ag.is_active = TRUE AND a.is_active = TRUE
    `;
    
    const permissionResult = await db.query(permissionQuery, [
      req.user.level_id,
      req.user.group_id,
      req.user.id
    ]);
    
    // 권한 목록
    const permissions = permissionResult.rows.map(row => row.auth_key);
    
    // 추가 탭 목록 (권한에 따라 접근 제한)
    const additionalTabs = [];
    
    // 그룹 탭
    if (permissions.includes('group.view')) {
      additionalTabs.push({
        id: 'group', 
        title: '그룹', 
        icon: 'fas fa-users'
      });
    }
    
    // 그룹 관리 탭
    if (permissions.includes('group.admin')) {
      additionalTabs.push({
        id: 'group-admin',
        title: '그룹 관리',
        icon: 'fas fa-user-cog'
      });
    }
    
    // 사용자 관리 탭
    if (permissions.includes('user.admin')) {
      additionalTabs.push({
        id: 'user-admin',
        title: '사용자 관리',
        icon: 'fas fa-user-shield'
      });
    }
    
    // 통계 탭
    if (permissions.includes('stats.view')) {
      additionalTabs.push({
        id: 'stats',
        title: '통계',
        icon: 'fas fa-chart-bar'
      });
    }
    
    // 플레이리스트 관리 탭
    if (permissions.includes('playlist.admin')) {
      additionalTabs.push({
        id: 'playlist-admin',
        title: '플레이리스트 관리',
        icon: 'fas fa-music'
      });
    }
    
    // 전체 탭 목록 결합
    const allTabs = [...defaultTabs, ...additionalTabs];
    
    // 결과 반환
    res.json({
      tabs: allTabs
    });
  } catch (err) {
    logger.error('접근 가능한 탭 목록 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
}

module.exports = {
  getAccessibleTabs
};