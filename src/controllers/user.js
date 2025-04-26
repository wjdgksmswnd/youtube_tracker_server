// src/controllers/user.js - 사용자 관련 컨트롤러
const bcrypt = require('bcryptjs');
const db = require('../db');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * 새 사용자 생성
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const createUser = async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    // 필수 필드 확인
    const { user_id, username, password, level_id, group_id } = req.body;
    
    if (!user_id || !username || !password) {
      return next(new AppError('사용자 ID, 이름, 비밀번호가 필요합니다', 400));
    }
    
    await client.beginTransaction();
    
    // 사용자 ID 중복 확인
    const userCheck = await client.query('SELECT id FROM `user` WHERE user_id = ?', [user_id]);
    if (userCheck.rows.length > 0) {
      return next(new AppError('이미 사용 중인 사용자 ID입니다', 409));
    }
    
    // bcrypt로 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 사용자 생성 (MariaDB에서는 RETURNING 지원 안함)
    const result = await client.query(`
      INSERT INTO \`user\` (user_id, username, password, level_id, group_id)
      VALUES (?, ?, ?, ?, ?)
    `, [user_id, username, hashedPassword, level_id, group_id]);
    
    // 생성된 사용자 ID 확인
    let userId = result.insertId;
    
    // 생성된 사용자 정보 조회
    const userInfo = await client.query(`
      SELECT id, user_id, username, level_id, group_id, created_at
      FROM \`user\` WHERE id = ?
    `, [userId]);
    
    await client.commit();
    
    // 생성된 사용자 정보 반환
    res.status(201).json({
      message: '사용자가 생성되었습니다',
      user: userInfo.rows[0]
    });
  } catch (err) {
    await client.rollback();
    logger.error('사용자 생성 오류:', err);
    
    if (err.code === 'ER_DUP_ENTRY') { // MariaDB의 중복 키 오류 코드
      return next(new AppError('이미 사용 중인 ID 또는 이메일입니다', 409));
    }
    
    return next(new AppError('서버 오류', 500));
  } finally {
    client.release();
  }
};

/**
 * 다수 사용자 일괄 생성
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const bulkCreateUsers = async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    const { users } = req.body;
    
    if (!users || !Array.isArray(users) || users.length === 0) {
      return next(new AppError('유효한 사용자 목록이 필요합니다', 400));
    }
    
    await client.beginTransaction();
    
    const results = [];
    const errors = [];
    
    // 각 사용자 처리
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      
      // 필수 필드 확인
      if (!user.user_id || !user.username || !user.password) {
        errors.push({
          index: i,
          user_id: user.user_id || '(없음)',
          error: '사용자 ID, 이름, 비밀번호가 필요합니다'
        });
        continue;
      }
      
      try {
        // 사용자 ID 중복 확인
        const userCheck = await client.query('SELECT id FROM `user` WHERE user_id = ?', [user.user_id]);
        if (userCheck.rows.length > 0) {
          errors.push({
            index: i,
            user_id: user.user_id,
            error: '이미 사용 중인 사용자 ID입니다'
          });
          continue;
        }
        
        // bcrypt로 비밀번호 암호화
        const hashedPassword = await bcrypt.hash(user.password, 10);
        
        // 사용자 생성
        const result = await client.query(`
          INSERT INTO \`user\` (user_id, username, password, level_id, group_id)
          VALUES (?, ?, ?, ?, ?)
        `, [user.user_id, user.username, hashedPassword, user.level_id, user.group_id]);
        
        // 생성된 사용자 정보 조회
        const userInfo = await client.query(`
          SELECT id, user_id, username, level_id, group_id
          FROM \`user\` WHERE id = ?
        `, [result.insertId]);
        
        results.push(userInfo.rows[0]);
      } catch (err) {
        logger.error(`사용자 생성 오류 (index: ${i}):`, err);
        errors.push({
          index: i,
          user_id: user.user_id,
          error: err.code === 'ER_DUP_ENTRY' ? '이미 사용 중인 ID 또는 이메일입니다' : '처리 중 오류가 발생했습니다'
        });
      }
    }
    
    await client.commit();
    
    // 결과 반환
    res.status(results.length > 0 ? 201 : 400).json({
      message: `${results.length}명의 사용자가 생성되었습니다. ${errors.length}건의 오류가 발생했습니다.`,
      success: results,
      errors: errors
    });
  } catch (err) {
    await client.rollback();
    logger.error('대량 사용자 생성 오류:', err);
    return next(new AppError('서버 오류', 500));
  } finally {
    client.release();
  }
};

/**
 * 사용자 목록 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const listUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', group_id, level_id } = req.query;
    
    // 페이지네이션 설정
    const offset = (page - 1) * limit;
    
    // 쿼리 파라미터
    const queryParams = [];
    let whereClause = 'WHERE is_deleted = FALSE';
    
    // 검색어 필터
    if (search) {
      whereClause += ` AND (user_id LIKE ? OR username LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }
    
    // 그룹 필터
    if (group_id) {
      whereClause += ` AND group_id = ?`;
      queryParams.push(group_id);
    }
    
    // 레벨 필터
    if (level_id) {
      whereClause += ` AND level_id = ?`;
      queryParams.push(level_id);
    }
    
    // 총 사용자 수 쿼리
    const countQuery = `SELECT COUNT(*) as count FROM \`user\` ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams);
    const totalUsers = parseInt(countResult.rows[0].count);
    
    // 사용자 목록 쿼리
    const usersQuery = `
      SELECT u.id, u.user_id, u.username, u.level_id, u.group_id, u.created_at, u.last_login,
             l.level_name, ug.group_name
      FROM \`user\` u
      LEFT JOIN \`level\` l ON u.level_id = l.id
      LEFT JOIN \`user_group\` ug ON u.group_id = ug.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    // 페이지네이션 파라미터 추가
    const paginatedParams = [...queryParams, parseInt(limit), offset];
    const usersResult = await db.query(usersQuery, paginatedParams);
    
    // 결과 반환
    res.json({
      users: usersResult.rows,
      pagination: {
        total: totalUsers,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(totalUsers / limit)
      }
    });
  } catch (err) {
    logger.error('사용자 목록 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 사용자 정보 업데이트
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { username, level_id, group_id } = req.body;
    
    // 사용자 존재 확인
    const userCheck = await db.query('SELECT id FROM `user` WHERE id = ? AND is_deleted = FALSE', [userId]);
    if (userCheck.rows.length === 0) {
      return next(new AppError('사용자를 찾을 수 없습니다', 404));
    }
    
    // 업데이트할 필드 준비
    const updateFields = [];
    const queryParams = [];
    
    if (username) {
      updateFields.push(`username = ?`);
      queryParams.push(username);
    }
    
    if (level_id !== undefined) {
      updateFields.push(`level_id = ?`);
      queryParams.push(level_id);
    }
    
    if (group_id !== undefined) {
      updateFields.push(`group_id = ?`);
      queryParams.push(group_id);
    }
    
    // 업데이트할 필드가 없으면 오류
    if (updateFields.length === 0) {
      return next(new AppError('업데이트할 정보가 없습니다', 400));
    }
    
    // 업데이트 시간 추가
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    // 업데이트 쿼리
    const updateQuery = `
      UPDATE \`user\`
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;
    
    // 마지막에 userId 파라미터 추가
    queryParams.push(userId);
    
    await db.query(updateQuery, queryParams);
    
    // 업데이트된 사용자 정보 조회
    const userQuery = `
      SELECT id, user_id, username, level_id, group_id
      FROM \`user\` WHERE id = ?
    `;
    
    const userResult = await db.query(userQuery, [userId]);
    
    // 결과 반환
    res.json({
      message: '사용자 정보가 업데이트되었습니다',
      user: userResult.rows[0]
    });
  } catch (err) {
    logger.error('사용자 업데이트 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 사용자 비밀번호 초기화
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const resetPassword = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // 사용자 존재 확인
    const userCheck = await db.query('SELECT id FROM `user` WHERE id = ? AND is_deleted = FALSE', [userId]);
    if (userCheck.rows.length === 0) {
      return next(new AppError('사용자를 찾을 수 없습니다', 404));
    }
    
    // 임시 비밀번호 생성
    const tempPassword = Math.random().toString(36).substring(2, 10);
    
    // bcrypt로 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    // 비밀번호 업데이트
    await db.query(`
      UPDATE \`user\`
      SET password = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [hashedPassword, userId]);
    
    // 결과 반환
    res.json({
      message: '비밀번호가 성공적으로 초기화되었습니다',
      temp_password: tempPassword
    });
  } catch (err) {
    logger.error('비밀번호 초기화 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 사용자 레벨 변경
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const changeLevel = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { level_id } = req.body;
    
    if (!level_id) {
      return next(new AppError('레벨 ID가 필요합니다', 400));
    }
    
    // 사용자 존재 확인
    const userCheck = await db.query('SELECT id FROM `user` WHERE id = ? AND is_deleted = FALSE', [userId]);
    if (userCheck.rows.length === 0) {
      return next(new AppError('사용자를 찾을 수 없습니다', 404));
    }
    
    // 레벨 존재 확인
    const levelCheck = await db.query('SELECT id FROM `level` WHERE id = ? AND is_active = TRUE', [level_id]);
    if (levelCheck.rows.length === 0) {
      return next(new AppError('유효하지 않은 레벨입니다', 404));
    }
    
    // 사용자 레벨 업데이트
    await db.query('UPDATE `user` SET level_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [level_id, userId]);
    
    // 결과 반환
    res.json({
      message: '사용자 레벨이 업데이트되었습니다'
    });
  } catch (err) {
    logger.error('사용자 레벨 변경 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 사용자 그룹 변경
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const changeGroup = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { group_id } = req.body;
    
    // 사용자 존재 확인
    const userCheck = await db.query('SELECT id FROM `user` WHERE id = ? AND is_deleted = FALSE', [userId]);
    if (userCheck.rows.length === 0) {
      return next(new AppError('사용자를 찾을 수 없습니다', 404));
    }
    
    // 그룹이 지정된 경우 존재 확인
    if (group_id) {
      const groupCheck = await db.query('SELECT id FROM `user_group` WHERE id = ? AND is_active = TRUE', [group_id]);
      if (groupCheck.rows.length === 0) {
        return next(new AppError('유효하지 않은 그룹입니다', 404));
      }
    }
    
    // 사용자 그룹 업데이트
    await db.query('UPDATE `user` SET group_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [group_id, userId]);
    
    // 결과 반환
    res.json({
      message: '사용자 그룹이 업데이트되었습니다'
    });
  } catch (err) {
    logger.error('사용자 그룹 변경 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 현재 사용자 비밀번호 변경
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;
    
    if (!current_password || !new_password) {
      return next(new AppError('현재 비밀번호와 새 비밀번호가 필요합니다', 400));
    }
    
    if (new_password.length < 6) {
      return next(new AppError('비밀번호는 최소 6자 이상이어야 합니다', 400));
    }
    
    // 현재 비밀번호 확인
    const userQuery = await db.query('SELECT password FROM `user` WHERE id = ?', [userId]);
    
    if (userQuery.rows.length === 0) {
      return next(new AppError('사용자를 찾을 수 없습니다', 404));
    }
    
    const currentHashedPassword = userQuery.rows[0].password;
    const passwordMatch = await bcrypt.compare(current_password, currentHashedPassword);
    
    if (!passwordMatch) {
      return next(new AppError('현재 비밀번호가 일치하지 않습니다', 401));
    }
    
    // 새 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(new_password, 10);
    
    // 비밀번호 업데이트
    await db.query(`
      UPDATE \`user\`
      SET password = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [hashedPassword, userId]);
    
    // 결과 반환
    res.json({
      message: '비밀번호가 성공적으로 변경되었습니다'
    });
  } catch (err) {
    logger.error('비밀번호 변경 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

module.exports = {
  createUser,
  bulkCreateUsers,
  listUsers,
  updateUser,
  resetPassword,
  changeLevel,
  changeGroup,
  changePassword
};