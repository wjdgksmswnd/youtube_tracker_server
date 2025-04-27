// src/controllers/playlist.js - 플레이리스트 관련 컨트롤러
const db = require('../db');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/errors');
const axios = require('axios'); // YouTube API 호출용 (필요 시 설치)

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
    let whereClause = 'WHERE op.is_deleted = FALSE';
    
    // 검색어 필터
    if (search) {
      whereClause += ` AND op.title LIKE ?`;
      queryParams.push(`%${search}%`);
    }
    
    // 총 플레이리스트 수 쿼리
    const countQuery = `SELECT COUNT(*) as count FROM odo_playlist op ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams);
    const totalPlaylists = parseInt(countResult.rows[0].count);
    
    // 플레이리스트 목록 쿼리
    const playlistsQuery = `
      SELECT op.id, op.title, op.description, op.youtube_playlist_id,
             op.created_at, op.updated_at, op.is_active, u.username as created_by_name,
             yp.item_count, yp.thumbnail_url
      FROM odo_playlist op
      LEFT JOIN \`user\` u ON op.created_by = u.id
      LEFT JOIN youtube_playlist yp ON op.youtube_playlist_id = yp.youtube_playlist_id
      ${whereClause}
      ORDER BY op.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    // 페이지네이션 파라미터 추가
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
    // 추천 플레이리스트 쿼리 (가장 최근 추가된 활성 상태 5개)
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
             op.created_at, op.updated_at, op.is_active, u.username as created_by_name,
             yp.item_count, yp.thumbnail_url, yp.last_updated
      FROM odo_playlist op
      LEFT JOIN \`user\` u ON op.created_by = u.id
      LEFT JOIN youtube_playlist yp ON op.youtube_playlist_id = yp.youtube_playlist_id
      WHERE op.id = ? AND op.is_deleted = FALSE
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
      WHERE pt.youtube_playlist_id = ?
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
    
    const { title, description, youtube_playlist_id, is_active = true } = req.body;
    const userId = req.user.id;
    
    // 필수 필드 확인
    if (!title) {
      return next(new AppError('플레이리스트 제목이 필요합니다', 400));
    }
    
    // YouTube 플레이리스트 존재 확인 및 추가 (제공된 경우)
    if (youtube_playlist_id) {
      const ytPlaylistQuery = await client.query(
        'SELECT youtube_playlist_id FROM youtube_playlist WHERE youtube_playlist_id = ?',
        [youtube_playlist_id]
      );
      
      if (ytPlaylistQuery.rows.length === 0) {
        // YouTube API 또는 웹 스크래핑을 통해 플레이리스트 정보 가져오기
        // 여기서는 가상의 데이터 추가 (실제로는 YouTube API 사용)
        await client.query(`
          INSERT INTO youtube_playlist 
          (youtube_playlist_id, title, description, thumbnail_url, item_count, last_updated)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON DUPLICATE KEY UPDATE
          last_updated = CURRENT_TIMESTAMP
        `, [
          youtube_playlist_id,
          title,
          description || '',
          '', // 썸네일 URL (실제로는 YouTube API에서 가져옴)
          0   // 아이템 수 (실제로는 YouTube API에서 가져옴)
        ]);
      }
    }
    
    // 새 플레이리스트 생성
    const insertQuery = `
      INSERT INTO odo_playlist (title, description, youtube_playlist_id, created_by, is_active)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const insertResult = await client.query(insertQuery, [
      title,
      description || null,
      youtube_playlist_id || null,
      userId,
      is_active
    ]);
    
    const playlistId = insertResult.insertId;
    
    // 생성된 플레이리스트 정보 조회
    const newPlaylistQuery = `
      SELECT op.id, op.title, op.description, op.youtube_playlist_id,
             op.created_at, op.is_active, u.username as created_by_name
      FROM odo_playlist op
      LEFT JOIN \`user\` u ON op.created_by = u.id
      WHERE op.id = ?
    `;
    
    const newPlaylistResult = await client.query(newPlaylistQuery, [playlistId]);
    
    await client.query('COMMIT');
    
    // 생성된 플레이리스트 정보 반환
    res.status(201).json({
      message: '플레이리스트가 생성되었습니다',
      playlist: newPlaylistResult.rows[0]
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
      'SELECT id, youtube_playlist_id FROM odo_playlist WHERE id = ? AND is_deleted = FALSE',
      [playlistId]
    );
    
    if (playlistQuery.rows.length === 0) {
      return next(new AppError('플레이리스트를 찾을 수 없습니다', 404));
    }
    
    const oldYoutubePlaylistId = playlistQuery.rows[0].youtube_playlist_id;
    
    // YouTube 플레이리스트 ID가 변경된 경우 새 ID 확인 및 처리
    if (youtube_playlist_id && youtube_playlist_id !== oldYoutubePlaylistId) {
      const ytPlaylistQuery = await client.query(
        'SELECT youtube_playlist_id FROM youtube_playlist WHERE youtube_playlist_id = ?',
        [youtube_playlist_id]
      );
      
      if (ytPlaylistQuery.rows.length === 0) {
        // YouTube API 또는 웹 스크래핑을 통해 플레이리스트 정보 가져오기
        // 여기서는 가상의 데이터 추가 (실제로는 YouTube API 사용)
        await client.query(`
          INSERT INTO youtube_playlist 
          (youtube_playlist_id, title, description, thumbnail_url, item_count, last_updated)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON DUPLICATE KEY UPDATE
          last_updated = CURRENT_TIMESTAMP
        `, [
          youtube_playlist_id,
          title || '',
          description || '',
          '', // 썸네일 URL (실제로는 YouTube API에서 가져옴)
          0   // 아이템 수 (실제로는 YouTube API에서 가져옴)
        ]);
      }
    }
    
    // 업데이트할 필드 준비
    const updateFields = [];
    const queryParams = [];
    
    if (title !== undefined) {
      updateFields.push('title = ?');
      queryParams.push(title);
    }
    
    if (description !== undefined) {
      updateFields.push('description = ?');
      queryParams.push(description);
    }
    
    if (youtube_playlist_id !== undefined) {
      updateFields.push('youtube_playlist_id = ?');
      queryParams.push(youtube_playlist_id || null);
    }
    
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      queryParams.push(!!is_active); // Boolean으로 변환
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
      WHERE id = ?
    `;
    
    // 마지막에 playlistId 추가
    queryParams.push(playlistId);
    
    await client.query(updateQuery, queryParams);
    
    // 업데이트된 플레이리스트 정보 조회
    const updatedPlaylistQuery = `
      SELECT op.id, op.title, op.description, op.youtube_playlist_id,
             op.created_at, op.updated_at, op.is_active, u.username as created_by_name
      FROM odo_playlist op
      LEFT JOIN \`user\` u ON op.created_by = u.id
      WHERE op.id = ?
    `;
    
    const updatedPlaylistResult = await client.query(updatedPlaylistQuery, [playlistId]);
    
    await client.query('COMMIT');
    
    // 업데이트된 플레이리스트 정보 반환
    res.json({
      message: '플레이리스트가 업데이트되었습니다',
      playlist: updatedPlaylistResult.rows[0]
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
      'SELECT id FROM odo_playlist WHERE id = ? AND is_deleted = FALSE',
      [playlistId]
    );
    
    if (playlistQuery.rows.length === 0) {
      return next(new AppError('플레이리스트를 찾을 수 없습니다', 404));
    }
    
    // 논리적 삭제 (is_deleted 플래그 설정)
    const deleteQuery = `
      UPDATE odo_playlist
      SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, is_active = FALSE
      WHERE id = ?
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
 * YouTube 플레이리스트 정보 가져오기
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const getYouTubePlaylist = async (req, res, next) => {
  try {
    const { youtubePlaylistId } = req.params;
    
    // 플레이리스트 정보 조회 (로컬 DB)
    const playlistQuery = `
      SELECT * FROM youtube_playlist 
      WHERE youtube_playlist_id = ?
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
        WHERE pt.youtube_playlist_id = ?
        ORDER BY pt.position
      `;
      
      const tracksResult = await db.query(tracksQuery, [youtubePlaylistId]);
      playlist.tracks = tracksResult.rows;
    } else {
      // 실제로는 YouTube API 호출로 플레이리스트 정보를 가져와야 함
      // 여기서는 가상 데이터 반환
      playlist = createMockYouTubePlaylistData(youtubePlaylistId);
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
 * YouTube 플레이리스트 검색
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
      logger.warn('YouTube API 키가 설정되지 않았습니다. 가상 데이터를 반환합니다.');
      
      // 가상 데이터 반환
      const fakePlaylists = createMockYouTubeSearchResults(query);
      
      return res.json({
        playlists: fakePlaylists
      });
    }
    
    // 실제 YouTube API 호출 (구현이 필요할 경우)
    // YouTube API v3 호출 구현...
    
    // 현재는 가상 데이터 반환
    const mockResults = createMockYouTubeSearchResults(query);
    
    res.json({
      playlists: mockResults
    });
  } catch (err) {
    logger.error('YouTube 플레이리스트 검색 오류:', err);
    return next(new AppError('서버 오류', 500));
  }
};

/**
 * YouTube 플레이리스트 동기화
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
       WHERE op.id = ? AND op.is_deleted = FALSE`,
      [playlistId]
    );
    
    if (playlistQuery.rows.length === 0) {
      return next(new AppError('플레이리스트를 찾을 수 없습니다', 404));
    }
    
    const youtubePlaylistId = playlistQuery.rows[0].youtube_playlist_id;
    
    if (!youtubePlaylistId) {
      return next(new AppError('이 플레이리스트는 YouTube 플레이리스트와 연결되어 있지 않습니다', 400));
    }
    
    // 실제로는 YouTube API로부터 플레이리스트 정보와 트랙 목록을 가져와야 함
    // 여기서는 가상 트랙 데이터 생성
    const fakeTracks = createMockTracks(10);
    
    // YouTube 플레이리스트 정보 업데이트
    await client.query(
      `UPDATE youtube_playlist
       SET last_updated = CURRENT_TIMESTAMP, item_count = ?
       WHERE youtube_playlist_id = ?`,
      [fakeTracks.length, youtubePlaylistId]
    );
    
    // 기존 플레이리스트-트랙 매핑 제거 (선택적)
    // await client.query(
    //   `DELETE FROM playlist_track
    //    WHERE youtube_playlist_id = ?`,
    //   [youtubePlaylistId]
    // );
    
    // 트랙 정보 동기화
    for (let i = 0; i < fakeTracks.length; i++) {
      const track = fakeTracks[i];
      
      // 트랙 정보 저장 또는 업데이트
      await client.query(
        `INSERT INTO track 
         (youtube_track_id, title, artist, duration_seconds, thumbnail_url)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           title = VALUES(title),
           artist = VALUES(artist),
           duration_seconds = VALUES(duration_seconds),
           thumbnail_url = VALUES(thumbnail_url),
           updated_at = CURRENT_TIMESTAMP`,
        [
          track.youtube_track_id,
          track.title,
          track.artist,
          track.duration_seconds,
          track.thumbnail_url || null
        ]
      );
      
      // 플레이리스트-트랙 매핑 저장
      await client.query(
        `INSERT INTO playlist_track
         (youtube_playlist_id, youtube_track_id, position)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE position = ?, updated_at = CURRENT_TIMESTAMP`,
        [youtubePlaylistId, track.youtube_track_id, i, i]
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

/**
 * 가상 YouTube 검색 결과 생성 (개발용)
 * @param {string} query - 검색어
 * @returns {Array} 가상 플레이리스트 목록
 */
function createMockYouTubeSearchResults(query) {
  return [
    {
      id: `PL${Math.random().toString(36).substr(2, 8)}`,
      title: `${query} 관련 플레이리스트 1`,
      description: '검색 결과 설명',
      thumbnail_url: 'https://example.com/thumbnail1.jpg',
      item_count: Math.floor(Math.random() * 30) + 10
    },
    {
      id: `PL${Math.random().toString(36).substr(2, 8)}`,
      title: `${query} 관련 플레이리스트 2`,
      description: '두 번째 검색 결과',
      thumbnail_url: 'https://example.com/thumbnail2.jpg',
      item_count: Math.floor(Math.random() * 30) + 10
    },
    {
      id: `PL${Math.random().toString(36).substr(2, 8)}`,
      title: `베스트 ${query} 모음`,
      description: '인기 컬렉션',
      thumbnail_url: 'https://example.com/thumbnail3.jpg',
      item_count: Math.floor(Math.random() * 30) + 10
    }
  ];
}

/**
 * 가상 YouTube 플레이리스트 데이터 생성 (개발용)
 * @param {string} playlistId - 플레이리스트 ID
 * @returns {Object} 가상 플레이리스트 정보
 */
function createMockYouTubePlaylistData(playlistId) {
  const trackCount = Math.floor(Math.random() * 10) + 5;
  
  return {
    youtube_playlist_id: playlistId,
    title: `YouTube 플레이리스트 ${playlistId.substring(0, 6)}`,
    description: '플레이리스트 설명',
    thumbnail_url: 'https://example.com/thumbnail.jpg',
    item_count: trackCount,
    last_updated: new Date().toISOString(),
    tracks: createMockTracks(trackCount)
  };
}

/**
 * 가상 트랙 데이터 생성 (개발용)
 * @param {number} count - 생성할 트랙 수
 * @returns {Array} 가상 트랙 목록
 */
function createMockTracks(count) {
  const tracks = [];
  const artists = ['아티스트 A', '가수 B', '밴드 C', '뮤지션 D', '그룹 E'];
  
  for (let i = 0; i < count; i++) {
    const trackId = `track-${Math.random().toString(36).substr(2, 9)}`;
    
    tracks.push({
      youtube_track_id: trackId,
      title: `트랙 ${i + 1}`,
      artist: artists[Math.floor(Math.random() * artists.length)],
      duration_seconds: Math.floor(Math.random() * 300) + 120, // 2~7분 사이
      thumbnail_url: `https://example.com/track-${i}.jpg`,
      position: i
    });
  }
  
  return tracks;
}

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