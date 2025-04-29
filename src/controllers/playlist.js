// src/controllers/playlist.js - 플레이리스트 관련 컨트롤러
const db = require('../db');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/errors');
const { getYouTubePlaylistInfo, searchYouTubePlaylists } = require('../utils/youtubeApi');

// fetchYouTubePlaylistData 함수를 실제 API 호출로 대체
async function fetchYouTubePlaylistData(playlistId) {
  try {
    // YouTube API 호출
    console.log('YouTube API에서 가져온 플레이리스트 가져오기');
    console.log('YouTube API에서 가져온 플레이리스트 가져오기');
    const playlistInfo = await getYouTubePlaylistInfo(playlistId);
    logger.debug('YouTube API에서 가져온 플레이리스트 정보:', JSON.stringify(playlistInfo));
    return playlistInfo;
  } catch (error) {
    console.log('YouTube API에서 가져온 플레이리스트 가져오기 실패: ', error );
    logger.error('YouTube API 호출 오류:', error);
    // API 호출 실패 시 가상 데이터로 폴백
    logger.warn('YouTube API 호출 실패, 가상 데이터 사용');
    return createMockYouTubePlaylistData(playlistId);
  }
}

// searchYouTubePlaylist 컨트롤러 함수 수정
const searchYouTubePlaylist = async (req, res, next) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return next(new AppError('검색어가 필요합니다', 400));
    }
    
    // YouTube API 키 확인
    if (!process.env.YOUTUBE_API_KEY) {
      logger.warn('YouTube API 키가 설정되지 않았습니다. 가상 데이터를 반환합니다.');
      
      // 가상 데이터 반환
      const fakePlaylists = createMockYouTubeSearchResults(query);
      
      return res.json({
        playlists: fakePlaylists
      });
    }
    
    // 실제 YouTube API 호출
    const results = await searchYouTubePlaylists(query);
    
    res.json({
      playlists: results
    });
  } catch (err) {
    logger.error('YouTube 플레이리스트 검색 오류:', err);
    
    // API 호출 실패 시 가상 데이터로 폴백
    const mockResults = createMockYouTubeSearchResults(query);
    
    res.json({
      playlists: mockResults,
      note: 'API 호출 실패로 가상 데이터를 반환합니다'
    });
  }
};

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
    
    // YouTube 플레이리스트 정보 처리 (제공된 경우)
    if (youtube_playlist_id) {
      // YouTube API 또는 웹 스크래핑을 통해 플레이리스트 정보 가져오기

      // #TODO: 여기서는 fetch한 데이터가 아닌 전달받은 json으로 저장해야함
      // 일단 getPlaylist에서 이미 insert했기 때문에 막아둠

      // const youtubeData = await fetchYouTubePlaylistData(youtube_playlist_id);
      
      // YouTube 플레이리스트 정보 저장/업데이트
      /*
      await client.query(`
        INSERT INTO youtube_playlist 
        (youtube_playlist_id, title, description, thumbnail_url, item_count, last_updated)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        description = VALUES(description),
        thumbnail_url = VALUES(thumbnail_url),
        item_count = VALUES(item_count),
        last_updated = CURRENT_TIMESTAMP
      `, [
        youtube_playlist_id,
        youtubeData.title,
        youtubeData.description || '',
        youtubeData.thumbnail_url || '',
        youtubeData.tracks?.length || 0
      ]);
      
      // 트랙 정보 처리
      if (youtubeData.tracks && youtubeData.tracks.length > 0) {
        for (let i = 0; i < youtubeData.tracks.length; i++) {
          const track = youtubeData.tracks[i];
          
          // 트랙 정보 저장 (중복 무시)
          await client.query(`
            INSERT INTO track 
            (youtube_track_id, title, artist, duration_seconds, thumbnail_url)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            title = VALUES(title),
            artist = VALUES(artist),
            duration_seconds = VALUES(duration_seconds),
            thumbnail_url = VALUES(thumbnail_url),
            updated_at = CURRENT_TIMESTAMP
          `, [
            track.youtube_track_id,
            track.title,
            track.artist || '',
            track.duration_seconds || 0,
            track.thumbnail_url || null
          ]);
          
          // playlist_track 매핑 저장
          await client.query(`
            INSERT INTO playlist_track
            (youtube_playlist_id, youtube_track_id, position)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            position = VALUES(position),
            updated_at = CURRENT_TIMESTAMP
          `, [
            youtube_playlist_id,
            track.youtube_track_id,
            i
          ]);
        }
      }
        */
    }
    
    // 생성된 플레이리스트 정보 조회
    const newPlaylistQuery = `
      SELECT op.id, op.title, op.description, op.youtube_playlist_id,
             op.created_at, op.is_active, u.username as created_by_name,
             yp.thumbnail_url, yp.item_count
      FROM odo_playlist op
      LEFT JOIN \`user\` u ON op.created_by = u.id
      LEFT JOIN youtube_playlist yp ON op.youtube_playlist_id = yp.youtube_playlist_id
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
      // DB에 있는 정보 사용
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
      // #TODO : 여기서는 inser하면 안됨
      // DB에 없으면 YouTube API로 가져와서 client 쪽에 쏴줬다가 createPlaylist에서 insert해야하는데 일단 여기서 insert하는거로 막아둠
      playlist = await fetchYouTubePlaylistData(youtubePlaylistId);
      
      // 가져온 정보를 DB에 저장
      await db.query(`
        INSERT INTO youtube_playlist 
        (youtube_playlist_id, title, description, thumbnail_url, item_count, last_updated)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        youtubePlaylistId,
        playlist.title,
        playlist.description || '',
        playlist.thumbnail_url || '',
        playlist.tracks?.length || 0
      ]);
      
      // 트랙 정보도 저장
      if (playlist.tracks && playlist.tracks.length > 0) {
        const client = await db.getClient();
        try {
          await client.query('BEGIN');
          
          for (let i = 0; i < playlist.tracks.length; i++) {
            const track = playlist.tracks[i];
            
            // 트랙 정보 저장
            await client.query(`
              INSERT INTO track 
              (youtube_track_id, title, artist, duration_seconds, thumbnail_url)
              VALUES (?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE 
                title = VALUES(title),
                artist = VALUES(artist),
                duration_seconds = VALUES(duration_seconds),
                thumbnail_url = VALUES(thumbnail_url),
                updated_at = CURRENT_TIMESTAMP
            `, [
              track.youtube_track_id,
              track.title,
              track.artist || '',
              track.duration_seconds || 0,
              track.thumbnail_url || null
            ]);
            
            // 기존 플레이리스트-트랙 매핑 제거
            await client.query(
              `DELETE FROM playlist_track
              WHERE youtube_playlist_id = ?`,
              [youtubePlaylistId]
            );

            // 플레이리스트-트랙 매핑 저장
            await client.query(`
              INSERT INTO playlist_track
              (youtube_playlist_id, youtube_track_id, position)
              VALUES (?, ?, ?)
              ON DUPLICATE KEY UPDATE position = ?
            `, [
              youtubePlaylistId,
              track.youtube_track_id,
              i,
              i
            ]);
          }
          
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          logger.error('트랙 저장 오류:', err);
        } finally {
          client.release();
        }
      }
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
    
    // YouTube API로부터 플레이리스트 정보 가져오기
    const youtubeData = await fetchYouTubePlaylistData(youtubePlaylistId);
    const tracks = youtubeData.tracks || [];
    
    // YouTube 플레이리스트 정보 업데이트
    await client.query(
      `UPDATE youtube_playlist
       SET title = ?,
           description = ?,
           thumbnail_url = ?,
           item_count = ?,
           last_updated = CURRENT_TIMESTAMP
       WHERE youtube_playlist_id = ?`,
      [
        youtubeData.title,
        youtubeData.description || '',
        youtubeData.thumbnail_url || '',
        tracks.length,
        youtubePlaylistId
      ]
    );
    
    // 기존 플레이리스트-트랙 매핑 제거
    await client.query(
      `DELETE FROM playlist_track
       WHERE youtube_playlist_id = ?`,
      [youtubePlaylistId]
    );
    
    // 트랙 정보 및 매핑 동기화
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      
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
          track.artist || '',
          track.duration_seconds || 0,
          track.thumbnail_url || null
        ]
      );
      
      // 플레이리스트-트랙 매핑 저장
      await client.query(
        `INSERT INTO playlist_track
         (youtube_playlist_id, youtube_track_id, position)
         VALUES (?, ?, ?)`,
        [youtubePlaylistId, track.youtube_track_id, i]
      );
    }
    
    await client.query('COMMIT');
    
    res.json({
      message: '플레이리스트가 성공적으로 동기화되었습니다',
      tracks_count: tracks.length
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
 * playlist 승인 확인 (플레이리스트에 포함되어 있는지)
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
const verifyPlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    
    // 트랙이 승인된 플레이리스트에 포함되어 있는지 확인
    const query = `
      SELECT op.youtube_playlist_id
      FROM odo_playlist op
      WHERE op.youtube_playlist_id = $1
        AND op.is_active = TRUE
        AND op.is_deleted = FALSE
      LIMIT 1
    `;
    
    const result = await db.query(query, [playlistId]);
    
    // 플레이리스트 포함 여부 반환
    const inPlaylist = result.rows.length > 0;
    
    res.status(200).json({isApproved: inPlaylist});
  } catch (err) {
    logger.error('playlist 승인 확인 오류:', err);
    res.status(200).json({isApproved: false});
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
  syncYouTubePlaylist,
  verifyPlaylist
};