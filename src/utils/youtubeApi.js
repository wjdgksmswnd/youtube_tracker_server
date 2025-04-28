// src/utils/youtubeApi.js
const { google } = require('googleapis');
const axios = require('axios');
const { logger } = require('./logger');

// YouTube API 설정
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});

/**
 * YouTube 플레이리스트 정보를 가져오는 함수
 * @param {string} playlistId - YouTube 플레이리스트 ID
 * @returns {Promise<Object>} 플레이리스트 정보
 */
async function getYouTubePlaylistInfo(playlistId) {
  try {
    // 플레이리스트 기본 정보 가져오기
    const playlistResponse = await youtube.playlists.list({
      part: 'snippet,contentDetails',
      id: playlistId
    });

    if (!playlistResponse.data.items || playlistResponse.data.items.length === 0) {
      throw new Error(`Playlist not found: ${playlistId}`);
    }

    const playlistData = playlistResponse.data.items[0];
    const snippet = playlistData.snippet;
    const contentDetails = playlistData.contentDetails;

    // 썸네일 URL 결정 (고해상도 우선)
    let thumbnailUrl = '';
    if (snippet.thumbnails) {
      if (snippet.thumbnails.high) {
        thumbnailUrl = snippet.thumbnails.high.url;
      } else if (snippet.thumbnails.medium) {
        thumbnailUrl = snippet.thumbnails.medium.url;
      } else if (snippet.thumbnails.default) {
        thumbnailUrl = snippet.thumbnails.default.url;
      }
    }

    // 기본 플레이리스트 정보 구성
    const playlist = {
      youtube_playlist_id: playlistId,
      title: snippet.title,
      description: snippet.description || '',
      thumbnail_url: thumbnailUrl,
      item_count: contentDetails.itemCount || 0,
      tracks: []
    };

    // 플레이리스트 아이템(트랙) 가져오기
    await getPlaylistItems(playlist);

    return playlist;
  } catch (error) {
    logger.error(`YouTube API 플레이리스트 정보 가져오기 오류: ${error.message}`);
    throw error;
  }
}

/**
 * 플레이리스트의 아이템(트랙) 목록을 가져오는 함수
 * @param {Object} playlist - 플레이리스트 정보 객체 (수정됨)
 */
async function getPlaylistItems(playlist) {
  try {
    let nextPageToken = null;
    let position = 0;

    do {
      // 플레이리스트 아이템 목록 가져오기
      const itemsResponse = await youtube.playlistItems.list({
        part: 'snippet,contentDetails',
        playlistId: playlist.youtube_playlist_id,
        maxResults: 50,
        pageToken: nextPageToken
      });

      // 비디오 ID 목록 추출
      const videoIds = itemsResponse.data.items
        .map(item => item.contentDetails.videoId)
        .join(',');

      // 비디오 상세 정보 가져오기 (기간 등)
      const videosResponse = await youtube.videos.list({
        part: 'contentDetails,snippet',
        id: videoIds
      });

      // 비디오 정보와 플레이리스트 아이템 정보 결합
      const videosMap = {};
      videosResponse.data.items.forEach(video => {
        videosMap[video.id] = video;
      });

      // 트랙 정보 구성
      for (const item of itemsResponse.data.items) {
        const videoId = item.contentDetails.videoId;
        const video = videosMap[videoId];
        
        if (!video) continue; // 비디오 정보가 없는 경우 스킵

        const videoSnippet = video.snippet;
        const videoDuration = parseDuration(video.contentDetails.duration);
        
        // 썸네일 URL 결정
        let thumbnailUrl = '';
        if (videoSnippet.thumbnails) {
          if (videoSnippet.thumbnails.high) {
            thumbnailUrl = videoSnippet.thumbnails.high.url;
          } else if (videoSnippet.thumbnails.medium) {
            thumbnailUrl = videoSnippet.thumbnails.medium.url;
          } else if (videoSnippet.thumbnails.default) {
            thumbnailUrl = videoSnippet.thumbnails.default.url;
          }
        }

        // 트랙 정보 구성 및 추가
        playlist.tracks.push({
          youtube_track_id: videoId,
          title: videoSnippet.title,
          artist: videoSnippet.channelTitle || '',
          duration_seconds: videoDuration,
          thumbnail_url: thumbnailUrl,
          position: position++
        });
      }

      // 다음 페이지 토큰 업데이트
      nextPageToken = itemsResponse.data.nextPageToken;
    } while (nextPageToken);

  } catch (error) {
    logger.error(`YouTube API 플레이리스트 아이템 가져오기 오류: ${error.message}`);
    // 오류가 발생해도 가져온 트랙 정보까지는 유지
  }
}

/**
 * ISO 8601 기간 포맷을 초로 변환
 * @param {string} duration - ISO 8601 기간 포맷 (PT1H2M3S)
 * @returns {number} 초 단위 기간
 */
function parseDuration(duration) {
  try {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    
    return hours * 3600 + minutes * 60 + seconds;
  } catch (error) {
    logger.warn(`Duration parsing error: ${duration}`);
    return 0;
  }
}

/**
 * YouTube 플레이리스트 검색 함수
 * @param {string} query - 검색어
 * @returns {Promise<Array>} 검색 결과 목록
 */
async function searchYouTubePlaylists(query) {
  try {
    const response = await youtube.search.list({
      part: 'snippet',
      q: query,
      type: 'playlist',
      maxResults: 10
    });

    return response.data.items.map(item => {
      // 썸네일 URL 결정
      let thumbnailUrl = '';
      if (item.snippet.thumbnails) {
        if (item.snippet.thumbnails.high) {
          thumbnailUrl = item.snippet.thumbnails.high.url;
        } else if (item.snippet.thumbnails.medium) {
          thumbnailUrl = item.snippet.thumbnails.medium.url;
        } else if (item.snippet.thumbnails.default) {
          thumbnailUrl = item.snippet.thumbnails.default.url;
        }
      }

      return {
        id: item.id.playlistId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail_url: thumbnailUrl,
        // 아이템 수는 이 API에서 제공되지 않음
        item_count: 0
      };
    });
  } catch (error) {
    logger.error(`YouTube API 플레이리스트 검색 오류: ${error.message}`);
    throw error;
  }
}

// API 속도 제한 회피를 위한 백업 HTTP 요청 구현
async function fetchYouTubePlaylistWithAxios(playlistId) {
  try {
    // 기본 플레이리스트 정보 가져오기
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${playlistId}&key=${process.env.YOUTUBE_API_KEY}`;
    const playlistResponse = await axios.get(playlistUrl);
    
    if (!playlistResponse.data.items || playlistResponse.data.items.length === 0) {
      throw new Error(`Playlist not found: ${playlistId}`);
    }

    // 기본 처리 로직은 위 함수와 동일...
    // 실제 구현 시 필요에 따라 확장
  } catch (error) {
    logger.error(`YouTube API HTTP 요청 오류: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getYouTubePlaylistInfo,
  searchYouTubePlaylists
};