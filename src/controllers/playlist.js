// src/controllers/playlist.js - 플레이리스트 관련 컨트롤러
const db = require('../db');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * 플레이리스트 목록 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const listPlaylists = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    
    // 페이지네이션 설정
    const offset = (page - 1) * limit;
    
    // 쿼리 파라미터
    const queryParams = [];
    let whereClause = 'WHERE op.is_active = TRUE AND op.is_deleted = FALSE';
    
    // 검색어 필터
    if (search) {
      queryParams.push(`%${search}%`);
      whereClause += ` AND op.title ILIKE $${queryParams.length}`;
    }
    
    // 총 플레이리스트 수 쿼리
    const countQuery = `SELECT COUNT(*) FROM odo_playlist op ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams);
    const totalPlaylists = parseInt(countResult.rows[0].count);
    
    // 플레이리스트 목록 쿼리
    const playlistsQuery = `
      SELECT op.id, op.title, op.description, op.youtube_playlist_id,
             op.created_at, op.updated_at, u.username as created_by_name,
             yp.item_count, yp.thumbnail_url
      FROM odo_playlist op
      LEFT JOIN "user" u ON op.created_by = u.id
      LEFT JOIN youtube_playlist yp ON op.youtube_playlist_id = yp.youtube_playlist_id
      ${whereClause}
      ORDER BY op.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    
    queryParams.push(parseInt(limit), offset);
    const playlistsResult = await db.query(playlistsQuery, queryParams);
    
    // 결과 반환
    res.json({
      playlists: playlistsResult.rows,
      pagination: {
        total: totalPlaylists,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(totalPlaylists / limit)
      }
    });
  } catch (err) {
    logger.error('플레이리스트 목록 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 추천 플레이리스트 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const getRecommendedPlaylists = async (req, res, next) => {
  try {
    // 추천 플레이리스트 쿼리 (가장 최근 추가된 5개)
    const playlistsQuery = `
      SELECT op.id, op.title, op.description, op.youtube_playlist_id,
             op.created_at, yp.item_count, yp.thumbnail_url
      FROM odo_playlist op
      LEFT JOIN youtube_playlist yp ON op.youtube_playlist_id = yp.youtube_playlist_id
      WHERE op.is_active = TRUE AND op.is_deleted = FALSE
      ORDER BY op.created_at DESC
      LIMIT 5
    `;
    
    const playlistsResult = await db.query(playlistsQuery);
    
    // 결과 반환
    res.json({
      playlists: playlistsResult.rows
    });
  } catch (err) {
    logger.error('추천 플레이리스트 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 특정 플레이리스트 조회
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const getPlaylist = async (req, res, next) => {
  try {
    const { playlistId } = req.params;
    
    // 플레이리스트 정보 쿼리
    const playlistQuery = `
      SELECT op.id, op.title, op.description, op.youtube_playlist_id,
             op.created_at, op.updated_at, u.username as created_by_name,
             yp.item_count, yp.thumbnail_url, yp.last_updated
      FROM odo_playlist op
      LEFT JOIN "user" u ON op.created_by = u.id
      LEFT JOIN youtube_playlist yp ON op.youtube_playlist_id = yp.youtube_playlist_id
      WHERE op.id = $1 AND op.is_deleted = FALSE
    `;
    
    const playlistResult = await db.query(playlistQuery, [playlistId]);
    
    if (playlistResult.rows.length === 0) {
      return next(new AppError('플레이리스트를 찾을 수 없습니다', 404));
    }
    
    const playlist = playlistResult.rows[0];
    
    // 플레이리스트 트랙 쿼리
    const tracksQuery = `
      SELECT pt.position, t.youtube_track_id, t.title, t.artist, 
             t.duration_seconds, t.thumbnail_url
      FROM playlist_track pt
      JOIN track t ON pt.youtube_track_id = t.youtube_track_id
      WHERE pt.youtube_playlist_id = $1
      ORDER BY pt.position
    `;
    
    const tracksResult = await db.query(tracksQuery, [playlist.youtube_playlist_id]);
    
    // 결과에 트랙 목록 추가
    playlist.tracks = tracksResult.rows;
    
    // 결과 반환
    res.json({
      playlist
    });
  } catch (err) {
    logger.error('플레이리스트 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * 플레이리스트 생성
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const createPlaylist = async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { title, description, youtube_playlist_id } = req.body;
    const userId = req.user.id;
    
    // 필수 필드 확인
    if (!title) {
      return next(new AppError('플레이리스트 제목이 필요합니다', 400));
    }
    
    // YouTube 플레이리스트 존재 확인 (제공된 경우)
    if (youtube_playlist_id) {
      const ytPlaylistQuery = await client.query(
        'SELECT youtube_playlist_id FROM youtube_playlist WHERE youtube_playlist_id = $1',
        [youtube_playlist_id]
      );
      
      if (ytPlaylistQuery.rows.length === 0) {
        return next(new AppError('유효하지 않은 YouTube 플레이리스트 ID입니다', 400));
      }
    }
    
    // 새 플레이리스트 생성
    const insertQuery = `
      INSERT INTO odo_playlist (title, description, youtube_playlist_id, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const insertResult = await client.query(insertQuery, [
      title,
      description || null,
      youtube_playlist_id || null,
      userId
    ]);
    
    await client.query('COMMIT');
    
    // 생성된 플레이리스트 정보 반환
    res.status(201).json({
      message: '플레이리스트가 생성되었습니다',
      playlist: insertResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('플레이리스트 생성 오류:', err);
    return next(new AppError('서버 오류', 500));
  } finally {
    client.release();
  }
};

/**
 * 플레이리스트 수정
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const updatePlaylist = async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { playlistId } = req.params;
    const { title, description, youtube_playlist_id, is_active } = req.body;
    
    // 플레이리스트 존재 확인
    const playlistQuery = await client.query(
      'SELECT id FROM odo_playlist WHERE id = $1 AND is_deleted = FALSE',
      [playlistId]
    );
    
    if (playlistQuery.rows.length === 0) {
      return next(new AppError('플레이리스트를 찾을 수 없습니다', 404));
    }
    
    // YouTube 플레이리스트 존재 확인 (제공된 경우)
    if (youtube_playlist_id) {
      const ytPlaylistQuery = await client.query(
        'SELECT youtube_playlist_id FROM youtube_playlist WHERE youtube_playlist_id = $1',
        [youtube_playlist_id]
      );
      
      if (ytPlaylistQuery.rows.length === 0) {
        return next(new AppError('유효하지 않은 YouTube 플레이리스트 ID입니다', 400));
      }
    }
    
    // 업데이트할 필드 준비
    const updateFields = [];
    const queryParams = [playlistId]; // 첫 번째 파라미터는 playlistId
    
    if (title !== undefined) {
      queryParams.push(title);
      updateFields.push(`title = $${queryParams.length}`);
    }
    
    if (description !== undefined) {
      queryParams.push(description);
      updateFields.push(`description = $${queryParams.length}`);
    }
    
    if (youtube_playlist_id !== undefined) {
      queryParams.push(youtube_playlist_id);
      updateFields.push(`youtube_playlist_id = $${queryParams.length}`);
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
    
    // 플레이리스트 업데이트
    const updateQuery = `
      UPDATE odo_playlist
      SET ${updateFields.join(', ')}
      WHERE id = $1
      RETURNING *
    `;
    
    const updateResult = await client.query(updateQuery, queryParams);
    
    await client.query('COMMIT');
    
    // 업데이트된 플레이리스트 정보 반환
    res.json({
      message: '플레이리스트가 업데이트되었습니다',
      playlist: updateResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('플레이리스트 업데이트 오류:', err);
    return next(new AppError('서버 오류', 500));
  } finally {
    client.release();
  }
};

/**
 * 플레이리스트 삭제
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const deletePlaylist = async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { playlistId } = req.params;
    
    // 플레이리스트 존재 확인
    const playlistQuery = await client.query(
      'SELECT id FROM odo_playlist WHERE id = $1 AND is_deleted = FALSE',
      [playlistId]
    );
    
    if (playlistQuery.rows.length === 0) {
      return next(new AppError('플레이리스트를 찾을 수 없습니다', 404));
    }
    
    // 논리적 삭제 (is_deleted 플래그 설정)
    const deleteQuery = `
      UPDATE odo_playlist
      SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, is_active = FALSE
      WHERE id = $1
      RETURNING id
    `;
    
    await client.query(deleteQuery, [playlistId]);
    
    await client.query('COMMIT');
    
    res.json({
      message: '플레이리스트가 삭제되었습니다'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('플레이리스트 삭제 오류:', err);
    return next(new AppError('서버 오류', 500));
  } finally {
    client.release();
  }
};

/**
 * YouTube 플레이리스트 검색 (외부 API 호출 가정)
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const searchYouTubePlaylist = async (req, res, next) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return next(new AppError('검색어가 필요합니다', 400));
    }
    
    // YouTube API 키 준비 (환경 변수에서 가져옴)
    const youtubeApiKey = process.env.YOUTUBE_API_KEY;
    
    if (!youtubeApiKey) {
      return next(new AppError('YouTube API 키가 설정되지 않았습니다', 500));
    }
    
    // 이 부분은 실제 YouTube API를 호출하는 코드가 필요합니다.
    // 여기서는 가짜 데이터를 반환합니다.
    const fakePlaylists = [
      {
        id: 'PL1234567890',
        title: `검색 결과: ${query} - 플레이리스트 1`,
        description: '검색 결과 설명',
        thumbnail_url: 'https://example.com/thumbnail1.jpg',
        item_count: 25
      },
      {
        id: 'PL0987654321',
        title: `검색 결과: ${query} - 플레이리스트 2`,
        description: '두 번째 검색 결과',
        thumbnail_url: 'https://example.com/thumbnail2.jpg',
        item_count: 18
      }
    ];
    
    // 결과 반환
    res.json({
      playlists: fakePlaylists
    });
  } catch (err) {
    logger.error('YouTube 플레이리스트 검색 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * YouTube 플레이리스트 정보 조회 (외부 API 호출 가정)
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const getYouTubePlaylist = async (req, res, next) => {
  try {
    const { youtubePlaylistId } = req.params;
    
    // 플레이리스트 정보 조회 (로컬 DB 체크)
    const playlistQuery = `
      SELECT * FROM youtube_playlist 
      WHERE youtube_playlist_id = $1
    `;
    
    const playlistResult = await db.query(playlistQuery, [youtubePlaylistId]);
    
    let playlist;
    
    if (playlistResult.rows.length > 0) {
      playlist = playlistResult.rows[0];
      
      // 트랙 목록 조회
      const tracksQuery = `
        SELECT pt.position, t.youtube_track_id, t.title, t.artist, 
               t.duration_seconds, t.thumbnail_url
        FROM playlist_track pt
        JOIN track t ON pt.youtube_track_id = t.youtube_track_id
        WHERE pt.youtube_playlist_id = $1
        ORDER BY pt.position
      `;
      
      const tracksResult = await db.query(tracksQuery, [youtubePlaylistId]);
      playlist.tracks = tracksResult.rows;
    } else {
      // DB에 없는 경우 가짜 데이터 반환 (실제로는 YouTube API 호출 필요)
      playlist = {
        youtube_playlist_id: youtubePlaylistId,
        title: `YouTube 플레이리스트 ${youtubePlaylistId}`,
        description: '플레이리스트 설명',
        thumbnail_url: 'https://example.com/thumbnail.jpg',
        item_count: 20,
        last_updated: new Date().toISOString(),
        tracks: Array.from({ length: 5 }, (_, i) => ({
          position: i,
          youtube_track_id: `track-${i}`,
          title: `트랙 ${i + 1}`,
          artist: '아티스트 이름',
          duration_seconds: 180,
          thumbnail_url: 'https://example.com/track-thumbnail.jpg'
        }))
      };
    }
    
    // 결과 반환
    res.json({
      playlist
    });
  } catch (err) {
    logger.error('YouTube 플레이리스트 정보 조회 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * YouTube 플레이리스트 동기화 (트랙 정보 업데이트)
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const syncYouTubePlaylist = async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { playlistId } = req.params;
    
    // 플레이리스트 존재 확인
    const playlistQuery = await client.query(
      `SELECT op.id, op.youtube_playlist_id 
       FROM odo_playlist op
       WHERE op.id = $1 AND op.is_deleted = FALSE`,
      [playlistId]
    );
    
    if (playlistQuery.rows.length === 0) {
      return next(new AppError('플레이리스트를 찾을 수 없습니다', 404));
    }
    
    const youtubePlaylistId = playlistQuery.rows[0].youtube_playlist_id;
    
    if (!youtubePlaylistId) {
      return next(new AppError('이 플레이리스트는 YouTube 플레이리스트와 연결되어 있지 않습니다', 400));
    }
    
    // 이 부분은 실제 YouTube API를 호출하여 최신 트랙 정보를 가져와야 합니다.
    // 여기서는 가짜 데이터를 사용하여 동기화를 시뮬레이션합니다.
    
    // 플레이리스트 정보 업데이트 (마지막 업데이트 시간 등)
    await client.query(
      `UPDATE youtube_playlist
       SET last_updated = CURRENT_TIMESTAMP, item_count = 10
       WHERE youtube_playlist_id = $1`,
      [youtubePlaylistId]
    );
    
    // 가짜 트랙 데이터 (실제로는 YouTube API에서 가져온 데이터)
    const fakeTracks = Array.from({ length: 10 }, (_, i) => ({
      youtube_track_id: `track-${i}-${Date.now()}`,
      title: `업데이트된 트랙 ${i + 1}`,
      artist: '아티스트 이름',
      duration_seconds: 180 + i * 10,
      position: i
    }));
    
    // 트랙 정보 동기화
    for (const track of fakeTracks) {
      // 트랙 정보 저장 또는 업데이트
      await client.query(
        `INSERT INTO track 
         (youtube_track_id, title, artist, duration_seconds)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (youtube_track_id) 
         DO UPDATE SET 
           title = EXCLUDED.title,
           artist = EXCLUDED.artist,
           duration_seconds = EXCLUDED.duration_seconds,
           updated_at = CURRENT_TIMESTAMP`,
        [track.youtube_track_id, track.title, track.artist, track.duration_seconds]
      );
      
      // 플레이리스트-트랙 매핑 저장 또는 업데이트
      await client.query(
        `INSERT INTO playlist_track
         (youtube_playlist_id, youtube_track_id, position)
         VALUES ($1, $2, $3)
         ON CONFLICT (youtube_playlist_id, youtube_track_id)
         DO UPDATE SET position = EXCLUDED.position, updated_at = CURRENT_TIMESTAMP`,
        [youtubePlaylistId, track.youtube_track_id, track.position]
      );
    }
    
    await client.query('COMMIT');
    
    res.json({
      message: '플레이리스트가 성공적으로 동기화되었습니다',
      tracks_count: fakeTracks.length
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('YouTube 플레이리스트 동기화 오류:', err);
    return next(new AppError('서버 오류', 500));
  } finally {
    client.release();
  }
};

module.exports = {
  listPlaylists,
  getRecommendedPlaylists,
  getPlaylist,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  searchYouTubePlaylist,
  getYouTubePlaylist,
  syncYouTubePlaylist
};