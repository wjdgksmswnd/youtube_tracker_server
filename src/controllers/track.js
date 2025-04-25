// src/controllers/track.js - 트랙 관련 컨트롤러
const db = require('../db');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * 트랙 목록 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const listTracks = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    
    // 페이지네이션 설정
    const offset = (page - 1) * limit;
    
    // 쿼리 파라미터
    const queryParams = [];
    let whereClause = 'WHERE 1=1';
    
    // 검색어 필터
    if (search) {
      queryParams.push(`%${search}%`);
      whereClause += ` AND (title ILIKE $${queryParams.length} OR artist ILIKE $${queryParams.length})`;
    }
    
    // 총 트랙 수 쿼리
    const countQuery = `SELECT COUNT(*) FROM track ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams);
    const totalTracks = parseInt(countResult.rows[0].count);
    
    // 트랙 목록 쿼리
    const tracksQuery = `
      SELECT youtube_track_id, title, artist, duration_seconds, 
             thumbnail_url, first_played_at, updated_at
      FROM track
      ${whereClause}
      ORDER BY first_played_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    
    queryParams.push(parseInt(limit), offset);
    const tracksResult = await db.query(tracksQuery, queryParams);
    
    // 각 트랙의 플레이리스트 정보 조회
    const trackIds = tracksResult.rows.map(track => track.youtube_track_id);
    
    if (trackIds.length > 0) {
      const playlistQuery = `
        SELECT pt.youtube_track_id, pt.youtube_playlist_id, 
               yp.title as playlist_title, op.title as odo_playlist_title
        FROM playlist_track pt
        LEFT JOIN youtube_playlist yp ON pt.youtube_playlist_id = yp.youtube_playlist_id
        LEFT JOIN odo_playlist op ON pt.youtube_playlist_id = op.youtube_playlist_id
        WHERE pt.youtube_track_id IN (${trackIds.map((_, i) => `$${i + 1}`).join(',')})
        GROUP BY pt.youtube_track_id, pt.youtube_playlist_id, yp.title, op.title
      `;
      
      const playlistResult = await db.query(playlistQuery, trackIds);
      
      // 플레이리스트 정보 매핑
      const playlistMap = {};
      playlistResult.rows.forEach(row => {
        if (!playlistMap[row.youtube_track_id]) {
          playlistMap[row.youtube_track_id] = [];
        }
        
        playlistMap[row.youtube_track_id].push({
          youtube_playlist_id: row.youtube_playlist_id,
          title: row.odo_playlist_title || row.playlist_title || '알 수 없는 플레이리스트'
        });
      });
      
      // 결과에 플레이리스트 정보 추가
      tracksResult.rows.forEach(track => {
        track.playlists = playlistMap[track.youtube_track_id] || [];
      });
    }
    
    // 결과 반환
    res.json({
      tracks: tracksResult.rows,
      pagination: {
        total: totalTracks,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(totalTracks / limit)
      }
    });
  } catch (err) {
    logger.error('트랙 목록 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 특정 트랙 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const getTrack = async (req, res, next) => {
  try {
    const { trackId } = req.params;
    
    // 트랙 정보 쿼리
    const trackQuery = `
      SELECT youtube_track_id, title, artist, duration_seconds, 
             thumbnail_url, first_played_at, updated_at
      FROM track
      WHERE youtube_track_id = $1
    `;
    
    const trackResult = await db.query(trackQuery, [trackId]);
    
    if (trackResult.rows.length === 0) {
      return next(new AppError('트랙을 찾을 수 없습니다', 404));
    }
    
    const track = trackResult.rows[0];
    
    // 트랙의 플레이리스트 정보 조회
    const playlistQuery = `
      SELECT pt.youtube_playlist_id, yp.title as playlist_title, 
             op.title as odo_playlist_title, op.id as odo_playlist_id
      FROM playlist_track pt
      LEFT JOIN youtube_playlist yp ON pt.youtube_playlist_id = yp.youtube_playlist_id
      LEFT JOIN odo_playlist op ON pt.youtube_playlist_id = op.youtube_playlist_id
      WHERE pt.youtube_track_id = $1
      GROUP BY pt.youtube_playlist_id, yp.title, op.title, op.id
    `;
    
    const playlistResult = await db.query(playlistQuery, [trackId]);
    
    // 결과에 플레이리스트 정보 추가
    track.playlists = playlistResult.rows.map(row => ({
      youtube_playlist_id: row.youtube_playlist_id,
      title: row.odo_playlist_title || row.playlist_title || '알 수 없는 플레이리스트',
      odo_playlist_id: row.odo_playlist_id
    }));
    
    // 결과 반환
    res.json({
      track
    });
  } catch (err) {
    logger.error('트랙 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 트랙 승인 확인 (플레이리스트에 포함되어 있는지)
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const verifyTrack = async (req, res, next) => {
  try {
    const { youtubeTrackId } = req.params;
    
    // 트랙이 승인된 플레이리스트에 포함되어 있는지 확인
    const query = `
      SELECT pt.youtube_playlist_id, op.title
      FROM playlist_track pt
      JOIN odo_playlist op ON pt.youtube_playlist_id = op.youtube_playlist_id
      WHERE pt.youtube_track_id = $1
        AND op.is_active = TRUE
        AND op.is_deleted = FALSE
      LIMIT 1
    `;
    
    const result = await db.query(query, [youtubeTrackId]);
    
    // 플레이리스트 포함 여부 반환
    const inPlaylist = result.rows.length > 0;
    
    res.json({
      youtube_track_id: youtubeTrackId,
      inPlaylist,
      playlist: inPlaylist ? {
        id: result.rows[0].youtube_playlist_id,
        title: result.rows[0].title
      } : null
    });
  } catch (err) {
    logger.error('트랙 승인 확인 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

module.exports = {
  listTracks,
  getTrack,
  verifyTrack
};