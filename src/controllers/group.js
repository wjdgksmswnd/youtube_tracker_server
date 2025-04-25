// src/controllers/group.js - 그룹 관련 컨트롤러
const db = require('../db');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * 그룹 목록 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const listGroups = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    
    // 페이지네이션 설정
    const offset = (page - 1) * limit;
    
    // 쿼리 파라미터
    const queryParams = [];
    let whereClause = 'WHERE is_active = TRUE';
    
    // 검색어 필터
    if (search) {
      queryParams.push(`%${search}%`);
      whereClause += ` AND group_name ILIKE $${queryParams.length}`;
    }
    
    // 총 그룹 수 쿼리
    const countQuery = `SELECT COUNT(*) FROM user_group ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams);
    const totalGroups = parseInt(countResult.rows[0].count);
    
    // 그룹 목록 쿼리
    const groupsQuery = `
      SELECT id, group_name, description, daily_goal_minutes, monthly_goal_minutes,
             monthly_min_minutes, daily_max_minutes, max_users, contact_email,
             contact_name, expire_date, created_at, updated_at
      FROM user_group
      ${whereClause}
      ORDER BY group_name
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    
    queryParams.push(parseInt(limit), offset);
    const groupsResult = await db.query(groupsQuery, queryParams);
    
    // 각 그룹의 사용자 수 조회
    const groupIds = groupsResult.rows.map(group => group.id);
    
    if (groupIds.length > 0) {
      const userCountQuery = `
        SELECT group_id, COUNT(*) as user_count
        FROM "user"
        WHERE group_id IN (${groupIds.map((_, i) => `$${i + 1}`).join(',')})
          AND is_deleted = FALSE
        GROUP BY group_id
      `;
      
      const userCountResult = await db.query(userCountQuery, groupIds);
      
      // 사용자 수 매핑
      const userCountMap = {};
      userCountResult.rows.forEach(row => {
        userCountMap[row.group_id] = parseInt(row.user_count);
      });
      
      // 결과에 사용자 수 추가
      groupsResult.rows.forEach(group => {
        group.user_count = userCountMap[group.id] || 0;
      });
    }
    
    // 결과 반환
    res.json({
      groups: groupsResult.rows,
      pagination: {
        total: totalGroups,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(totalGroups / limit)
      }
    });
  } catch (err) {
    logger.error('그룹 목록 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 특정 그룹 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const getGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    
    // 그룹 정보 쿼리
    const groupQuery = `
      SELECT id, group_name, description, daily_goal_minutes, monthly_goal_minutes,
             monthly_min_minutes, daily_max_minutes, max_users, contact_email,
             contact_name, expire_date, created_at, updated_at
      FROM user_group
      WHERE id = $1 AND is_active = TRUE
    `;
    
    const groupResult = await db.query(groupQuery, [groupId]);
    
    if (groupResult.rows.length === 0) {
      return next(new AppError('그룹을 찾을 수 없습니다', 404));
    }
    
    // 그룹 내 사용자 수 조회
    const userCountQuery = `
      SELECT COUNT(*) as user_count
      FROM "user"
      WHERE group_id = $1 AND is_deleted = FALSE
    `;
    
    const userCountResult = await db.query(userCountQuery, [groupId]);
    
    // 결과에 사용자 수 추가
    const group = groupResult.rows[0];
    group.user_count = parseInt(userCountResult.rows[0].user_count);
    
    // 결과 반환
    res.json({
      group
    });
  } catch (err) {
    logger.error('그룹 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 그룹 생성
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const createGroup = async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const {
      group_name,
      description,
      daily_goal_minutes,
      monthly_goal_minutes,
      daily_max_minutes,
      monthly_min_minutes,
      max_users,
      contact_email,
      contact_name,
      expire_date
    } = req.body;
    
    // 필수 필드 확인
    if (!group_name) {
      return next(new AppError('그룹 이름이 필요합니다', 400));
    }
    
    // 그룹 이름 중복 확인
    const checkQuery = await client.query(
      'SELECT id FROM user_group WHERE group_name = $1',
      [group_name]
    );
    
    if (checkQuery.rows.length > 0) {
      return next(new AppError('이미 사용 중인 그룹 이름입니다', 409));
    }
    
    // 새 그룹 생성
    const insertQuery = `
      INSERT INTO user_group (
        group_name, description, daily_goal_minutes, monthly_goal_minutes,
        daily_max_minutes, monthly_min_minutes, max_users, contact_email,
        contact_name, expire_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const insertResult = await client.query(insertQuery, [
      group_name,
      description || null,
      daily_goal_minutes || 60,
      monthly_goal_minutes || 1200,
      daily_max_minutes || 120,
      monthly_min_minutes || 600,
      max_users || null,
      contact_email || null,
      contact_name || null,
      expire_date ? new Date(expire_date) : null
    ]);
    
    await client.query('COMMIT');
    
    // 생성된 그룹 정보 반환
    res.status(201).json({
      message: '그룹이 생성되었습니다',
      group: insertResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('그룹 생성 오류:', err);
    
    if (err.code === '23505') { // 중복 키 오류
      return next(new AppError('이미 사용 중인 그룹 이름입니다', 409));
    }
    
    return next(new AppError('서버 오류', 500));
  } finally {
    client.release();
  }
};

/**
 * 그룹 수정
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const updateGroup = async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { groupId } = req.params;
    const {
      group_name,
      description,
      daily_goal_minutes,
      monthly_goal_minutes,
      daily_max_minutes,
      monthly_min_minutes,
      max_users,
      contact_email,
      contact_name,
      expire_date,
      is_active
    } = req.body;
    
    // 그룹 존재 확인
    const checkQuery = await client.query(
      'SELECT id FROM user_group WHERE id = $1',
      [groupId]
    );
    
    if (checkQuery.rows.length === 0) {
      return next(new AppError('그룹을 찾을 수 없습니다', 404));
    }
    
    // 그룹 이름 중복 확인 (다른 그룹과 중복되는지)
    if (group_name) {
      const nameCheckQuery = await client.query(
        'SELECT id FROM user_group WHERE group_name = $1 AND id != $2',
        [group_name, groupId]
      );
      
      if (nameCheckQuery.rows.length > 0) {
        return next(new AppError('이미 사용 중인 그룹 이름입니다', 409));
      }
    }
    
    // 업데이트할 필드 준비
    const updateFields = [];
    const queryParams = [groupId]; // 첫 번째 파라미터는 groupId
    
    if (group_name !== undefined) {
      queryParams.push(group_name);
      updateFields.push(`group_name = $${queryParams.length}`);
    }
    
    if (description !== undefined) {
      queryParams.push(description);
      updateFields.push(`description = $${queryParams.length}`);
    }
    
    if (daily_goal_minutes !== undefined) {
      queryParams.push(daily_goal_minutes);
      updateFields.push(`daily_goal_minutes = $${queryParams.length}`);
    }
    
    if (monthly_goal_minutes !== undefined) {
      queryParams.push(monthly_goal_minutes);
      updateFields.push(`monthly_goal_minutes = $${queryParams.length}`);
    }
    
    if (daily_max_minutes !== undefined) {
      queryParams.push(daily_max_minutes);
      updateFields.push(`daily_max_minutes = $${queryParams.length}`);
    }
    
    if (monthly_min_minutes !== undefined) {
      queryParams.push(monthly_min_minutes);
      updateFields.push(`monthly_min_minutes = $${queryParams.length}`);
    }
    
    if (max_users !== undefined) {
      queryParams.push(max_users);
      updateFields.push(`max_users = $${queryParams.length}`);
    }
    
    if (contact_email !== undefined) {
      queryParams.push(contact_email);
      updateFields.push(`contact_email = $${queryParams.length}`);
    }
    
    if (contact_name !== undefined) {
      queryParams.push(contact_name);
      updateFields.push(`contact_name = $${queryParams.length}`);
    }
    
    if (expire_date !== undefined) {
      queryParams.push(expire_date ? new Date(expire_date) : null);
      updateFields.push(`expire_date = $${queryParams.length}`);
    }
    
    if (is_active !== undefined) {
      queryParams.push(!!is_active); // boolean으로 변환
      updateFields.push(`is_active = $${queryParams.length}`);
    }
    
    // 업데이트 시간 추가
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    // 업데이트할 필드가 없으면 오류
    if (updateFields.length === 0) {
      return next(new AppError('업데이트할 정보가 없습니다', 400));
    }
    
    // 그룹 업데이트
    const updateQuery = `
      UPDATE user_group
      SET ${updateFields.join(', ')}
      WHERE id = $1
      RETURNING *
    `;
    
    const updateResult = await client.query(updateQuery, queryParams);
    
    await client.query('COMMIT');
    
    // 업데이트된 그룹 정보 반환
    res.json({
      message: '그룹이 업데이트되었습니다',
      group: updateResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('그룹 업데이트 오류:', err);
    
    if (err.code === '23505') { // 중복 키 오류
      return next(new AppError('이미 사용 중인 그룹 이름입니다', 409));
    }
    
    return next(new AppError('서버 오류', 500));
  } finally {
    client.release();
  }
};

/**
 * 그룹 내 사용자 목록 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const getGroupUsers = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 20, search = '' } = req.query;
    
    // 페이지네이션 설정
    const offset = (page - 1) * limit;
    
    // 그룹 존재 확인
    const groupQuery = await db.query(
      'SELECT id FROM user_group WHERE id = $1 AND is_active = TRUE',
      [groupId]
    );
    
    if (groupQuery.rows.length === 0) {
      return next(new AppError('그룹을 찾을 수 없습니다', 404));
    }
    
    // 쿼리 파라미터
    const queryParams = [groupId];
    let whereClause = 'WHERE u.group_id = $1 AND u.is_deleted = FALSE';
    
    // 검색어 필터
    if (search) {
      queryParams.push(`%${search}%`);
      whereClause += ` AND (u.user_id ILIKE $${queryParams.length} OR u.username ILIKE $${queryParams.length})`;
    }
    
    // 총 사용자 수 쿼리
    const countQuery = `
      SELECT COUNT(*) FROM "user" u
      ${whereClause}
    `;
    
    const countResult = await db.query(countQuery, queryParams);
    const totalUsers = parseInt(countResult.rows[0].count);
    
    // 사용자 목록 쿼리
    const usersQuery = `
      SELECT u.uuid, u.user_id, u.username, u.level_id, u.created_at, u.last_login,
             l.level_name
      FROM "user" u
      LEFT JOIN "level" l ON u.level_id = l.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    
    queryParams.push(parseInt(limit), offset);
    const usersResult = await db.query(usersQuery, queryParams);
    
    // 사용자별 통계 데이터 조회 (최근 30일)
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    const userIds = usersResult.rows.map(user => user.uuid);
    
    if (userIds.length > 0) {
      const statsQuery = `
        SELECT user_id, SUM(total_minutes) as total_minutes, SUM(total_tracks) as total_tracks
        FROM daily_stat
        WHERE user_id = ANY($1) AND date BETWEEN $2 AND $3
        GROUP BY user_id
      `;
      
      const statsResult = await db.query(statsQuery, [userIds, thirtyDaysAgoStr, today]);
      
      // 통계 데이터 매핑
      const statsMap = {};
      statsResult.rows.forEach(row => {
        statsMap[row.user_id] = {
          minutes: parseInt(row.total_minutes) || 0,
          tracks: parseInt(row.total_tracks) || 0
        };
      });
      
      // 결과에 통계 데이터 추가
      usersResult.rows.forEach(user => {
        user.recent_stats = statsMap[user.uuid] || { minutes: 0, tracks: 0 };
      });
    }
    
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
    logger.error('그룹 사용자 목록 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 그룹에 사용자 추가
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const addUserToGroup = async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { groupId } = req.params;
    const { user_id } = req.body;
    
    // 필수 필드 확인
    if (!user_id) {
      return next(new AppError('사용자 ID가 필요합니다', 400));
    }
    
    // 그룹 존재 확인
    const groupQuery = await client.query(
      'SELECT id, max_users FROM user_group WHERE id = $1 AND is_active = TRUE',
      [groupId]
    );
    
    if (groupQuery.rows.length === 0) {
      return next(new AppError('그룹을 찾을 수 없습니다', 404));
    }
    
    // 사용자 존재 확인
    const userQuery = await client.query(
      'SELECT uuid FROM "user" WHERE uuid = $1 AND is_deleted = FALSE',
      [user_id]
    );
    
    if (userQuery.rows.length === 0) {
      return next(new AppError('사용자를 찾을 수 없습니다', 404));
    }
    
    // 그룹 사용자 수 제한 확인
    const maxUsers = groupQuery.rows[0].max_users;
    
    if (maxUsers) {
      const userCountQuery = await client.query(
        'SELECT COUNT(*) FROM "user" WHERE group_id = $1 AND is_deleted = FALSE',
        [groupId]
      );
      
      const currentUserCount = parseInt(userCountQuery.rows[0].count);
      
      if (currentUserCount >= maxUsers) {
        return next(new AppError('그룹 사용자 수 제한에 도달했습니다', 400));
      }
    }
    
    // 사용자 그룹 업데이트
    await client.query(
      'UPDATE "user" SET group_id = $1, updated_at = CURRENT_TIMESTAMP WHERE uuid = $2',
      [groupId, user_id]
    );
    
    await client.query('COMMIT');
    
    res.json({
      message: '사용자가 그룹에 추가되었습니다'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('그룹에 사용자 추가 오류:', err);
    return next(new AppError('서버 오류', 500));
  } finally {
    client.release();
  }
};

/**
 * 그룹에서 사용자 제거
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const removeUserFromGroup = async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { groupId, userId } = req.params;
    
    // 그룹 존재 확인
    const groupQuery = await client.query(
      'SELECT id FROM user_group WHERE id = $1 AND is_active = TRUE',
      [groupId]
    );
    
    if (groupQuery.rows.length === 0) {
      return next(new AppError('그룹을 찾을 수 없습니다', 404));
    }
    
    // 사용자가 그룹에 속해 있는지 확인
    const userQuery = await client.query(
      'SELECT uuid FROM "user" WHERE uuid = $1 AND group_id = $2 AND is_deleted = FALSE',
      [userId, groupId]
    );
    
    if (userQuery.rows.length === 0) {
      return next(new AppError('해당 그룹에 속한 사용자를 찾을 수 없습니다', 404));
    }
    
    // 사용자 그룹 제거
    await client.query(
      'UPDATE "user" SET group_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE uuid = $1',
      [userId]
    );
    
    await client.query('COMMIT');
    
    res.json({
      message: '사용자가 그룹에서 제거되었습니다'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('그룹에서 사용자 제거 오류:', err);
    return next(new AppError('서버 오류', 500));
  } finally {
    client.release();
  }
};


module.exports = {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  getGroupUsers,
  addUserToGroup,
  removeUserFromGroup
};