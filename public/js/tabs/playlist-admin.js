// js/tabs/playlist-admin.js - 플레이리스트 관리 탭
const PlaylistAdminTab = {
    // 초기화
    initialize(container) {
      this.container = container;
      this.currentPage = 1;
      this.totalPages = 1;
      this.pageSize = 10;
      this.currentPlaylist = null;
      
      this.render();
      this.loadPlaylists();
    },
    
    // 렌더링
    render() {
      this.container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h2>플레이리스트 관리</h2>
          <div>
            <button id="search-youtube-btn" class="btn btn-secondary me-2">
              <i class="fab fa-youtube"></i> YouTube 검색
            </button>
            <button id="create-playlist-btn" class="btn btn-primary">
              <i class="fas fa-plus"></i> 새 플레이리스트
            </button>
          </div>
        </div>
        
        <div class="card mb-4">
          <div class="card-body">
            <div class="row">
              <div class="col-md-6 mb-3">
                <div class="input-group">
                  <input type="text" id="playlist-search" class="form-control" placeholder="플레이리스트 이름 검색...">
                  <button class="btn btn-outline-secondary" id="search-btn">
                    <i class="fas fa-search"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="card">
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>썸네일</th>
                    <th>플레이리스트명</th>
                    <th>트랙 수</th>
                    <th>상태</th>
                    <th>생성일</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody id="playlists-list">
                  <tr>
                    <td colspan="7" class="text-center py-4">
                      <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">로딩 중...</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="d-flex justify-content-center py-3">
              <nav id="playlists-pagination"></nav>
            </div>
          </div>
        </div>
        
        <!-- 플레이리스트 생성/수정 모달 -->
        <div class="modal fade" id="playlist-modal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="playlist-modal-title">새 플레이리스트</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <form id="playlist-form">
                  <input type="hidden" id="playlist-id">
                  <div class="mb-3">
                    <label for="playlist-title" class="form-label">플레이리스트명 <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="playlist-title" required>
                  </div>
                  <div class="mb-3">
                    <label for="youtube-playlist-id" class="form-label">YouTube 플레이리스트 ID</label>
                    <div class="input-group">
                      <input type="text" class="form-control" id="youtube-playlist-id" placeholder="PL1234567890">
                      <button class="btn btn-outline-secondary" type="button" id="verify-playlist-btn">
                        확인
                      </button>
                    </div>
                    <div class="form-text">YouTube 플레이리스트의 ID를 입력하세요 (URL에서 list= 다음 부분)</div>
                  </div>
                  <div id="playlist-preview" class="d-none mb-3">
                    <div class="card">
                      <div class="card-body">
                        <div class="d-flex">
                          <div class="me-3">
                            <img id="playlist-thumbnail" src="" width="80" class="img-thumbnail">
                          </div>
                          <div>
                            <h6 id="playlist-title-preview">플레이리스트 제목</h6>
                            <p class="mb-0 text-muted">트랙 수: <span id="playlist-tracks-count">0</span></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="mb-3">
                    <label for="playlist-description" class="form-label">설명</label>
                    <textarea class="form-control" id="playlist-description" rows="3"></textarea>
                  </div>
                  <div class="form-check form-switch mb-3">
                    <input class="form-check-input" type="checkbox" id="playlist-active" checked>
                    <label class="form-check-label" for="playlist-active">활성화</label>
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">취소</button>
                <button type="button" class="btn btn-primary" id="save-playlist-btn">저장</button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 플레이리스트 상세 모달 -->
        <div class="modal fade" id="playlist-detail-modal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="playlist-detail-title">플레이리스트 상세 정보</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body" id="playlist-detail-content">
                <div class="d-flex justify-content-center">
                  <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">로딩 중...</span>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">닫기</button>
                <div class="dropdown d-inline-block me-2">
                  <button class="btn btn-outline-primary dropdown-toggle" type="button" id="playlistActionDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                    작업
                  </button>
                  <ul class="dropdown-menu" aria-labelledby="playlistActionDropdown">
                    <li><a class="dropdown-item" href="#" id="sync-playlist-btn">YouTube 동기화</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item text-danger" href="#" id="delete-playlist-btn">삭제</a></li>
                  </ul>
                </div>
                <button type="button" class="btn btn-primary" id="edit-playlist-btn">수정</button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- YouTube 플레이리스트 검색 모달 -->
        <div class="modal fade" id="youtube-search-modal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">YouTube 플레이리스트 검색</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <div class="input-group mb-3">
                  <input type="text" class="form-control" id="youtube-search-input" placeholder="검색어 입력...">
                  <button class="btn btn-primary" type="button" id="youtube-search-submit-btn">
                    <i class="fas fa-search"></i> 검색
                  </button>
                </div>
                
                <div id="youtube-search-results" class="mt-3">
                  <!-- 검색 결과가 여기에 표시됩니다 -->
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">닫기</button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // 이벤트 리스너 등록
      this.container.querySelector('#create-playlist-btn').addEventListener('click', () => this.showCreatePlaylistModal());
      this.container.querySelector('#save-playlist-btn').addEventListener('click', () => this.savePlaylist());
      this.container.querySelector('#verify-playlist-btn').addEventListener('click', () => this.verifyYouTubePlaylist());
      this.container.querySelector('#search-btn').addEventListener('click', () => this.searchPlaylists());
      this.container.querySelector('#playlist-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.searchPlaylists();
      });
      this.container.querySelector('#edit-playlist-btn').addEventListener('click', () => {
        if (this.currentPlaylist) {
          this.showEditPlaylistModal(this.currentPlaylist);
        }
      });
      this.container.querySelector('#delete-playlist-btn').addEventListener('click', () => {
        if (this.currentPlaylist) {
          this.deletePlaylist(this.currentPlaylist.id);
        }
      });
      this.container.querySelector('#sync-playlist-btn').addEventListener('click', () => {
        if (this.currentPlaylist) {
          this.syncYouTubePlaylist(this.currentPlaylist.id);
        }
      });
      this.container.querySelector('#search-youtube-btn').addEventListener('click', () => this.showYouTubeSearchModal());
      this.container.querySelector('#youtube-search-submit-btn').addEventListener('click', () => this.searchYouTubePlaylists());
      this.container.querySelector('#youtube-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.searchYouTubePlaylists();
      });
    },
    
    // 플레이리스트 목록 로드
    async loadPlaylists(page = 1, search = '') {
      try {
        this.currentPage = page;
        const searchInput = this.container.querySelector('#playlist-search');
        const searchTerm = search || searchInput.value || '';
        
        // 로딩 표시
        this.container.querySelector('#playlists-list').innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-4">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">로딩 중...</span>
              </div>
            </td>
          </tr>
        `;
        
        // 플레이리스트 목록 가져오기
        const response = await API.playlist.list({
          page: this.currentPage,
          limit: this.pageSize,
          search: searchTerm
        });
        
        this.renderPlaylistsList(response.playlists);
        
        // 페이지네이션 업데이트
        this.totalPages = response.pagination.total_pages;
        this.renderPagination();
      } catch (error) {
        console.error('플레이리스트 목록 로드 오류:', error);
        UTILS.showAlert('플레이리스트 목록을 불러오는 중 오류가 발생했습니다.', 'danger');
        
        this.container.querySelector('#playlists-list').innerHTML = `
          <tr>
            <td colspan="7" class="text-center text-danger py-4">
              데이터를 불러오는 중 오류가 발생했습니다.
            </td>
          </tr>
        `;
      }
    },
    
    // 플레이리스트 목록 렌더링
    renderPlaylistsList(playlists) {
      const tbody = this.container.querySelector('#playlists-list');
      
      if (!playlists || playlists.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-4">
              플레이리스트가 없습니다.
            </td>
          </tr>
        `;
        return;
      }
      
      tbody.innerHTML = '';
      
      playlists.forEach(playlist => {
        const row = document.createElement('tr');
        
        // 생성일 포맷팅
        const createdAt = new Date(playlist.created_at).toLocaleDateString();
        
        // 썸네일 처리
        const thumbnail = playlist.thumbnail_url ? 
          `<img src="${playlist.thumbnail_url}" width="40" height="40" class="img-thumbnail">` : 
          `<div class="bg-light text-center" style="width: 40px; height: 40px;"><i class="fas fa-music"></i></div>`;
        
        row.innerHTML = `
          <td>${playlist.id}</td>
          <td>${thumbnail}</td>
          <td>${playlist.title}</td>
          <td>${playlist.item_count || 0}</td>
          <td>
            <span class="badge bg-${playlist.is_active !== false ? 'success' : 'secondary'}">
              ${playlist.is_active !== false ? '활성' : '비활성'}
            </span>
          </td>
          <td>${createdAt}</td>
          <td>
            <button class="btn btn-sm btn-info view-btn" data-id="${playlist.id}">
              <i class="fas fa-eye"></i>
            </button>
<button class="btn btn-sm btn-primary edit-btn" data-id="${playlist.id}">
            <i class="fas fa-edit"></i>
          </button>
        </td>
      `;
      
      // 상세 보기 버튼 이벤트
      row.querySelector('.view-btn').addEventListener('click', () => this.viewPlaylistDetails(playlist.id));
      
      // 수정 버튼 이벤트
      row.querySelector('.edit-btn').addEventListener('click', () => this.editPlaylist(playlist.id));
      
      tbody.appendChild(row);
    });
  },
  
  // 페이지네이션 렌더링
  renderPagination() {
    const paginationContainer = this.container.querySelector('#playlists-pagination');
    
    UTILS.renderPagination(
      paginationContainer,
      this.currentPage,
      this.totalPages,
      (page) => {
        this.loadPlaylists(page);
      }
    );
  },
  
  // 플레이리스트 검색
  searchPlaylists() {
    const searchInput = this.container.querySelector('#playlist-search');
    this.loadPlaylists(1, searchInput.value);
  },
  
  // 새 플레이리스트 모달 표시
  showCreatePlaylistModal() {
    // 모달 초기화
    const modal = this.container.querySelector('#playlist-modal');
    const form = this.container.querySelector('#playlist-form');
    form.reset();
    
    // 플레이리스트 미리보기 숨기기
    this.container.querySelector('#playlist-preview').classList.add('d-none');
    
    // 모달 제목 설정
    this.container.querySelector('#playlist-modal-title').textContent = '새 플레이리스트 생성';
    
    // 플레이리스트 ID 초기화
    this.container.querySelector('#playlist-id').value = '';
    
    // 활성화 상태 기본값 설정
    this.container.querySelector('#playlist-active').checked = true;
    
    // 모달 표시
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
  },
  
  // YouTube 플레이리스트 유효성 확인
  async verifyYouTubePlaylist() {
    try {
      const youtubeId = this.container.querySelector('#youtube-playlist-id').value.trim();
      
      if (!youtubeId) {
        UTILS.showAlert('YouTube 플레이리스트 ID를 입력하세요.', 'warning');
        return;
      }
      
      // 버튼 상태 업데이트
      const verifyButton = this.container.querySelector('#verify-playlist-btn');
      const originalText = verifyButton.textContent;
      verifyButton.disabled = true;
      verifyButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 확인 중...';
      
      // 플레이리스트 정보 가져오기
      const response = await API.playlist.getYouTubePlaylist(youtubeId);
      
      // 버튼 상태 복원
      verifyButton.disabled = false;
      verifyButton.textContent = originalText;
      
      if (!response || !response.playlist) {
        UTILS.showAlert('플레이리스트 정보를 가져올 수 없습니다.', 'danger');
        return;
      }
      
      const playlist = response.playlist;
      
      // 플레이리스트 미리보기 업데이트
      this.container.querySelector('#playlist-thumbnail').src = playlist.thumbnail_url || '';
      this.container.querySelector('#playlist-title-preview').textContent = playlist.title;
      this.container.querySelector('#playlist-tracks-count').textContent = playlist.tracks?.length || 0;
      
      // 미리보기 표시
      this.container.querySelector('#playlist-preview').classList.remove('d-none');
      
      // 플레이리스트 제목 자동 입력 (비어있는 경우)
      if (!this.container.querySelector('#playlist-title').value) {
        this.container.querySelector('#playlist-title').value = playlist.title;
      }
      
      UTILS.showAlert('YouTube 플레이리스트가 확인되었습니다.', 'success');
    } catch (error) {
      console.error('YouTube 플레이리스트 확인 오류:', error);
      UTILS.showAlert('YouTube 플레이리스트 확인 중 오류가 발생했습니다.', 'danger');
      
      // 버튼 상태 복원
      const verifyButton = this.container.querySelector('#verify-playlist-btn');
      verifyButton.disabled = false;
      verifyButton.textContent = '확인';
    }
  },
  
  // 플레이리스트 수정 모달 표시
  async editPlaylist(playlistId) {
    try {
      // 플레이리스트 정보 로드
      const response = await API.playlist.get(playlistId);
      
      if (!response || !response.playlist) {
        UTILS.showAlert('플레이리스트 정보를 불러올 수 없습니다.', 'danger');
        return;
      }
      
      this.showEditPlaylistModal(response.playlist);
    } catch (error) {
      console.error('플레이리스트 정보 로드 오류:', error);
      UTILS.showAlert('플레이리스트 정보를 불러오는 중 오류가 발생했습니다.', 'danger');
    }
  },
  
  // 플레이리스트 수정 모달 표시
  showEditPlaylistModal(playlist) {
    // 모달 초기화
    const modal = this.container.querySelector('#playlist-modal');
    const form = this.container.querySelector('#playlist-form');
    form.reset();
    
    // 플레이리스트 정보 설정
    this.container.querySelector('#playlist-id').value = playlist.id;
    this.container.querySelector('#playlist-title').value = playlist.title;
    this.container.querySelector('#playlist-description').value = playlist.description || '';
    this.container.querySelector('#youtube-playlist-id').value = playlist.youtube_playlist_id || '';
    this.container.querySelector('#playlist-active').checked = playlist.is_active !== false;
    
    // 플레이리스트 미리보기 업데이트 (YouTube ID가 있는 경우)
    if (playlist.youtube_playlist_id) {
      this.container.querySelector('#playlist-thumbnail').src = playlist.thumbnail_url || '';
      this.container.querySelector('#playlist-title-preview').textContent = playlist.title;
      this.container.querySelector('#playlist-tracks-count').textContent = playlist.item_count || 0;
      this.container.querySelector('#playlist-preview').classList.remove('d-none');
    } else {
      this.container.querySelector('#playlist-preview').classList.add('d-none');
    }
    
    // 모달 제목 설정
    this.container.querySelector('#playlist-modal-title').textContent = '플레이리스트 수정';
    
    // 모달 표시
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
  },
  
  // 플레이리스트 저장
  async savePlaylist() {
    try {
      // 폼 데이터 가져오기
      const playlistId = this.container.querySelector('#playlist-id').value;
      const title = this.container.querySelector('#playlist-title').value;
      const description = this.container.querySelector('#playlist-description').value;
      const youtubePlaylistId = this.container.querySelector('#youtube-playlist-id').value.trim();
      const isActive = this.container.querySelector('#playlist-active').checked;
      
      // 필수 필드 검증
      if (!title) {
        UTILS.showAlert('플레이리스트 제목은 필수 항목입니다.', 'danger');
        return;
      }
      
      // 플레이리스트 데이터 준비
      const playlistData = {
        title,
        description,
        youtube_playlist_id: youtubePlaylistId || null,
        is_active: isActive
      };
      
      // 저장 버튼 비활성화
      const saveButton = this.container.querySelector('#save-playlist-btn');
      const originalText = saveButton.textContent;
      saveButton.disabled = true;
      saveButton.textContent = '저장 중...';
      
      let response;
      
      if (playlistId) {
        // 플레이리스트 수정
        response = await API.playlist.update(playlistId, playlistData);
      } else {
        // 새 플레이리스트 생성
        response = await API.playlist.create(playlistData);
      }
      
      // 저장 버튼 복원
      saveButton.disabled = false;
      saveButton.textContent = originalText;
      
      if (response && (response.playlist || response.message)) {
        // 모달 닫기
        const modal = this.container.querySelector('#playlist-modal');
        bootstrap.Modal.getInstance(modal).hide();
        
        // 알림 표시
        UTILS.showAlert(
          playlistId ? '플레이리스트가 성공적으로 수정되었습니다.' : '새 플레이리스트가 생성되었습니다.',
          'success'
        );
        
        // 플레이리스트 목록 다시 로드
        this.loadPlaylists(this.currentPage);
        
        // YouTube 플레이리스트가 있는 경우 동기화 제안
        if (youtubePlaylistId && !playlistId) {
          if (confirm('YouTube 플레이리스트를 지금 동기화하시겠습니까?')) {
            const newPlaylistId = response.playlist?.id;
            if (newPlaylistId) {
              this.syncYouTubePlaylist(newPlaylistId);
            }
          }
        }
      } else {
        UTILS.showAlert('플레이리스트 저장 중 오류가 발생했습니다.', 'danger');
      }
    } catch (error) {
      console.error('플레이리스트 저장 오류:', error);
      UTILS.showAlert(error.message || '플레이리스트 저장 중 오류가 발생했습니다.', 'danger');
      
      // 저장 버튼 복원
      const saveButton = this.container.querySelector('#save-playlist-btn');
      saveButton.disabled = false;
      saveButton.textContent = '저장';
    }
  },
  
  // 플레이리스트 상세 정보 보기
  async viewPlaylistDetails(playlistId) {
    try {
      // 로딩 표시
      this.container.querySelector('#playlist-detail-content').innerHTML = `
        <div class="d-flex justify-content-center">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">로딩 중...</span>
          </div>
        </div>
      `;
      
      // 모달 표시
      const modal = this.container.querySelector('#playlist-detail-modal');
      const modalInstance = new bootstrap.Modal(modal);
      modalInstance.show();
      
      // 플레이리스트 정보 로드
      const response = await API.playlist.get(playlistId);
      
      if (!response || !response.playlist) {
        this.container.querySelector('#playlist-detail-content').innerHTML = `
          <div class="alert alert-danger">
            플레이리스트 정보를 불러올 수 없습니다.
          </div>
        `;
        return;
      }
      
      const playlist = response.playlist;
      this.currentPlaylist = playlist;
      
      // 플레이리스트 정보 렌더링
      this.container.querySelector('#playlist-detail-title').textContent = `플레이리스트: ${playlist.title}`;
      
      // 생성일, 업데이트일 포맷팅
      const createdAt = new Date(playlist.created_at).toLocaleString();
      const updatedAt = playlist.updated_at ? new Date(playlist.updated_at).toLocaleString() : '-';
      
      // 트랙 목록
      const tracks = playlist.tracks || [];
      
      // 플레이리스트 상세 정보 렌더링
      this.container.querySelector('#playlist-detail-content').innerHTML = `
        <div class="row mb-4">
          <div class="col-md-4">
            <div class="text-center mb-3">
              ${playlist.thumbnail_url ? 
                `<img src="${playlist.thumbnail_url}" class="img-fluid rounded" style="max-width: 200px;">` : 
                `<div class="bg-light text-center p-5 rounded"><i class="fas fa-music fa-3x text-muted"></i></div>`
              }
            </div>
          </div>
          <div class="col-md-8">
            <h5>${playlist.title}</h5>
            <p class="text-muted">${playlist.description || '설명 없음'}</p>
            
            <table class="table table-sm">
              <tr>
                <th width="120">ID</th>
                <td>${playlist.id}</td>
              </tr>
              <tr>
                <th>YouTube ID</th>
                <td>${playlist.youtube_playlist_id || '-'}</td>
              </tr>
              <tr>
                <th>트랙 수</th>
                <td>${tracks.length}</td>
              </tr>
              <tr>
                <th>생성일</th>
                <td>${createdAt}</td>
              </tr>
              <tr>
                <th>마지막 업데이트</th>
                <td>${updatedAt}</td>
              </tr>
              <tr>
                <th>상태</th>
                <td>
                  <span class="badge bg-${playlist.is_active !== false ? 'success' : 'secondary'}">
                    ${playlist.is_active !== false ? '활성' : '비활성'}
                  </span>
                </td>
              </tr>
            </table>
          </div>
        </div>
        
        <div class="row">
          <div class="col-12">
            <h6>트랙 목록 (${tracks.length}개)</h6>
            ${tracks.length === 0 ? '<p class="text-muted">트랙이 없습니다.</p>' : ''}
            ${tracks.length > 0 ? `
              <div class="table-responsive">
                <table class="table table-sm table-hover">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>썸네일</th>
                      <th>제목</th>
                      <th>아티스트</th>
                      <th>재생 시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tracks.map((track, index) => `
                      <tr>
                        <td>${index + 1}</td>
                        <td>
                          ${track.thumbnail_url ? 
                            `<img src="${track.thumbnail_url}" width="40" height="40" class="img-thumbnail">` : 
                            `<div class="bg-light text-center" style="width: 40px; height: 40px;"><i class="fas fa-music"></i></div>`
                          }
                        </td>
                        <td>${track.title}</td>
                        <td>${track.artist || '-'}</td>
                        <td>${formatTime(track.duration_seconds)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } catch (error) {
      console.error('플레이리스트 상세 정보 로드 오류:', error);
      
      this.container.querySelector('#playlist-detail-content').innerHTML = `
        <div class="alert alert-danger">
          플레이리스트 상세 정보를 불러오는 중 오류가 발생했습니다.
        </div>
      `;
    }
  },
  
  // YouTube 플레이리스트 동기화
  async syncYouTubePlaylist(playlistId) {
    try {
      if (!confirm('이 플레이리스트를 YouTube와 동기화하시겠습니까?\n기존 트랙 목록이 덮어쓰기 됩니다.')) {
        return;
      }
      
      UTILS.showLoading();
      
      // 동기화 요청
      const response = await API.playlist.syncYouTubePlaylist(playlistId);
      
      UTILS.hideLoading();
      
      if (response && response.message) {
        UTILS.showAlert('플레이리스트가 성공적으로 동기화되었습니다.', 'success');
        
        // 상세 모달이 열려있으면 새로고침
        if (this.currentPlaylist && this.currentPlaylist.id === playlistId) {
          this.viewPlaylistDetails(playlistId);
        }
        
        // 목록 새로고침
        this.loadPlaylists(this.currentPage);
      } else {
        UTILS.showAlert('플레이리스트 동기화 중 오류가 발생했습니다.', 'danger');
      }
    } catch (error) {
      console.error('YouTube 플레이리스트 동기화 오류:', error);
      UTILS.showAlert('YouTube 플레이리스트 동기화 중 오류가 발생했습니다.', 'danger');
      UTILS.hideLoading();
    }
  },
  
  // 플레이리스트 삭제
  async deletePlaylist(playlistId) {
    try {
      if (!confirm('정말 이 플레이리스트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
        return;
      }
      
      // 삭제 요청
      const response = await API.playlist.delete(playlistId);
      
      if (response && response.message) {
        // 상세 모달 닫기
        const modal = this.container.querySelector('#playlist-detail-modal');
        bootstrap.Modal.getInstance(modal).hide();
        
        UTILS.showAlert('플레이리스트가 성공적으로 삭제되었습니다.', 'success');
        
        // 목록 새로고침
        this.loadPlaylists(this.currentPage);
      } else {
        UTILS.showAlert('플레이리스트 삭제 중 오류가 발생했습니다.', 'danger');
      }
    } catch (error) {
      console.error('플레이리스트 삭제 오류:', error);
      UTILS.showAlert('플레이리스트 삭제 중 오류가 발생했습니다.', 'danger');
    }
  },
  
  // YouTube 검색 모달 표시
  showYouTubeSearchModal() {
    // 모달 초기화
    const modal = this.container.querySelector('#youtube-search-modal');
    this.container.querySelector('#youtube-search-input').value = '';
    this.container.querySelector('#youtube-search-results').innerHTML = '';
    
    // 모달 표시
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
  },
  
  // YouTube 플레이리스트 검색
  async searchYouTubePlaylists() {
    try {
      const searchQuery = this.container.querySelector('#youtube-search-input').value.trim();
      
      if (!searchQuery) {
        UTILS.showAlert('검색어를 입력하세요.', 'warning');
        return;
      }
      
      // 검색 결과 영역 초기화
      const resultsContainer = this.container.querySelector('#youtube-search-results');
      resultsContainer.innerHTML = `
        <div class="d-flex justify-content-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">로딩 중...</span>
          </div>
        </div>
      `;
      
      // 검색 요청
      const response = await API.playlist.searchYouTube(searchQuery);
      
      if (!response || !response.playlists || response.playlists.length === 0) {
        resultsContainer.innerHTML = `
          <div class="alert alert-info">
            검색 결과가 없습니다.
          </div>
        `;
        return;
      }
      
      // 검색 결과 렌더링
      resultsContainer.innerHTML = `
        <div class="row">
          ${response.playlists.map(playlist => `
            <div class="col-md-6 mb-3">
              <div class="card">
                <div class="card-body">
                  <div class="d-flex">
                    <div class="me-3">
                      ${playlist.thumbnail_url ? 
                        `<img src="${playlist.thumbnail_url}" width="80" class="img-thumbnail">` : 
                        `<div class="bg-light text-center p-3 rounded"><i class="fas fa-music fa-2x text-muted"></i></div>`
                      }
                    </div>
                    <div>
                      <h6 class="card-title">${playlist.title}</h6>
                      <p class="card-text text-muted">트랙 수: ${playlist.item_count || 0}</p>
                    </div>
                  </div>
                </div>
                <div class="card-footer d-flex justify-content-end">
                  <button class="btn btn-sm btn-primary import-playlist-btn" data-id="${playlist.id}">
                    <i class="fas fa-plus"></i> 가져오기
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      
      // 가져오기 버튼 이벤트 등록
      const importButtons = resultsContainer.querySelectorAll('.import-playlist-btn');
      importButtons.forEach(button => {
        button.addEventListener('click', () => {
          const youtubeId = button.dataset.id;
          this.importYouTubePlaylist(youtubeId);
        });
      });
    } catch (error) {
      console.error('YouTube 플레이리스트 검색 오류:', error);
      
      const resultsContainer = this.container.querySelector('#youtube-search-results');
      resultsContainer.innerHTML = `
        <div class="alert alert-danger">
          검색 중 오류가 발생했습니다.
        </div>
      `;
    }
  },
  
  // YouTube 플레이리스트 가져오기
  async importYouTubePlaylist(youtubeId) {
    try {
      // YouTube 검색 모달 닫기
      const searchModal = this.container.querySelector('#youtube-search-modal');
      bootstrap.Modal.getInstance(searchModal).hide();
      
      // 플레이리스트 정보 가져오기
      const response = await API.playlist.getYouTubePlaylist(youtubeId);
      
      if (!response || !response.playlist) {
        UTILS.showAlert('플레이리스트 정보를 가져올 수 없습니다.', 'danger');
        return;
      }
      
      const playlist = response.playlist;
      
      // 플레이리스트 생성 모달 표시
      this.showCreatePlaylistModal();
      
      // 정보 미리 채우기
      this.container.querySelector('#playlist-title').value = playlist.title;
      this.container.querySelector('#youtube-playlist-id').value = playlist.youtube_playlist_id;
      
      // 설명이 있으면 채우기
      if (playlist.description) {
        this.container.querySelector('#playlist-description').value = playlist.description;
      }
      
      // 미리보기 업데이트
      this.container.querySelector('#playlist-thumbnail').src = playlist.thumbnail_url || '';
      this.container.querySelector('#playlist-title-preview').textContent = playlist.title;
      this.container.querySelector('#playlist-tracks-count').textContent = playlist.tracks?.length || 0;
      
      // 미리보기 표시
      this.container.querySelector('#playlist-preview').classList.remove('d-none');
    } catch (error) {
      console.error('YouTube 플레이리스트 가져오기 오류:', error);
      UTILS.showAlert('YouTube 플레이리스트 가져오기 중 오류가 발생했습니다.', 'danger');
    }
  }
};

// 초 -> MM:SS 형식으로 변환
function formatTime(seconds) {
  if (!seconds) return '00:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}