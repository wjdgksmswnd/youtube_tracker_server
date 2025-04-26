// api.js - API 호출 유틸리티
const API = {
    // 인증 토큰 가져오기
    getToken() {
      return localStorage.getItem(CONFIG.TOKEN_KEY);
    },
    
    // 세션 ID 가져오기
    getSessionId() {
      return localStorage.getItem(CONFIG.SESSION_KEY);
    },
    
    // 헤더 생성
    getHeaders() {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const sessionId = this.getSessionId();
      if (sessionId) {
        headers['X-Session-ID'] = sessionId;
      }
      
      return headers;
    },
    
    // API 요청 함수
    async request(endpoint, options = {}) {
      const url = `${CONFIG.API_URL}${endpoint}`;
      
      const fetchOptions = {
        method: options.method || 'GET',
        headers: this.getHeaders(),
        ...options
      };
      
      if (options.body && typeof options.body === 'object') {
        fetchOptions.body = JSON.stringify(options.body);
      }
      
      try {
        const response = await fetch(url, fetchOptions);
        
        // 401 Unauthorized (토큰 만료)
        if (response.status === 401) {
          // 로그인 페이지로 리디렉션
          localStorage.removeItem(CONFIG.TOKEN_KEY);
          localStorage.removeItem(CONFIG.SESSION_KEY);
          window.location.href = '/index.html';
          throw new Error('인증이 만료되었습니다. 다시 로그인하세요.');
        }
        
        // 응답 데이터 파싱
        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }
        
        if (!response.ok) {
          throw new Error(data.error || data.message || '서버 오류가 발생했습니다.');
        }
        
        return data;
      } catch (error) {
        console.error('API 요청 오류:', error);
        throw error;
      }
    },
    
    // GET 요청
    async get(endpoint, params = {}) {
      const queryString = Object.keys(params).length > 0
        ? `?${new URLSearchParams(params).toString()}`
        : '';
      
      return this.request(`${endpoint}${queryString}`);
    },
    
    // POST 요청
    async post(endpoint, data = {}) {
      return this.request(endpoint, {
        method: 'POST',
        body: data
      });
    },
    
    // PUT 요청
    async put(endpoint, data = {}) {
      return this.request(endpoint, {
        method: 'PUT',
        body: data
      });
    },
    
    // DELETE 요청
    async delete(endpoint) {
      return this.request(endpoint, {
        method: 'DELETE'
      });
    },
    
    // 파일 다운로드 요청
    async downloadFile(endpoint, params = {}, filename = 'download.xlsx') {
      const token = this.getToken();
      const queryString = Object.keys(params).length > 0
        ? `?${new URLSearchParams(params).toString()}`
        : '';
      
      const url = `${CONFIG.API_URL}${endpoint}${queryString}`;
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('파일 다운로드 중 오류가 발생했습니다.');
        }
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      } catch (error) {
        console.error('파일 다운로드 오류:', error);
        throw error;
      }
    },
    
    // === API 엔드포인트 ===
    
    // 사용자 API
    user: {
      // 토큰 검증
      verify() {
        return API.get('/user/verify');
      },
      
      // 사용자 생성
      create(userData) {
        return API.post('/user/create', userData);
      },
      
      // 다수 사용자 생성
      bulkCreate(userDataList) {
        return API.post('/user/bulk-create', { users: userDataList });
      },
      
      // 사용자 목록 조회
      list(params = {}) {
        return API.get('/users', params);
      },
      
      // 사용자 정보 수정
      update(userId, userData) {
        return API.put(`/user/${userId}`, userData);
      },
      
      // 사용자 비밀번호 초기화
      resetPassword(userId) {
        return API.put(`/user/${userId}/password-reset`, {});
      },
      
      // 사용자 레벨 변경
      changeLevel(userId, levelId) {
        return API.put(`/user/${userId}/level`, { level_id: levelId });
      },
      
      // 사용자 그룹 변경
      changeGroup(userId, groupId) {
        return API.put(`/user/${userId}/group`, { group_id: groupId });
      }
    },
    
    // 그룹 API
    group: {
      // 그룹 목록 조회
      list(params = {}) {
        return API.get('/groups', params);
      },
      
      // 그룹 정보 조회
      get(groupId) {
        return API.get(`/group/${groupId}`);
      },
      
      // 그룹 생성
      create(groupData) {
        return API.post('/group', groupData);
      },
      
      // 그룹 정보 수정
      update(groupId, groupData) {
        return API.put(`/group/${groupId}`, groupData);
      },
      
      // 그룹 내 사용자 목록 조회
      getUsers(groupId, params = {}) {
        return API.get(`/group/${groupId}/users`, params);
      },
      
      // 그룹 내 사용자 추가
      addUser(groupId, userId) {
        return API.post(`/group/${groupId}/users`, { user_id: userId });
      },
      
      // 그룹 내 사용자 제거
      removeUser(groupId, userId) {
        return API.delete(`/group/${groupId}/users/${userId}`);
      },
      
      // 그룹 통계
      getStats(groupId, params = {}) {
        return API.get(`/stats/group/${groupId}`, params);
      }
    },
    
    // 레벨 API
    level: {
      // 레벨 목록 조회
      list() {
        return API.get('/levels');
      },
      
      // 레벨별 권한 조회
      getPermissions(levelId) {
        return API.get(`/level/${levelId}/permissions`);
      }
    },
    
    // 통계 API
    stats: {
      // 요약 통계
      getSummary() {
        return API.get('/stats/summary');
      },
      
      // 일별 통계
      getDaily(startDate, endDate) {
        return API.get('/stats/daily', { start_date: startDate, end_date: endDate });
      },
      
      // 시간별 통계
      getHourly(date) {
        return API.get('/stats/hourly', { date });
      },
      
      // 그룹별 통계
      getGroupStats(params = {}) {
        return API.get('/stats/groups', params);
      },
      
      // 플레이리스트별 통계
      getPlaylistStats(params = {}) {
        return API.get('/stats/playlists', params);
      },
      
      // 트랙별 통계
      getTrackStats(params = {}) {
        return API.get('/stats/tracks', params);
      },
      
      // 통계 데이터 내보내기
      export(type, period, startDate, endDate) {
        return API.downloadFile('/stats/export', {
          type,
          period,
          start_date: startDate,
          end_date: endDate
        }, `odo_stats_${type}_${startDate}_${endDate}.xlsx`);
      }
    },
    
    // 청취 기록 API
    listening: {
      // 청취 기록 조회
      getHistory(params = {}) {
        return API.get('/listening/history', params);
      },
      
      // 최근 청취 기록 조회
      getRecent(limit = 10) {
        return API.get('/listening/recent', { limit });
      }
    },
    
    // 플레이리스트 API
    playlist: {
      // 플레이리스트 목록 조회
      list(params = {}) {
        return API.get('/playlists', params);
      },
      
      // 추천 플레이리스트 조회
      getRecommended() {
        return API.get('/playlists/recommended');
      },
      
      // 플레이리스트 정보 조회
      get(playlistId) {
        return API.get(`/playlist/${playlistId}`);
      },
      
      // 플레이리스트 생성
      create(playlistData) {
        return API.post('/playlist', playlistData);
      },
      
      // 플레이리스트 정보 수정
      update(playlistId, playlistData) {
        return API.put(`/playlist/${playlistId}`, playlistData);
      },
      
      // 플레이리스트 삭제
      delete(playlistId) {
        return API.delete(`/playlist/${playlistId}`);
      },
      
      // YouTube 플레이리스트 검색
      searchYouTube(query) {
        return API.get('/youtube/search/playlist', { query });
      },
      
      // YouTube 플레이리스트 정보 조회
      getYouTubePlaylist(youtubePlaylistId) {
        return API.get(`/youtube/playlist/${youtubePlaylistId}`);
      },
      
      // YouTube 플레이리스트 동기화
      syncYouTubePlaylist(playlistId) {
        return API.post(`/youtube/playlist/sync/${playlistId}`);
      }
    },
    
    // 트랙 API
    track: {
      // 트랙 정보 조회
      get(trackId) {
        return API.get(`/track/${trackId}`);
      },
      
      // 트랙 목록 조회
      list(params = {}) {
        return API.get('/tracks', params);
      },
      
      // 트랙 승인 확인
      verify(youtubeTrackId) {
        return API.get(`/track/verify/${youtubeTrackId}`);
      }
    },
    
    // 탭 API
    tabs: {
      // 접근 가능한 탭 목록 조회
      getAccessible() {
        return API.get('/tabs');
      }
    }
  };