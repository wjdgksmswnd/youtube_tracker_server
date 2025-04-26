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
    
    const {
      youtube_track_id,
      youtube_playlist_id,
      title,
      artist,
      event_type,
      track_position_seconds,
      duration_seconds,
      player_timestamp,
      history_id,
      url
    } = req.body;
    
    // IP 주소 가져오기
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // 입력값 검증
    if (!youtube_track_id || !title || !event_type) {
      return next(new AppError('트랙 ID, 제목, 이벤트 타입이 필요합니다', 400));
    }
    
    // 이벤트 타입 검증
    const validEventTypes = ['start', 'pause', 'resume', 'finish', 'skip', 'seek', 'close', 'session_expired', 'update', 'timeout'];
    if (!validEventTypes.includes(event_type)) {
      return next(new AppError('유효하지 않은 이벤트 타입입니다', 400));
    }
    
    // 클라이언트 ID 생성
    const clientId = req.body.client_id || `event-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
    
    // 이벤트 저장
    const eventResult = await client.query(
      `INSERT INTO listening_event (
        user_id, session_id, youtube_track_id, youtube_playlist_id,
        title, artist, event_type, track_position_seconds,
        duration_seconds, player_timestamp, ip_address, client_id,
        history_id, url, browser_info, device_info
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING event_id`,
      [
        req.user.id,
        req.session?.session_id,
        youtube_track_id,
        youtube_playlist_id || null,
        title,
        artist || '',
        event_type,
        track_position_seconds || 0,
        duration_seconds || 0,
        player_timestamp ? new Date(player_timestamp) : new Date(),
        ipAddress,
        clientId,
        history_id || null,
        url || null,
        req.headers['user-agent'] || null,
        req.session?.device_info || null
      ]
    );
    
    await client.query('COMMIT');
    
    res.json({
      message: '이벤트가 저장되었습니다',
      event_id: eventResult.rows[0].event_id,
      client_id: clientId
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
 * 청취 기록 저장
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const saveListening = async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { 
      youtube_id, 
      title, 
      artist, 
      duration_seconds, 
      client_id, 
      play_start_time, 
      play_end_time,
      actual_duration_seconds,
      is_complete,
      youtube_playlist_id
    } = req.body;
    
    const user_id = req.user.id;
    
    // 이전 버전 호환성: youtube_id를 youtube_track_id로 사용
    const youtube_track_id = youtube_id;
    
    // 입력값 검증
    if (!title) {
      return next(new AppError('트랙 제목이 필요합니다', 400));
    }
    
    if (!duration_seconds || isNaN(duration_seconds) || duration_seconds < 1) {
      return next(new AppError('유효한 재생 시간이 필요합니다', 400));
    }
    
    // 중복 기록 확인 (5분 이내 동일한 client_id로 기록된 경우)
    if (client_id) {
      const recentListening = await client.query(
        `SELECT * FROM listening_history 
         WHERE user_id = $1 AND client_id = $2 AND 
         listened_at > NOW() - INTERVAL '5 minutes'`,
        [user_id, client_id]
      );
      
      if (recentListening.rows.length > 0) {
        return await handleDuplicateListening(client, res, user_id, recentListening.rows[0], next);
      }
    }
    
    // 유효한 youtube_track_id 확인
    const validYoutubeId = youtube_track_id || `generated-${Date.now()}`;
    
    // 수익 계산 (1분당 1원, 최소 1원)
    const earnings = Math.max(1, Math.floor((actual_duration_seconds || duration_seconds) / 60));
    
    // 트랙 존재 여부 확인 및 추가
    const trackResult = await client.query(
      'SELECT youtube_track_id FROM track WHERE youtube_track_id = $1',
      [validYoutubeId]
    );
    
    if (trackResult.rows.length === 0) {
      // 신규 트랙 테이블에 추가
      await client.query(
        'INSERT INTO track (youtube_track_id, title, artist, duration_seconds) VALUES ($1, $2, $3, $4)',
        [validYoutubeId, title, artist || '', duration_seconds]
      );
      
      // 레거시 tracks 테이블도 업데이트
      await updateLegacyTrack(client, validYoutubeId, title, artist, duration_seconds);
    }
    
    // 청취 기록 추가
    const historyResult = await client.query(
      `INSERT INTO listening_history (
        user_id, track_id, youtube_playlist_id, session_id, duration_seconds, 
        actual_duration_seconds, client_id, play_start_time, play_end_time, is_complete
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING history_id`,
      [
        user_id, 
        validYoutubeId, 
        youtube_playlist_id || null,
        req.session?.session_id,
        duration_seconds, 
        actual_duration_seconds || duration_seconds,
        client_id || null,
        play_start_time ? new Date(play_start_time) : new Date(),
        play_end_time ? new Date(play_end_time) : null,
        is_complete !== undefined ? is_complete : true
      ]
    );
    
    // 사용자 수익 업데이트 (레거시 사용자의 경우)
    if (req.user.legacy) {
      await client.query(
        'UPDATE users SET virtual_earnings = virtual_earnings + $1 WHERE user_id = $2',
        [earnings, user_id]
      );
    }
    
    // 통계 테이블 업데이트
    await updateStatistics(client, user_id, duration_seconds, earnings);
    
    await client.query('COMMIT');
    
    // 응답
    res.json({
      message: '청취 기록이 저장되었습니다',
      history_id: historyResult.rows[0].history_id,
      earnings: earnings
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('청취 기록 저장 오류:', err);
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
         WHERE user_id = $1 AND listened_at::date = $2`,
        [user_id, today]
      );
      
      const isNewUser = uniqueUserQuery.rows.length === 0;
      const uniqueUserIncrement = isNewUser ? 1 : 0;
      
      await client.query(
        `UPDATE group_daily_stat 
         SET total_minutes = total_minutes + $1, 
             total_tracks = total_tracks + 1,
             total_unique_users = total_unique_users + $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE group_id = $3 AND date = $4`,
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
      whereClause += ` AND h.listened_at::date BETWEEN $${queryParams.length - 1} AND $${queryParams.length}`;
    } else if (start_date) {
      queryParams.push(start_date);
      whereClause += ` AND h.listened_at::date >= $${queryParams.length}`;
    } else if (end_date) {
      queryParams.push(end_date);
      whereClause += ` AND h.listened_at::date <= $${queryParams.length}`;
    }
    
    // 트랙 필터
    if (track_id) {
      queryParams.push(track_id);
      whereClause += ` AND h.track_id = $${queryParams.length}`;
    }
    
    // 플레이리스트 필터
    if (playlist_id) {
      queryParams.push(playlist_id);
      whereClause += ` AND h.youtube_playlist_id = $${queryParams.length}`;
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
      SELECT h.history_id, h.track_id, h.youtube_playlist_id, h.duration_seconds, 
             h.actual_duration_seconds, h.listened_at, h.play_start_time, h.play_end_time,
             h.is_complete, t.title, t.artist, t.thumbnail_url
      FROM listening_history h
      LEFT JOIN track t ON h.track_id = t.youtube_track_id
      ${whereClause}
      ORDER BY h.listened_at DESC
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
      SELECT h.history_id, h.track_id, h.youtube_playlist_id, h.duration_seconds, 
             h.actual_duration_seconds, h.listened_at, h.play_start_time, h.play_end_time,
             h.is_complete, t.title, t.artist, t.thumbnail_url
      FROM listening_history h
      LEFT JOIN track t ON h.track_id = t.youtube_track_id
      WHERE h.user_id = $1
      ORDER BY h.listened_at DESC
      LIMIT $2
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
  saveListening,
  getListeningHistory,
  getRecentListening
};