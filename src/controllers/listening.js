// src/controllers/listening.js - 청취 관련 컨트롤러
const db = require('../db');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * 청취 이벤트 저장
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const saveListeningEvent = async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    var {
      youtube_track_id,
      youtube_playlist_id,
      event_type,
      track_position_seconds,
      duration_seconds,
      player_timestamp,
      listening_history_id,
      url
    } = req.body;
    
    // IP 주소 가져오기
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // 입력값 검증
    if (!youtube_track_id || !event_type) {
      return next(new AppError('트랙 ID, 이벤트 타입이 필요합니다', 400));
    }
    
    // 이벤트 타입 검증
    const validEventTypes = ['start', 'pause', 'resume', 'finish', 'skip', 'seek', 'close', 'session_expired', 'update', 'timeout'];
    if (!validEventTypes.includes(event_type)) {
      return next(new AppError('유효하지 않은 이벤트 타입입니다', 400));
    }

    if (event_type === 'start' || event_type === 'finish' || event_type === 'skip') {
      if (event_type === 'start') {
        const result = await client.query(
          `INSERT INTO listening_history (
            user_id, session_id, youtube_track_id, youtube_playlist_id,
            duration_seconds, 
            play_start_time
          ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [
          req.user.id, req.session?.session_id,
          youtube_track_id, youtube_playlist_id || null,
          duration_seconds,
          player_timestamp ? new Date(player_timestamp) : new Date(),
        ]);
        await client.query('COMMIT');
        listening_history_id = result.rows[0].id;
      } else if (event_type === 'finish' || event_type === 'skip') {
        if (!listening_history_id) {
          logger.error
        } else {
          const result = await client.query(
            `UPDATE listening_history set actual_duration_seconds= $1, play_end_time = $2 
              where id = $3`,
          [
            duration_seconds,
            player_timestamp ? new Date(player_timestamp) : new Date(),
            listening_history_id
          ]);
          await client.query('COMMIT');
        }
      }
    }
    
    // 이벤트 저장
    const eventResult = await client.query(
      `INSERT INTO listening_event (
        user_id, session_id, youtube_track_id, youtube_playlist_id,
        event_type, track_position_seconds,
        player_timestamp, 
        ip_address, listening_history_id, url,
         browser_info, device_info
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING event_id`,
      [
        req.user.id, req.session?.session_id,
        youtube_track_id, youtube_playlist_id || null,
        event_type, track_position_seconds,
        player_timestamp ? new Date(player_timestamp) : new Date(),
        ipAddress,
        listening_history_id || null, url || null,
        req.headers['user-agent'] || null, req.session?.device_info || null
      ]
    );
    
    await client.query('COMMIT');
    
    res.json({
      message: '이벤트가 저장되었습니다',
      listening_history_id: listening_history_id,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('청취 이벤트 저장 오류:', err);
    return next(new AppError('서버 오류', 500));
  } finally {
    client.release();
  }
};

/**
 * 중복 청취 처리
 * @deprecated 레거시 기능 지원
 * @param {Object} client - 데이터베이스 클라이언트
 * @param {Response} res - Express 응답 객체
 * @param {string} user_id - 사용자 ID
 * @param {Object} existingRecord - 기존 기록
 * @param {Function} next - 다음 미들웨어
 */
const handleDuplicateListening = async (client, res, user_id, existingRecord, next) => {
  try {
    logger.info('중복 청취 기록 감지:', existingRecord.client_id);
    
    // 사용자 현재 수익 조회
    let totalEarnings = 0;
    
    if (res.user && res.user.legacy) {
      const userResult = await client.query(
        'SELECT virtual_earnings FROM users WHERE user_id = $1',
        [user_id]
      );
      totalEarnings = userResult.rows[0]?.virtual_earnings || 0;
    }
    
    return res.json({
      message: '중복 청취 기록이 감지되었습니다',
      duplicate: true,
      earnings: 0,
      total_earnings: totalEarnings
    });
  } catch (err) {
    logger.error('중복 청취 처리 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 레거시 트랙 테이블 업데이트
 * @deprecated 레거시 기능 지원
 * @param {Object} client - 데이터베이스 클라이언트
 * @param {string} youtube_id - YouTube 트랙 ID
 * @param {string} title - 트랙 제목
 * @param {string} artist - 아티스트
 * @param {number} duration_seconds - 재생 시간
 */
const updateLegacyTrack = async (client, youtube_id, title, artist, duration_seconds) => {
  try {
    const legacyTrackQuery = await client.query(
      'SELECT track_id FROM tracks WHERE youtube_id = $1',
      [youtube_id]
    );
    
    if (legacyTrackQuery.rows.length === 0) {
      await client.query(
        'INSERT INTO tracks (youtube_id, title, artist, duration_seconds) VALUES ($1, $2, $3, $4)',
        [youtube_id, title, artist || '', duration_seconds]
      );
    }
  } catch (err) {
    logger.error('레거시 트랙 업데이트 오류:', err);
    // 오류를 전파하지 않고 계속 진행
  }
};

/**
 * 통계 테이블 업데이트
 * @param {Object} client - 데이터베이스 클라이언트
 * @param {string} user_id - 사용자 ID
 * @param {number} duration_seconds - 재생 시간
 * @param {number} earnings - 수익
 */
const updateStatistics = async (client, user_id, duration_seconds, earnings) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
    const hour = new Date().getHours();
    
    // 일별 통계 업데이트
    const statsResult = await client.query(
      'SELECT * FROM daily_stat WHERE user_id = $1 AND date = $2',
      [user_id, today]
    );
    
    if (statsResult.rows.length === 0) {
      // 새 일별 통계 생성
      await client.query(
        'INSERT INTO daily_stat (user_id, date, total_minutes, total_tracks, total_earnings) VALUES ($1, $2, $3, $4, $5)',
        [user_id, today, Math.floor(duration_seconds / 60), 1, earnings]
      );
    } else {
      // 기존 일별 통계 업데이트
      await client.query(
        'UPDATE daily_stat SET total_minutes = total_minutes + $1, total_tracks = total_tracks + 1, total_earnings = total_earnings + $2 WHERE user_id = $3 AND date = $4',
        [Math.floor(duration_seconds / 60), earnings, user_id, today]
      );
    }
    
    // 시간별 통계 업데이트
    const hourlyStatsResult = await client.query(
      'SELECT * FROM hourly_stat WHERE user_id = $1 AND date = $2 AND hour = $3',
      [user_id, today, hour]
    );
    
    if (hourlyStatsResult.rows.length === 0) {
      // 새 시간별 통계 생성
      await client.query(
        'INSERT INTO hourly_stat (user_id, date, hour, total_minutes, total_tracks) VALUES ($1, $2, $3, $4, $5)',
        [user_id, today, hour, Math.floor(duration_seconds / 60), 1]
      );
    } else {
      // 기존 시간별 통계 업데이트
      await client.query(
        'UPDATE hourly_stat SET total_minutes = total_minutes + $1, total_tracks = total_tracks + 1 WHERE user_id = $2 AND date = $3 AND hour = $4',
        [Math.floor(duration_seconds / 60), user_id, today, hour]
      );
    }
    
    // 그룹 통계 업데이트 (사용자가 그룹에 속해 있는 경우)
    await updateGroupStatistics(client, user_id, duration_seconds);
  } catch (err) {
    logger.error('통계 업데이트 오류:', err);
    // 오류를 전파하지 않고 계속 진행
  }
};

/**
 * 그룹 통계 업데이트
 * @param {Object} client - 데이터베이스 클라이언트
 * @param {string} user_id - 사용자 ID
 * @param {number} duration_seconds - 재생 시간
 */
const updateGroupStatistics = async (client, user_id, duration_seconds) => {
  try {
    // 사용자의 그룹 ID 찾기
    let groupId = null;
    
    // 신규 테이블에서 먼저 확인
    const userQuery = await client.query(
      'SELECT group_id FROM "user" WHERE id = $1 AND group_id IS NOT NULL',
      [user_id]
    );
    
    if (userQuery.rows.length > 0 && userQuery.rows[0].group_id) {
      groupId = userQuery.rows[0].group_id;
    }
    
    if (!groupId) return; // 그룹이 없으면 종료
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
    
    // 그룹 일별 통계 확인
    const groupStatQuery = await client.query(
      'SELECT * FROM group_daily_stat WHERE group_id = $1 AND date = $2',
      [groupId, today]
    );
    
    if (groupStatQuery.rows.length === 0) {
      // 새 그룹 일별 통계 생성
      await client.query(
        'INSERT INTO group_daily_stat (group_id, date, total_minutes, total_tracks, total_unique_users) VALUES ($1, $2, $3, $4, $5)',
        [groupId, today, Math.floor(duration_seconds / 60), 1, 1]
      );
    } else {
      // 기존 그룹 일별 통계 업데이트
      // 고유 사용자 확인
      const uniqueUserQuery = await client.query(
        `SELECT DISTINCT user_id FROM listening_history 
         WHERE user_id = $1 AND date(updated_datetime) = $2`,
        [user_id, today]
      );
      
      const isNewUser = uniqueUserQuery.rows.length === 0;
      const uniqueUserIncrement = isNewUser ? 1 : 0;
      
      await client.query(
        `UPDATE group_daily_stat 
         SET total_minutes = total_minutes + ?, 
             total_tracks = total_tracks + 1,
             total_unique_users = total_unique_users + ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE group_id = ? AND date = ?`,
        [Math.floor(duration_seconds / 60), uniqueUserIncrement, groupId, today]
      );
    }
  } catch (err) {
    logger.error('그룹 통계 업데이트 오류:', err);
    // 오류를 전파하지 않고 계속 진행
  }
};

/**
 * 청취 기록 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const getListeningHistory = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      start_date, 
      end_date,
      track_id,
      playlist_id 
    } = req.query;
    
    const user_id = req.user.id;
    
    // 페이지네이션 설정
    const offset = (page - 1) * limit;
    
    // 쿼리 파라미터
    const queryParams = [user_id];
    let whereClause = 'WHERE h.user_id = $1';
    
    // 날짜 필터
    if (start_date && end_date) {
      queryParams.push(start_date, end_date);
      whereClause += ` AND date(h.updated_datetime) BETWEEN ? AND ?`;
    } else if (start_date) {
      queryParams.push(start_date);
      whereClause += ` AND date(h.updated_datetime) >= ?`;
    } else if (end_date) {
      queryParams.push(end_date);
      whereClause += ` AND date(h.updated_datetime) <= ?`;
    }
    
    // 트랙 필터
    if (track_id) {
      queryParams.push(track_id);
      whereClause += ` AND h.track_id = ?`;
    }
    
    // 플레이리스트 필터
    if (playlist_id) {
      queryParams.push(playlist_id);
      whereClause += ` AND h.youtube_playlist_id = ?`;
    }
    
    // 총 기록 수 쿼리
    const countQuery = `
      SELECT COUNT(*) FROM listening_history h
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams);
    const totalRecords = parseInt(countResult.rows[0].count);
    
    // 청취 기록 쿼리
    const historyQuery = `
      SELECT h.*, t.title, t.artist, t.thumbnail_url
      FROM listening_history h
      LEFT JOIN track t ON h.youtube_track_id = t.youtube_track_id
      ${whereClause}
      ORDER BY h.updated_datetime DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    
    queryParams.push(parseInt(limit), offset);
    const historyResult = await db.query(historyQuery, queryParams);
    
    // 결과 반환
    res.json({
      tracks: historyResult.rows,
      pagination: {
        total: totalRecords,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(totalRecords / limit)
      }
    });
  } catch (err) {
    logger.error('청취 기록 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 최근 청취 기록 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const getRecentListening = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const user_id = req.user.id;
    
    const historyQuery = `
      SELECT h.*, t.title, t.artist, t.thumbnail_url
      FROM listening_history h
      LEFT JOIN track t ON h.youtube_track_id = t.youtube_track_id
      WHERE h.user_id = ? and h.updated_datetime IS NOT NULL
      ORDER BY h.play_start_time DESC
      LIMIT ?
    `;
    
    const historyResult = await db.query(historyQuery, [user_id, parseInt(limit)]);
    
    // 결과 반환
    res.json({
      data: historyResult.rows
    });
  } catch (err) {
    logger.error('최근 청취 기록 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

module.exports = {
  saveListeningEvent,
  getListeningHistory,
  getRecentListening
};