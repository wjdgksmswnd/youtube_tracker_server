// src/controllers/stats.js - 통계 관련 컨트롤러
const db = require('../db');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/errors');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

/**
 * 요약 통계 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const getSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 오늘 날짜
    const today = new Date().toISOString().split('T')[0];
    
    // 오늘 통계 쿼리
    const todayStatsQuery = `
      SELECT COALESCE(SUM(total_minutes), 0) as minutes, COALESCE(SUM(total_tracks), 0) as tracks
      FROM daily_stat
      WHERE user_id = $1 AND date = $2
    `;
    
    const todayStatsResult = await db.query(todayStatsQuery, [userId, today]);
    
    // 이번 주 통계 쿼리
    const weekStart = getWeekStartDate();
    const weekStatsQuery = `
      SELECT COALESCE(SUM(total_minutes), 0) as minutes, COALESCE(SUM(total_tracks), 0) as tracks
      FROM daily_stat
      WHERE user_id = $1 AND date >= $2 AND date <= $3
    `;
    
    const weekStatsResult = await db.query(weekStatsQuery, [userId, weekStart, today]);
    
    // 이번 달 통계 쿼리
    const monthStart = today.substring(0, 8) + '01'; // YYYY-MM-01 형식
    const monthStatsQuery = `
      SELECT COALESCE(SUM(total_minutes), 0) as minutes, COALESCE(SUM(total_tracks), 0) as tracks
      FROM daily_stat
      WHERE user_id = $1 AND date >= $2 AND date <= $3
    `;
    
    const monthStatsResult = await db.query(monthStatsQuery, [userId, monthStart, today]);
    
    // 전체 통계 쿼리
    const allTimeStatsQuery = `
      SELECT COALESCE(SUM(total_minutes), 0) as minutes, COALESCE(SUM(total_tracks), 0) as tracks
      FROM daily_stat
      WHERE user_id = $1
    `;
    
    const allTimeStatsResult = await db.query(allTimeStatsQuery, [userId]);
    
    // 결과 반환
    res.json({
      today: {
        minutes: parseInt(todayStatsResult.rows[0].minutes) || 0,
        tracks: parseInt(todayStatsResult.rows[0].tracks) || 0
      },
      week: {
        minutes: parseInt(weekStatsResult.rows[0].minutes) || 0,
        tracks: parseInt(weekStatsResult.rows[0].tracks) || 0
      },
      month: {
        minutes: parseInt(monthStatsResult.rows[0].minutes) || 0,
        tracks: parseInt(monthStatsResult.rows[0].tracks) || 0
      },
      all_time: {
        minutes: parseInt(allTimeStatsResult.rows[0].minutes) || 0,
        tracks: parseInt(allTimeStatsResult.rows[0].tracks) || 0
      }
    });
  } catch (err) {
    logger.error('요약 통계 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 일별 통계 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const getDailyStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { start_date, end_date } = req.query;
    
    // 날짜 검증
    if (!start_date || !end_date) {
      return next(new AppError('시작일과 종료일이 필요합니다', 400));
    }
    
    if (!isValidDate(start_date) || !isValidDate(end_date)) {
      return next(new AppError('유효한 날짜 형식이 아닙니다 (YYYY-MM-DD)', 400));
    }
    
    // 일별 통계 쿼리
    const statsQuery = `
      SELECT date, total_minutes, total_tracks, total_earnings
      FROM daily_stat
      WHERE user_id = $1 AND date BETWEEN $2 AND $3
      ORDER BY date
    `;
    
    const statsResult = await db.query(statsQuery, [userId, start_date, end_date]);
    
    // 통계 기간 내 누락된 날짜 채우기
    const filledStats = fillMissingDates(statsResult.rows, start_date, end_date);
    
    // 결과 반환
    res.json({
      stats: filledStats
    });
  } catch (err) {
    logger.error('일별 통계 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 시간별 통계 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const getHourlyStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { date } = req.query;
    
    // 날짜 검증
    if (!date) {
      return next(new AppError('날짜가 필요합니다', 400));
    }
    
    if (!isValidDate(date)) {
      return next(new AppError('유효한 날짜 형식이 아닙니다 (YYYY-MM-DD)', 400));
    }
    
    // 시간별 통계 쿼리
    const statsQuery = `
      SELECT hour, total_minutes, total_tracks
      FROM hourly_stat
      WHERE user_id = $1 AND date = $2
      ORDER BY hour
    `;
    
    const statsResult = await db.query(statsQuery, [userId, date]);
    
    // 누락된 시간 채우기
    const filledStats = fillMissingHours(statsResult.rows);
    
    // 결과 반환
    res.json({
      date,
      stats: filledStats
    });
  } catch (err) {
    logger.error('시간별 통계 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 그룹별 통계 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const getGroupStats = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    
    // 날짜 검증
    if (!start_date || !end_date) {
      return next(new AppError('시작일과 종료일이 필요합니다', 400));
    }
    
    if (!isValidDate(start_date) || !isValidDate(end_date)) {
      return next(new AppError('유효한 날짜 형식이 아닙니다 (YYYY-MM-DD)', 400));
    }
    
    // 관리자 권한 확인
    if (!req.user.legacy && !await hasAdminPermission(req.user.level_id)) {
      return next(new AppError('권한이 없습니다', 403));
    }
    
    // 그룹별 통계 쿼리
    const statsQuery = `
      SELECT ug.id as group_id, ug.group_name, 
             SUM(gds.total_minutes) as total_minutes, 
             SUM(gds.total_tracks) as total_tracks,
             SUM(gds.total_unique_users) as total_unique_users
      FROM user_group ug
      LEFT JOIN group_daily_stat gds ON ug.id = gds.group_id
      WHERE (gds.date BETWEEN $1 AND $2 OR gds.date IS NULL)
      GROUP BY ug.id, ug.group_name
      ORDER BY total_minutes DESC
    `;
    
    const statsResult = await db.query(statsQuery, [start_date, end_date]);
    
    // 결과 반환
    res.json({
      stats: statsResult.rows
    });
  } catch (err) {
    logger.error('그룹별 통계 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 플레이리스트별 통계 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const getPlaylistStats = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    
    // 날짜 검증
    if (!start_date || !end_date) {
      return next(new AppError('시작일과 종료일이 필요합니다', 400));
    }
    
    if (!isValidDate(start_date) || !isValidDate(end_date)) {
      return next(new AppError('유효한 날짜 형식이 아닙니다 (YYYY-MM-DD)', 400));
    }
    
    // 관리자 권한 확인
    if (!req.user.legacy && !await hasAdminPermission(req.user.level_id)) {
      return next(new AppError('권한이 없습니다', 403));
    }
    
    // 플레이리스트별 통계 쿼리
    const statsQuery = `
      SELECT lh.youtube_playlist_id, op.title as playlist_title, yp.title as youtube_title,
             COUNT(lh.history_id) as play_count,
             SUM(lh.actual_duration_seconds) / 60 as total_minutes
      FROM listening_history lh
      LEFT JOIN odo_playlist op ON lh.youtube_playlist_id = op.youtube_playlist_id
      LEFT JOIN youtube_playlist yp ON lh.youtube_playlist_id = yp.youtube_playlist_id
      WHERE date(lh.listened_at) BETWEEN $1 AND $2
        AND lh.youtube_playlist_id IS NOT NULL
      GROUP BY lh.youtube_playlist_id, op.title, yp.title
      ORDER BY total_minutes DESC
    `;
    
    const statsResult = await db.query(statsQuery, [start_date, end_date]);
    
    // 결과 반환
    res.json({
      stats: statsResult.rows.map(row => ({
        ...row,
        playlist_title: row.playlist_title || row.youtube_title || '알 수 없는 플레이리스트',
        total_minutes: Math.round(parseFloat(row.total_minutes) || 0)
      }))
    });
  } catch (err) {
    logger.error('플레이리스트별 통계 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 트랙별 통계 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const getTrackStats = async (req, res, next) => {
  try {
    const { start_date, end_date, limit = 50 } = req.query;
    
    // 날짜 검증
    if (!start_date || !end_date) {
      return next(new AppError('시작일과 종료일이 필요합니다', 400));
    }
    
    if (!isValidDate(start_date) || !isValidDate(end_date)) {
      return next(new AppError('유효한 날짜 형식이 아닙니다 (YYYY-MM-DD)', 400));
    }
    
    // 트랙별 통계 쿼리
    const statsQuery = `
      SELECT lh.track_id, t.title, t.artist,
             COUNT(lh.history_id) as play_count,
             SUM(lh.actual_duration_seconds) / 60 as total_minutes
      FROM listening_history lh
      LEFT JOIN track t ON lh.track_id = t.youtube_track_id
      WHERE date(lh.listened_at) BETWEEN $1 AND $2
      GROUP BY lh.track_id, t.title, t.artist
      ORDER BY play_count DESC
      LIMIT $3
    `;
    
    const statsResult = await db.query(statsQuery, [start_date, end_date, limit]);
    
    // 결과 반환
    res.json({
      stats: statsResult.rows.map(row => ({
        ...row,
        total_minutes: Math.round(parseFloat(row.total_minutes) || 0)
      }))
    });
  } catch (err) {
    logger.error('트랙별 통계 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 그룹 일별 통계 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const getGroupDailyStats = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { start_date, end_date } = req.query;
    const userId = req.user.id;
    
    // 날짜 검증
    if (!start_date || !end_date) {
      return next(new AppError('시작일과 종료일이 필요합니다', 400));
    }
    
    if (!isValidDate(start_date) || !isValidDate(end_date)) {
      return next(new AppError('유효한 날짜 형식이 아닙니다 (YYYY-MM-DD)', 400));
    }
    
    // 사용자가 그룹 관리자인지 또는 관리자 권한이 있는지 확인
    const isGroupAdmin = await checkGroupAdmin(userId, groupId, req.user.level_id);
    
    if (!isGroupAdmin) {
      return next(new AppError('이 그룹에 대한 권한이 없습니다', 403));
    }
    
    // 그룹 일별 통계 쿼리
    const statsQuery = `
      SELECT date, total_minutes, total_tracks, total_unique_users
      FROM group_daily_stat
      WHERE group_id = $1 AND date BETWEEN $2 AND $3
      ORDER BY date
    `;
    
    const statsResult = await db.query(statsQuery, [groupId, start_date, end_date]);
    
    // 그룹 정보 쿼리
    const groupQuery = `
      SELECT id, group_name, daily_goal_minutes, monthly_goal_minutes, 
             monthly_min_minutes, daily_max_minutes
      FROM user_group
      WHERE id = $1
    `;
    
    const groupResult = await db.query(groupQuery, [groupId]);
    
    // 통계 기간 내 누락된 날짜 채우기
    const filledStats = fillMissingDates(statsResult.rows, start_date, end_date);
    
    // 결과 반환
    res.json({
      group: groupResult.rows[0] || null,
      stats: filledStats
    });
  } catch (err) {
    logger.error('그룹 일별 통계 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 통계 내보내기
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const exportStats = async (req, res, next) => {
  try {
    const { type, period, start_date, end_date } = req.query;
    const userId = req.user.id;
    
    // 입력값 검증
    if (!type || !start_date || !end_date) {
      return next(new AppError('유형, 시작일, 종료일이 필요합니다', 400));
    }
    
    if (!isValidDate(start_date) || !isValidDate(end_date)) {
      return next(new AppError('유효한 날짜 형식이 아닙니다 (YYYY-MM-DD)', 400));
    }
    
    let data = [];
    let filename = `odo_stats_${type}_${start_date}_${end_date}.xlsx`;
    
    // 요청한 통계 유형에 따라 다른 쿼리 실행
    switch (type) {
      case 'daily':
        data = await getDailyStatsData(userId, start_date, end_date);
        break;
      case 'tracks':
        data = await getTrackStatsData(userId, start_date, end_date);
        break;
      case 'group':
        // 그룹 ID 확인
        const groupId = req.user.group_id;
        if (!groupId) {
          return next(new AppError('그룹이 지정되지 않았습니다', 400));
        }
        
        // 그룹 관리자 권한 확인
        const isGroupAdmin = await checkGroupAdmin(userId, groupId, req.user.level_id);
        if (!isGroupAdmin) {
          return next(new AppError('그룹 통계를 내보낼 권한이 없습니다', 403));
        }
        
        data = await getGroupStatsData(groupId, start_date, end_date);
        break;
      default:
        return next(new AppError('지원되지 않는 통계 유형입니다', 400));
    }
    
    // 데이터가 없는 경우
    if (!data || data.length === 0) {
      return next(new AppError('내보낼 데이터가 없습니다', 404));
    }
    
    // 엑셀 파일 생성
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stats');
    
    // 임시 파일로 저장
    const tmpDir = path.join(__dirname, '..', '..', 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    const filePath = path.join(tmpDir, filename);
    XLSX.writeFile(workbook, filePath);
    
    // 파일 전송 후 삭제
    res.download(filePath, filename, err => {
      if (err) {
        logger.error('파일 다운로드 오류:', err);
        if (!res.headersSent) {
          res.status(500).send('파일 다운로드 중 오류가 발생했습니다');
        }
      }
      
      // 파일 삭제
      setTimeout(() => {
        fs.unlink(filePath, err => {
          if (err) logger.error('임시 파일 삭제 오류:', err);
        });
      }, 5000);
    });
  } catch (err) {
    logger.error('통계 내보내기 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 일별 통계 데이터 가져오기
 * @param {string} userId - 사용자 ID
 * @param {string} startDate - 시작일
 * @param {string} endDate - 종료일
 * @returns {Array} 통계 데이터
 */
const getDailyStatsData = async (userId, startDate, endDate) => {
  const query = `
    SELECT 
      date as "날짜", 
      total_tracks as "곡 수", 
      total_minutes as "청취 시간(분)",
      total_earnings as "수익(가상)"
    FROM daily_stat
    WHERE user_id = $1 AND date BETWEEN $2 AND $3
    ORDER BY date
  `;
  
  const result = await db.query(query, [userId, startDate, endDate]);
  return result.rows;
};

/**
 * 트랙 통계 데이터 가져오기
 * @param {string} userId - 사용자 ID
 * @param {string} startDate - 시작일
 * @param {string} endDate - 종료일
 * @returns {Array} 통계 데이터
 */
const getTrackStatsData = async (userId, startDate, endDate) => {
  const query = `
    SELECT 
      t.title as "곡 제목",
      t.artist as "아티스트",
      COUNT(lh.history_id) as "재생 횟수",
      SUM(lh.actual_duration_seconds) / 60 as "총 재생 시간(분)"
    FROM listening_history lh
    JOIN track t ON lh.track_id = t.youtube_track_id
    WHERE lh.user_id = $1 
      AND date(lh.listened_at) BETWEEN $2 AND $3
    GROUP BY t.title, t.artist
    ORDER BY COUNT(lh.history_id) DESC
  `;
  
  const result = await db.query(query, [userId, startDate, endDate]);
  
  // 소수점 처리
  return result.rows.map(row => ({
    ...row,
    "총 재생 시간(분)": Math.round(parseFloat(row["총 재생 시간(분)"]) || 0)
  }));
};

/**
 * 그룹 통계 데이터 가져오기
 * @param {string} groupId - 그룹 ID
 * @param {string} startDate - 시작일
 * @param {string} endDate - 종료일
 * @returns {Array} 통계 데이터
 */
const getGroupStatsData = async (groupId, startDate, endDate) => {
  const query = `
    SELECT 
      gds.date as "날짜",
      gds.total_unique_users as "참여 인원",
      gds.total_tracks as "총 곡 수",
      gds.total_minutes as "총 청취 시간(분)"
    FROM group_daily_stat gds
    WHERE gds.group_id = $1 AND gds.date BETWEEN $2 AND $3
    ORDER BY gds.date
  `;
  
  const result = await db.query(query, [groupId, startDate, endDate]);
  return result.rows;
};

/**
 * 날짜 형식 유효성 검사
 * @param {string} dateStr - 날짜 문자열
 * @returns {boolean} 유효성 여부
 */
const isValidDate = (dateStr) => {
  if (!dateStr) return false;
  
  // YYYY-MM-DD 형식 검사
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  
  // 유효한 날짜인지 검사
  const date = new Date(dateStr);
  
  return !isNaN(date.getTime());
};

/**
 * 주의 시작일 가져오기
 * @returns {string} YYYY-MM-DD 형식의 시작일
 */
const getWeekStartDate = () => {
  const date = new Date();
  const day = date.getDay(); // 0: 일요일, 6: 토요일
  const diff = date.getDate() - day;
  const weekStart = new Date(date.setDate(diff));
  
  return weekStart.toISOString().split('T')[0];
};

/**
 * 누락된 날짜 채우기
 * @param {Array} data - 통계 데이터
 * @param {string} startDate - 시작일
 * @param {string} endDate - 종료일
 * @returns {Array} 누락된 날짜가 채워진 데이터
 */
const fillMissingDates = (data, startDate, endDate) => {
  const result = [];
  const dateMap = {};
  
  // 데이터를 날짜별로 매핑
  data.forEach(item => {
    dateMap[item.date] = item;
  });
  
  // 시작일부터 종료일까지 순회
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    
    if (dateMap[dateStr]) {
      result.push(dateMap[dateStr]);
    } else {
      // 누락된 날짜 채우기
      result.push({
        date: dateStr,
        total_minutes: 0,
        total_tracks: 0,
        total_earnings: 0,
        total_unique_users: 0
      });
    }
  }
  
  return result;
};

/**
 * 누락된 시간 채우기
 * @param {Array} data - 시간별 통계 데이터
 * @returns {Array} 누락된 시간이 채워진 데이터
 */
const fillMissingHours = (data) => {
  const result = [];
  const hourMap = {};
  
  // 데이터를 시간별로 매핑
  data.forEach(item => {
    hourMap[item.hour] = item;
  });
  
  // 0시부터 23시까지 순회
  for (let hour = 0; hour < 24; hour++) {
    if (hourMap[hour]) {
      result.push(hourMap[hour]);
    } else {
      // 누락된 시간 채우기
      result.push({
        hour,
        total_minutes: 0,
        total_tracks: 0
      });
    }
  }
  
  return result;
};

/**
 * 관리자 권한 확인
 * @param {number} levelId - 레벨 ID
 * @returns {boolean} 관리자 권한 여부
 */
const hasAdminPermission = async (levelId) => {
  if (!levelId) return false;
  
  try {
    const query = `
      SELECT la.id FROM level_auth la
      JOIN auth a ON la.auth_id = a.id
      WHERE la.level_id = $1 
        AND a.auth_key IN ('user.admin', 'group.admin')
        AND la.is_active = TRUE 
        AND a.is_active = TRUE
    `;
    
    const result = await db.query(query, [levelId]);
    return result.rows.length > 0;
  } catch (err) {
    logger.error('관리자 권한 확인 오류:', err);
    return false;
  }
};

/**
 * 그룹 관리자 권한 확인
 * @param {string} userId - 사용자 ID
 * @param {number} groupId - 그룹 ID
 * @param {number} levelId - 레벨 ID
 * @returns {boolean} 그룹 관리자 권한 여부
 */
const checkGroupAdmin = async (userId, groupId, levelId) => {
  try {
    // 1. 최고 관리자 또는 일반 관리자 확인
    const isAdmin = await hasAdminPermission(levelId);
    if (isAdmin) return true;
    
    // 2. 그룹 관리자 권한 확인
    const query = `
      SELECT ag.id FROM auth_group ag
      JOIN auth a ON ag.auth_id = a.id
      WHERE ag.group_id = $1 
        AND ag.user_id = $2
        AND a.auth_key = 'group.report'
        AND ag.is_active = TRUE 
        AND a.is_active = TRUE
    `;
    
    const result = await db.query(query, [groupId, userId]);
    return result.rows.length > 0;
  } catch (err) {
    logger.error('그룹 관리자 권한 확인 오류:', err);
    return false;
  }
};

module.exports = {
  getSummary,
  getDailyStats,
  getHourlyStats,
  getGroupStats,
  getPlaylistStats,
  getTrackStats,
  getGroupDailyStats,
  exportStats
};