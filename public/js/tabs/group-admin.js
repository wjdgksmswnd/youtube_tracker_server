// js/tabs/group-admin.js - 그룹 관리 탭
const GroupAdminTab = {
    // 초기화
    initialize(container) {
      this.container = container;
      this.currentPage = 1;
      this.totalPages = 1;
      this.pageSize = 10;
      this.currentGroup = null;
      
      this.render();
      this.loadGroups();
    },
    
    // 렌더링
    render() {
      this.container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h2>그룹 관리</h2>
          <button id="create-group-btn" class="btn btn-primary">
            <i class="fas fa-plus"></i> 새 그룹 생성
          </button>
        </div>
        
        <div class="card mb-4">
          <div class="card-body">
            <div class="row">
              <div class="col-md-6 mb-3">
                <div class="input-group">
                  <input type="text" id="group-search" class="form-control" placeholder="그룹 이름 검색...">
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
                    <th>그룹명</th>
                    <th>사용자 수</th>
                    <th>월간 목표</th>
                    <th>생성일</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody id="groups-list">
                  <tr>
                    <td colspan="6" class="text-center py-4">
                      <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">로딩 중...</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="d-flex justify-content-center py-3">
              <nav id="groups-pagination"></nav>
            </div>
          </div>
        </div>
        
        <!-- 그룹 생성/수정 모달 -->
        <div class="modal fade" id="group-modal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="group-modal-title">새 그룹 생성</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <form id="group-form">
                  <input type="hidden" id="group-id">
                  <div class="row mb-3">
                    <div class="col-md-6">
                      <label for="group-name" class="form-label">그룹명 <span class="text-danger">*</span></label>
                      <input type="text" class="form-control" id="group-name" required>
                    </div>
                    <div class="col-md-6">
                      <label for="max-users" class="form-label">최대 사용자 수</label>
                      <input type="number" class="form-control" id="max-users" min="1">
                    </div>
                  </div>
                  
                  <div class="mb-3">
                    <label for="group-description" class="form-label">설명</label>
                    <textarea class="form-control" id="group-description" rows="2"></textarea>
                  </div>
                  
                  <div class="row mb-3">
                    <div class="col-md-6">
                      <label for="daily-goal" class="form-label">일일 목표 (분)</label>
                      <input type="number" class="form-control" id="daily-goal" min="1" max="1440" value="60">
                    </div>
                    <div class="col-md-6">
                      <label for="monthly-goal" class="form-label">월간 목표 (분)</label>
                      <input type="number" class="form-control" id="monthly-goal" min="1" value="1200">
                    </div>
                  </div>
                  
                  <div class="row mb-3">
                    <div class="col-md-6">
                      <label for="daily-max" class="form-label">일일 최대 인정 시간 (분)</label>
                      <input type="number" class="form-control" id="daily-max" min="1" max="1440" value="120">
                    </div>
                    <div class="col-md-6">
                      <label for="monthly-min" class="form-label">월간 최소 필요 시간 (분)</label>
                      <input type="number" class="form-control" id="monthly-min" min="1" value="600">
                    </div>
                  </div>
                  
                  <div class="row mb-3">
                    <div class="col-md-6">
                      <label for="contact-name" class="form-label">담당자 이름</label>
                      <input type="text" class="form-control" id="contact-name">
                    </div>
                    <div class="col-md-6">
                      <label for="contact-email" class="form-label">담당자 이메일</label>
                      <input type="email" class="form-control" id="contact-email">
                    </div>
                  </div>
                  
                  <div class="mb-3">
                    <label for="expire-date" class="form-label">만료일</label>
                    <input type="date" class="form-control" id="expire-date">
                  </div>
                  
                  <div class="form-check form-switch mb-3">
                    <input class="form-check-input" type="checkbox" id="is-active" checked>
                    <label class="form-check-label" for="is-active">활성화</label>
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">취소</button>
                <button type="button" class="btn btn-primary" id="save-group-btn">저장</button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 그룹 상세 모달 -->
        <div class="modal fade" id="group-detail-modal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="group-detail-title">그룹 상세 정보</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body" id="group-detail-content">
                <div class="d-flex justify-content-center">
                  <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">로딩 중...</span>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">닫기</button>
                <button type="button" class="btn btn-primary" id="edit-group-btn">수정</button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // 이벤트 리스너 등록
      this.container.querySelector('#create-group-btn').addEventListener('click', () => this.showCreateGroupModal());
      this.container.querySelector('#save-group-btn').addEventListener('click', () => this.saveGroup());
      this.container.querySelector('#search-btn').addEventListener('click', () => this.searchGroups());
      this.container.querySelector('#group-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.searchGroups();
      });
      this.container.querySelector('#edit-group-btn').addEventListener('click', () => {
        if (this.currentGroup) {
          this.showEditGroupModal(this.currentGroup);
        }
      });
    },
    
    // 그룹 목록 로드
    async loadGroups(page = 1, search = '') {
      try {
        this.currentPage = page;
        const searchInput = this.container.querySelector('#group-search');
        const searchTerm = search || searchInput.value || '';
        
        // 로딩 표시
        this.container.querySelector('#groups-list').innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-4">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">로딩 중...</span>
              </div>
            </td>
          </tr>
        `;
        
        // 그룹 목록 가져오기
        const response = await API.group.list({
          page: this.currentPage,
          limit: this.pageSize,
          search: searchTerm
        });
        
        this.renderGroupsList(response.groups);
        
        // 페이지네이션 업데이트
        this.totalPages = response.pagination.total_pages;
        this.renderPagination();
      } catch (error) {
        console.error('그룹 목록 로드 오류:', error);
        UTILS.showAlert('그룹 목록을 불러오는 중 오류가 발생했습니다.', 'danger');
        
        this.container.querySelector('#groups-list').innerHTML = `
          <tr>
            <td colspan="6" class="text-center text-danger py-4">
              데이터를 불러오는 중 오류가 발생했습니다.
            </td>
          </tr>
        `;
      }
    },
    
    // 그룹 목록 렌더링
    renderGroupsList(groups) {
      const tbody = this.container.querySelector('#groups-list');
      
      if (!groups || groups.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-4">
              그룹이 없습니다.
            </td>
          </tr>
        `;
        return;
      }
      
      tbody.innerHTML = '';
      
      groups.forEach(group => {
        const row = document.createElement('tr');
        
        // 생성일 포맷팅
        const createdAt = new Date(group.created_datetime).toLocaleDateString();
        
        row.innerHTML = `
          <td>${group.id}</td>
          <td>${group.group_name}</td>
          <td>${group.user_count || 0}명</td>
          <td>${group.monthly_goal_minutes || 0}분</td>
          <td>${createdAt}</td>
          <td>
            <button class="btn btn-sm btn-info view-btn" data-id="${group.id}">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-sm btn-primary edit-btn" data-id="${group.id}">
              <i class="fas fa-edit"></i>
            </button>
          </td>
        `;
        
        // 상세 보기 버튼 이벤트
        row.querySelector('.view-btn').addEventListener('click', () => this.viewGroupDetails(group.id));
        
        // 수정 버튼 이벤트
        row.querySelector('.edit-btn').addEventListener('click', () => this.editGroup(group.id));
        
        tbody.appendChild(row);
      });
    },
    
    // 페이지네이션 렌더링
    renderPagination() {
      const paginationContainer = this.container.querySelector('#groups-pagination');
      
      UTILS.renderPagination(
        paginationContainer,
        this.currentPage,
        this.totalPages,
        (page) => {
          this.loadGroups(page);
        }
      );
    },
    
    // 그룹 검색
    searchGroups() {
      const searchInput = this.container.querySelector('#group-search');
      this.loadGroups(1, searchInput.value);
    },
    
    // 새 그룹 생성 모달 표시
    showCreateGroupModal() {
      // 모달 초기화
      const modal = this.container.querySelector('#group-modal');
      const form = this.container.querySelector('#group-form');
      form.reset();
      
      // 기본값 설정
      this.container.querySelector('#daily-goal').value = 60;
      this.container.querySelector('#monthly-goal').value = 1200;
      this.container.querySelector('#daily-max').value = 120;
      this.container.querySelector('#monthly-min').value = 600;
      this.container.querySelector('#is-active').checked = true;
      
      // 모달 제목 설정
      this.container.querySelector('#group-modal-title').textContent = '새 그룹 생성';
      
      // 그룹 ID 초기화
      this.container.querySelector('#group-id').value = '';
      
      // 모달 표시
      const modalInstance = new bootstrap.Modal(modal);
      modalInstance.show();
    },
    
    // 그룹 수정 모달 표시
    async editGroup(groupId) {
      try {
        // 그룹 정보 로드
        const group = await API.group.get(groupId);
        
        if (!group || !group.group) {
          UTILS.showAlert('그룹 정보를 불러올 수 없습니다.', 'danger');
          return;
        }
        
        this.showEditGroupModal(group.group);
      } catch (error) {
        console.error('그룹 정보 로드 오류:', error);
        UTILS.showAlert('그룹 정보를 불러오는 중 오류가 발생했습니다.', 'danger');
      }
    },
    
    // 그룹 수정 모달 표시
    showEditGroupModal(group) {
      // 모달 초기화
      const modal = this.container.querySelector('#group-modal');
      const form = this.container.querySelector('#group-form');
      form.reset();
      
      // 그룹 정보 설정
      this.container.querySelector('#group-id').value = group.id;
      this.container.querySelector('#group-name').value = group.group_name;
      this.container.querySelector('#group-description').value = group.description || '';
      this.container.querySelector('#daily-goal').value = group.daily_goal_minutes || 60;
      this.container.querySelector('#monthly-goal').value = group.monthly_goal_minutes || 1200;
      this.container.querySelector('#daily-max').value = group.daily_max_minutes || 120;
      this.container.querySelector('#monthly-min').value = group.monthly_min_minutes || 600;
      this.container.querySelector('#max-users').value = group.max_users || '';
      this.container.querySelector('#contact-name').value = group.contact_name || '';
      this.container.querySelector('#contact-email').value = group.contact_email || '';
      this.container.querySelector('#is-active').checked = group.is_active !== false;
      
      // 만료일 설정
      if (group.expire_date) {
        const expireDate = new Date(group.expire_date);
        this.container.querySelector('#expire-date').value = expireDate.toISOString().split('T')[0];
      } else {
        this.container.querySelector('#expire-date').value = '';
      }
      
      // 모달 제목 설정
      this.container.querySelector('#group-modal-title').textContent = '그룹 수정';
      
      // 모달 표시
      const modalInstance = new bootstrap.Modal(modal);
      modalInstance.show();
    },
    
    // 그룹 저장
    async saveGroup() {
      try {
        // 폼 데이터 가져오기
        const groupId = this.container.querySelector('#group-id').value;
        const groupName = this.container.querySelector('#group-name').value;
        const description = this.container.querySelector('#group-description').value;
        const dailyGoal = parseInt(this.container.querySelector('#daily-goal').value) || 60;
        const monthlyGoal = parseInt(this.container.querySelector('#monthly-goal').value) || 1200;
        const dailyMax = parseInt(this.container.querySelector('#daily-max').value) || 120;
        const monthlyMin = parseInt(this.container.querySelector('#monthly-min').value) || 600;
        const maxUsers = this.container.querySelector('#max-users').value 
          ? parseInt(this.container.querySelector('#max-users').value) 
          : null;
        const contactName = this.container.querySelector('#contact-name').value;
        const contactEmail = this.container.querySelector('#contact-email').value;
        const expireDate = this.container.querySelector('#expire-date').value;
        const isActive = this.container.querySelector('#is-active').checked;
        
        // 필수 필드 검증
        if (!groupName) {
          UTILS.showAlert('그룹명은 필수 입력 항목입니다.', 'danger');
          return;
        }
        
        // 그룹 데이터 준비
        const groupData = {
          group_name: groupName,
          description,
          daily_goal_minutes: dailyGoal,
          monthly_goal_minutes: monthlyGoal,
          daily_max_minutes: dailyMax,
          monthly_min_minutes: monthlyMin,
          max_users: maxUsers,
          contact_name: contactName,
          contact_email: contactEmail,
          expire_date: expireDate || null,
          is_active: isActive
        };
        
        // 저장 버튼 비활성화
        const saveButton = this.container.querySelector('#save-group-btn');
        const originalText = saveButton.textContent;
        saveButton.disabled = true;
        saveButton.textContent = '저장 중...';
        
        let response;
        
        if (groupId) {
          // 그룹 수정
          response = await API.group.update(groupId, groupData);
        } else {
          // 새 그룹 생성
          response = await API.group.create(groupData);
        }
        
        // 저장 버튼 복원
        saveButton.disabled = false;
        saveButton.textContent = originalText;
        
        if (response && (response.group || response.message)) {
          // 모달 닫기
          const modal = this.container.querySelector('#group-modal');
          bootstrap.Modal.getInstance(modal).hide();
          
          // 알림 표시
          UTILS.showAlert(
            groupId ? '그룹이 성공적으로 수정되었습니다.' : '새 그룹이 생성되었습니다.',
            'success'
          );
          
          // 그룹 목록 다시 로드
          this.loadGroups(this.currentPage);
        } else {
          UTILS.showAlert('그룹 저장 중 오류가 발생했습니다.', 'danger');
        }
      } catch (error) {
        console.error('그룹 저장 오류:', error);
        UTILS.showAlert(error.message || '그룹 저장 중 오류가 발생했습니다.', 'danger');
        
        // 저장 버튼 복원
        const saveButton = this.container.querySelector('#save-group-btn');
        saveButton.disabled = false;
        saveButton.textContent = '저장';
      }
    },
    
    // 그룹 상세 정보 보기
    async viewGroupDetails(groupId) {
      try {
        // 로딩 표시
        this.container.querySelector('#group-detail-content').innerHTML = `
          <div class="d-flex justify-content-center">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">로딩 중...</span>
            </div>
          </div>
        `;
        
        // 모달 표시
        const modal = this.container.querySelector('#group-detail-modal');
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
        
        // 그룹 정보 로드
        const response = await API.group.get(groupId);
        
        if (!response || !response.group) {
          this.container.querySelector('#group-detail-content').innerHTML = `
            <div class="alert alert-danger">
              그룹 정보를 불러올 수 없습니다.
            </div>
          `;
          return;
        }
        
        const group = response.group;
        this.currentGroup = group;
        
        // 그룹 정보 렌더링
        this.container.querySelector('#group-detail-title').textContent = `그룹 상세 정보: ${group.group_name}`;
        
        // 생성일, 업데이트일 포맷팅
        const createdAt = new Date(group.created_at).toLocaleString();
        const updatedAt = group.updated_at ? new Date(group.updated_at).toLocaleString() : '-';
        
        // 그룹 사용자 목록 로드
        const usersResponse = await API.group.getUsers(groupId);
        const users = usersResponse.users || [];
        
        // 그룹 상세 정보 렌더링
        this.container.querySelector('#group-detail-content').innerHTML = `
          <div class="row mb-4">
            <div class="col-md-6">
              <h6>기본 정보</h6>
              <table class="table table-sm">
                <tr>
                  <th width="120">그룹 ID</th>
                  <td>${group.id}</td>
                </tr>
                <tr>
                  <th>그룹명</th>
                  <td>${group.group_name}</td>
                </tr>
                <tr>
                  <th>설명</th>
                  <td>${group.description || '-'}</td>
                </tr>
                <tr>
                  <th>생성일</th>
                  <td>${createdAt}</td>
                </tr>
                <tr>
                  <th>최종 수정일</th>
                  <td>${updatedAt}</td>
                </tr>
                <tr>
                  <th>상태</th>
                  <td>
                    <span class="badge bg-${group.is_active !== false ? 'success' : 'danger'}">
                      ${group.is_active !== false ? '활성' : '비활성'}
                    </span>
                  </td>
                </tr>
              </table>
            </div>
            <div class="col-md-6">
              <h6>목표 설정</h6>
              <table class="table table-sm">
                <tr>
                  <th width="120">일일 목표</th>
                  <td>${group.daily_goal_minutes || 0}분</td>
                </tr>
                <tr>
                  <th>월간 목표</th>
                  <td>${group.monthly_goal_minutes || 0}분</td>
                </tr>
                <tr>
                  <th>일일 최대</th>
                  <td>${group.daily_max_minutes || 0}분</td>
                </tr>
                <tr>
                  <th>월간 최소</th>
                  <td>${group.monthly_min_minutes || 0}분</td>
                </tr>
                <tr>
                  <th>최대 사용자 수</th>
                  <td>${group.max_users || '제한 없음'}</td>
                </tr>
                <tr>
                  <th>만료일</th>
                  <td>${group.expire_date ? new Date(group.expire_date).toLocaleDateString() : '설정 안됨'}</td>
                </tr>
              </table>
            </div>
          </div>
          
          <div class="row">
            <div class="col-12">
              <h6>사용자 목록 (${users.length}명)</h6>
              <div class="table-responsive">
                <table class="table table-sm table-hover">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>사용자명</th>
                      <th>레벨</th>
                      <th>최근 30일 재생 시간</th>
                      <th>최근 활동</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${users.length === 0 ? '<tr><td colspan="5" class="text-center">사용자가 없습니다.</td></tr>' : ''}
                    ${users.map(user => `
                      <tr>
                        <td>${user.id}</td>
                        <td>${user.username}</td>
                        <td>${user.level_name || '-'}</td>
                        <td>${UTILS.formatMinutes(user.recent_stats?.minutes || 0)}</td>
                        <td>${user.last_login ? new Date(user.last_login).toLocaleString() : '활동 없음'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      } catch (error) {
        console.error('그룹 상세 정보 로드 오류:', error);
        
        this.container.querySelector('#group-detail-content').innerHTML = `
          <div class="alert alert-danger">
            그룹 상세 정보를 불러오는 중 오류가 발생했습니다.
          </div>
        `;
      }
    }
  };