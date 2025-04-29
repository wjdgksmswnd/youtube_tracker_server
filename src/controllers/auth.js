// src/controllers/auth.js - 인증 관련 컨트롤러
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * 사용자 로그인 처리
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const login = async (req, res, next) => {
  try {
    const { user_id, password } = req.body;
    
    // 이메일 필드 호환성
    const email = req.body.email || user_id;
    
    // 필수 입력 확인
    if (!user_id && !email) {
      return next(new AppError('아이디가 필요합니다', 400));
    }
    if (!password) {
      return next(new AppError('비밀번호가 필요합니다', 400));
    }
    
    // 1. 먼저 신규 user 테이블에서 검색
    const userQuery = await db.query('SELECT * FROM `user` WHERE user_id = ? AND is_deleted = FALSE', [user_id]);
    if (userQuery.rows.length > 0) {
      return await handleLoginNew(res, next, userQuery.rows[0], password);
    }
  } catch (err) {
    logger.error('로그인 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 신규 사용자 로그인 처리
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 * @param {Object} user - 사용자 정보
 * @param {string} password - 입력 비밀번호
 */
const handleLoginNew = async (res, next, user, password) => {
  try {
    // bcrypt를 사용한 비밀번호 검증
    const pwMatch = await bcrypt.compare(password, user.password);
    
    if (!pwMatch) {
      return next(new AppError('아이디 또는 비밀번호가 잘못되었습니다', 401));
    }
    
    // 로그인 성공, 토큰 생성
    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, id: user.id }, 
      process.env.JWT_SECRET || 'your_jwt_secret_key', 
      { expiresIn: '30d' }
    );
    
    // 마지막 로그인 시간 업데이트
    await db.query('UPDATE `user` SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    
    // 그룹 정보 조회
    let groupInfo = null;
    if (user.group_id) {
      const groupQuery = await db.query('SELECT * FROM user_group WHERE id = ?', [user.group_id]);
      if (groupQuery.rows.length > 0) {
        groupInfo = {
          id: groupQuery.rows[0].id,
          name: groupQuery.rows[0].group_name,
          daily_goal_minutes: groupQuery.rows[0].daily_goal_minutes,
          monthly_goal_minutes: groupQuery.rows[0].monthly_goal_minutes,
          daily_max_minutes: groupQuery.rows[0].daily_max_minutes,
          monthly_min_minutes: groupQuery.rows[0].monthly_min_minutes
        };
      }
    }
    
    // 응답
    return res.json({ 
      message: '로그인 성공', 
      token, 
      user: {
        user_id: user.user_id, 
        username: user.username, 
        group_id: user.group_id
      },
      group: groupInfo
    });
  } catch (err) {
    logger.error('비밀번호 검증 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 레거시 사용자 로그인 처리
 * @deprecated 이전 버전 호환성을 위해 유지됨
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 * @param {string} email - 사용자 이메일
 * @param {string} password - 입력 비밀번호
 */
const handleLoginLegacy = async (res, next, email, password) => {
  try {
    const userRes = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!userRes.rows.length) {
      return next(new AppError('이메일 또는 비밀번호가 잘못되었습니다', 401));
    }
    
    const user = userRes.rows[0];
    
    // bcrypt 비밀번호 검증
    if (!await bcrypt.compare(password, user.password_hash)) {
      return next(new AppError('이메일 또는 비밀번호가 잘못되었습니다', 401));
    }
    
    // 마지막 로그인 시간 업데이트
    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?', [user.user_id]);
    
    // 토큰 생성 (이메일을 user_id로 사용)
    const token = jwt.sign(
      { user_id: email, username: user.username, id: user.user_id, legacy: true }, 
      process.env.JWT_SECRET || 'your_jwt_secret_key', 
      { expiresIn: '30d' }
    );
    
    return res.json({ 
      message: '로그인 성공', 
      token, 
      user: { 
        user_id: user.user_id, 
        username: user.username, 
        email: user.email, 
        virtual_earnings: user.virtual_earnings 
      } 
    });
  } catch (err) {
    logger.error('레거시 로그인 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 토큰 인증 미들웨어
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return next(new AppError('인증 토큰이 필요합니다', 401));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    req.user = decoded;
    
    // Legacy 사용자인 경우 바로 진행
    if (decoded.legacy) {
      req.user.legacy = true;
      return next();
    }
    
    // 신규 사용자 존재 여부 확인
    const userQuery = await db.query(
      'SELECT id, user_id, username, level_id, group_id, is_deleted FROM `user` WHERE id = ? AND is_deleted = FALSE',
      [decoded.id]
    );
    
    if (userQuery.rows.length === 0) {
      return next(new AppError('유효하지 않은 사용자입니다', 401));
    }
    
    // 신규 사용자 정보 설정
    req.user.legacy = false;
    req.user.id = userQuery.rows[0].id;
    req.user.username = userQuery.rows[0].username;
    req.user.level_id = userQuery.rows[0].level_id;
    req.user.group_id = userQuery.rows[0].group_id;
    
    next();
  } catch (err) {
    return next(new AppError('유효하지 않은 토큰입니다', 403));
  }
};

/**
 * 세션 인증 미들웨어 (확장 프로그램용)
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const authenticateSession = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const sessionId = req.headers['x-session-id'];
  
  if (!token) {
    return next(new AppError('인증 토큰이 필요합니다', 401));
  }
  
  try {
    // 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
     
    // 신규 사용자 존재 여부 확인
    const userQuery = await db.query(
      'SELECT id, user_id, username, level_id, group_id, is_deleted FROM `user` WHERE id = ? AND is_deleted = FALSE',
      [decoded.id]
    );
    
    if (userQuery.rows.length === 0) {
      return next(new AppError('유효하지 않은 사용자입니다', 401));
    }
    
    // 신규 사용자 정보 설정
    req.user = {
      ...decoded,
      legacy: false,
      id: userQuery.rows[0].id,
      username: userQuery.rows[0].username,
      level_id: userQuery.rows[0].level_id,
      group_id: userQuery.rows[0].group_id
    };
    
    // 세션 ID가 있으면 세션 검증
    if (sessionId) {
      const sessionResult = await validateSession(req, res, next, sessionId);
      if (!sessionResult) {
        return; // 에러 응답은 validateSession 내에서 처리됨
      }
    }
    
    next();
  } catch (err) {
    return next(new AppError('유효하지 않은 토큰입니다', 403));
  }
};

/**
 * 새 세션 생성
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const createSession = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { device_info, is_extension = true } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // 새 세션 ID 생성 (난수 + 타임스탬프 + 환경 정보)
    const randomPart = crypto.randomBytes(16).toString('hex');
    const timePart = Date.now().toString(36);
    const sessionId = `${randomPart}-${timePart}-${is_extension ? 'ext' : 'web'}`;
    
    // 브라우저 및 OS 정보 추출
    let browser = 'Unknown';
    let os = 'Unknown';
    
    if (userAgent) {
      if (userAgent.includes('Chrome')) browser = 'Chrome';
      else if (userAgent.includes('Firefox')) browser = 'Firefox';
      else if (userAgent.includes('Safari')) browser = 'Safari';
      else if (userAgent.includes('Edge')) browser = 'Edge';
      
      if (userAgent.includes('Windows')) os = 'Windows';
      else if (userAgent.includes('Mac')) os = 'MacOS';
      else if (userAgent.includes('Linux')) os = 'Linux';
      else if (userAgent.includes('Android')) os = 'Android';
      else if (userAgent.includes('iOS')) os = 'iOS';
    }
    
    // Extension 세션인 경우 동일 IP의 다른 Extension 세션 비활성화
    if (is_extension) {
      // 동일 ID + Extension 세션 비활성화
      await db.query(
        'UPDATE user_session SET is_active = FALSE, expired_datetime = now() WHERE user_id = ? AND is_active = TRUE and is_extension = TRUE',
        [userId]
      );
    }
    
    // 새 세션 생성
    await db.query(
      `INSERT INTO user_session (
        session_id, user_id, token, ip_address, browser, os, 
        device_info, created_datetime, last_active, is_active, is_extension
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, TRUE, TRUE)`,
      [
        sessionId, 
        userId, 
        req.headers.authorization.split(' ')[1],
        ipAddress,
        browser,
        os,
        JSON.stringify(device_info || {})
      ]
    );
    
    // 로그인 히스토리에 기록
    await db.query(
      'INSERT INTO login_history (user_id, session_id, ip_address, user_agent, login_status) VALUES (?, ?, ?, ?, ?)',
      [userId, sessionId, ipAddress, userAgent, 'success']
    );
    
    // 그룹 정보 조회 (확장 프로그램인 경우)
    let groupInfo = null;
    if (is_extension && req.user.group_id) {
      const groupQuery = await db.query(
        'SELECT group_name, daily_goal_minutes, monthly_goal_minutes, daily_max_minutes, monthly_min_minutes FROM user_group WHERE id = ?',
        [req.user.group_id]
      );
      
      if (groupQuery.rows.length > 0) {
        groupInfo = {
          id: req.user.group_id,
          name: groupQuery.rows[0].group_name,
          daily_goal_minutes: groupQuery.rows[0].daily_goal_minutes,
          monthly_goal_minutes: groupQuery.rows[0].monthly_goal_minutes,
          daily_max_minutes: groupQuery.rows[0].daily_max_minutes,
          monthly_min_minutes: groupQuery.rows[0].monthly_min_minutes
        };
      }
    }
    
    return res.json({
      message: '세션이 생성되었습니다',
      sessionId,
      ipAddress,
      group: groupInfo
    });
  } catch (err) {
    logger.error('세션 생성 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 세션 종료
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const endSession = async (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      return next(new AppError('세션 ID가 필요합니다', 400));
    }
    
    await db.query(
      'UPDATE user_session SET is_active = FALSE WHERE session_id = ?',
      [sessionId]
    );
    
    // 로그인 히스토리에 로그아웃 기록
    await db.query(
      'INSERT INTO login_history (user_id, session_id, ip_address, user_agent, login_status) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, sessionId, req.headers['x-forwarded-for'] || req.socket.remoteAddress, req.headers['user-agent'], 'logout']
    );
    
    return res.json({ message: '세션이 종료되었습니다' });
  } catch (err) {
    logger.error('세션 종료 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 사용자 정보 검증
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const verifyUser = async (req, res, next) => {
  try {
      // 신규 사용자 정보 조회
      const userQuery = await db.query(
        'SELECT id, user_id, username, level_id, group_id, created_at FROM `user` WHERE id = ?',
        [req.user.id]
      );
      
      if (!userQuery.rows.length) {
        return next(new AppError('사용자를 찾을 수 없습니다', 404));
      }
      
      // 권한 정보 조회
      const permissions = await getUserPermissions(req.user.id, userQuery.rows[0].level_id, userQuery.rows[0].group_id);
      
      return res.json({
        message: '유효한 토큰입니다',
        user: {
          ...userQuery.rows[0],
          permissions
        }
      });
  } catch (err) {
    logger.error('토큰 검증 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 세션 검증
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 * @param {string} sessionId - 세션 ID
 * @param {boolean} isLegacy - 레거시 사용자 여부
 * @returns {boolean} 검증 성공 여부
 */
const validateSession = async (req, res, next, sessionId, isLegacy = false) => {
  try {
    const userId = req.user.id;
    
    // 세션 타입 확인 (extension 여부)
    const isExtension = sessionId.includes('-ext');
    
    // 세션 조회 쿼리
    const sessionQuery = await db.query(
      'SELECT * FROM user_session WHERE session_id = ? AND user_id = ? AND is_active = TRUE',
      [sessionId, userId]
    );
    
    if (sessionQuery.rows.length === 0) {
      // 세션이 없거나 만료된 경우
      const otherSessionQueryParams = [userId, 'TRUE'];
      let otherSessionQueryCondition = ' AND is_active = ?';
      
      const otherSessionQuery = await db.query(
        `SELECT ip_address FROM user_session WHERE user_id = ?${otherSessionQueryCondition} LIMIT 1`,
        otherSessionQueryParams
      );
      
      let message = '세션이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.';
      let ipConflict = false;
      
      if (otherSessionQuery.rows.length > 0) {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        if (otherSessionQuery.rows[0].ip_address === clientIp) {
          message = '같은 IP에서 이미 로그인되어 있습니다. 중복 창은 허용되지 않습니다.';
          ipConflict = true;
        } else {
          message = '다른 장소에서 로그인되어 현재 세션이 종료되었습니다.';
        }
      }
      
      return next(new AppError(message, 401, { error: 'session_expired', ip_conflict: ipConflict }));
    }
    
    // 세션 정보 저장
    req.session = sessionQuery.rows[0];
    
    // 세션 마지막 활동 시간 업데이트
    await db.query(
      'UPDATE user_session SET last_active = CURRENT_TIMESTAMP WHERE session_id = ?',
      [sessionId]
    );
    
    return true;
  } catch (err) {
    logger.error('세션 검증 중 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 사용자 권한 조회
 * @param {number} userId - 사용자 ID
 * @param {number} levelId - 레벨 ID
 * @param {number} groupId - 그룹 ID
 * @returns {Array} 권한 목록
 */
const getUserPermissions = async (userId, levelId, groupId) => {
  try {
    const permissionsQuery = `
      SELECT DISTINCT a.auth_key
      FROM level_auth la
      JOIN auth a ON la.auth_id = a.id
      WHERE la.level_id = ? AND la.is_active = TRUE AND a.is_active = TRUE
      
      UNION
      
      SELECT DISTINCT a.auth_key
      FROM auth_group ag
      JOIN auth a ON ag.auth_id = a.id
      WHERE ag.group_id = ? AND ag.user_id = ? 
        AND ag.is_active = TRUE AND a.is_active = TRUE
    `;
    
    const permissionsResult = await db.query(permissionsQuery, [
      levelId,
      groupId || 0, // 그룹이 없는 경우 0으로 처리 (매칭되지 않음)
      userId
    ]);
    
    return permissionsResult.rows.map(row => row.auth_key);
  } catch (err) {
    logger.error('권한 조회 오류:', err);
    return [];
  }
};

// 내보내기
module.exports = {
  login,
  authenticate,
  authenticateSession,
  createSession,
  endSession,
  verifyUser,
  validateSession
};