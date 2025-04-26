// js/tabs/user-admin.js - 사용자 관리 탭
const UserAdminTab = {
    // 초기화
    initialize(container) {
        this.container = container;
        this.currentPage = 1;
        this.totalPages = 1;
        this.pageSize = 20;
        this.levels = [];
        this.groups = [];

        this.render();
        this.loadLevels();
        this.loadGroups();
        this.loadUsers();
    },

    // 렌더링
    render() {
        this.container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h2>사용자 관리</h2>
          <div>
            <button id="bulk-create-btn" class="btn btn-secondary me-2">
              <i class="fas fa-file-import"></i> 대량 생성
            </button>
            <button id="create-user-btn" class="btn btn-primary">
              <i class="fas fa-plus"></i> 새 사용자 생성
            </button>
          </div>
        </div>
        
        <div class="card mb-4">
          <div class="card-body">
            <div class="row align-items-end">
              <div class="col-md-4 mb-3 mb-md-0">
                <label for="user-search" class="form-label">검색</label>
                <div class="input-group">
                  <input type="text" id="user-search" class="form-control" placeholder="아이디 또는 이름">
                  <button class="btn btn-outline-secondary" id="search-btn">
                    <i class="fas fa-search"></i>
                  </button>
                </div>
              </div>
              <div class="col-md-3 mb-3 mb-md-0">
                <label for="group-filter" class="form-label">그룹 필터</label>
                <select class="form-select" id="group-filter">
                  <option value="">모든 그룹</option>
                  <option value="null">그룹 없음</option>
                  <!-- 그룹 옵션은 동적으로 추가됨 -->
                </select>
              </div>
              <div class="col-md-3 mb-3 mb-md-0">
                <label for="level-filter" class="form-label">레벨 필터</label>
                <select class="form-select" id="level-filter">
                  <option value="">모든 레벨</option>
                  <option value="null">레벨 없음</option>
                  <!-- 레벨 옵션은 동적으로 추가됨 -->
                </select>
              </div>
              <div class="col-md-2">
                <button class="btn btn-primary w-100" id="filter-btn">필터 적용</button>
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
                    <th>사용자 ID</th>
                    <th>이름</th>
                    <th>레벨</th>
                    <th>그룹</th>
                    <th>생성일</th>
                    <th>마지막 로그인</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody id="users-list">
                  <tr>
                    <td colspan="8" class="text-center py-4">
                      <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">로딩 중...</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="d-flex justify-content-center py-3">
              <nav id="users-pagination"></nav>
            </div>
          </div>
        </div>
        
        <!-- 사용자 생성/수정 모달 -->
        <div class="modal fade" id="user-modal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="user-modal-title">새 사용자 생성</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <form id="user-form">
                  <input type="hidden" id="user-id">
                  <div class="mb-3">
                    <label for="user-user-id" class="form-label">사용자 ID <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="user-user-id" required>
                    <div class="form-text" id="user-id-help">고유한 사용자 ID를 입력하세요 (로그인에 사용됩니다)</div>
                  </div>
                  <div class="mb-3">
                    <label for="user-username" class="form-label">이름 <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="user-username" required>
                  </div>
                  <div class="mb-3">
                    <label for="user-password" class="form-label">비밀번호 <span class="text-danger edit-hide">*</span></label>
                    <input type="password" class="form-control" id="user-password">
                    <div class="form-text edit-show" style="display: none;">비밀번호를 변경하려면 입력하세요. 비워두면 기존 비밀번호가 유지됩니다.</div>
                  </div>
                  <div class="mb-3">
                    <label for="user-level" class="form-label">레벨</label>
                    <select class="form-select" id="user-level">
                      <option value="">레벨 선택</option>
                      <!-- 레벨 옵션은 동적으로 추가됨 -->
                    </select>
                  </div>
                  <div class="mb-3">
                    <label for="user-group" class="form-label">그룹</label>
                    <select class="form-select" id="user-group">
                      <option value="">그룹 선택</option>
                      <!-- 그룹 옵션은 동적으로 추가됨 -->
                    </select>
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">취소</button>
                <button type="button" class="btn btn-primary" id="save-user-btn">저장</button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 사용자 상세 모달 -->
        <div class="modal fade" id="user-detail-modal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="user-detail-title">사용자 상세 정보</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body" id="user-detail-content">
                <div class="d-flex justify-content-center">
                  <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">로딩 중...</span>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">닫기</button>
                <div class="dropdown d-inline-block me-2">
                  <button class="btn btn-outline-primary dropdown-toggle" type="button" id="userActionDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                    작업
                  </button>
                  <ul class="dropdown-menu" aria-labelledby="userActionDropdown">
                    <li><a class="dropdown-item" href="#" id="reset-password-btn">비밀번호 초기화</a></li>
                    <li><a class="dropdown-item" href="#" id="change-level-btn">레벨 변경</a></li>
                    <li><a class="dropdown-item" href="#" id="change-group-btn">그룹 변경</a></li>
                  </ul>
                </div>
                <button type="button" class="btn btn-primary" id="edit-user-btn">수정</button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 레벨 변경 모달 -->
        <div class="modal fade" id="change-level-modal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">레벨 변경</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <form id="change-level-form">
                  <input type="hidden" id="level-change-user-id">
                  <div class="mb-3">
                    <label for="new-level" class="form-label">새 레벨</label>
                    <select class="form-select" id="new-level" required>
                      <option value="">레벨 선택</option>
                      <!-- 레벨 옵션은 동적으로 추가됨 -->
                    </select>
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">취소</button>
                <button type="button" class="btn btn-primary" id="save-level-btn">저장</button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 그룹 변경 모달 -->
        <div class="modal fade" id="change-group-modal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">그룹 변경</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <form id="change-group-form">
                  <input type="hidden" id="group-change-user-id">
                  <div class="mb-3">
                    <label for="new-group" class="form-label">새 그룹</label>
                    <select class="form-select" id="new-group" required>
                      <option value="">그룹 선택</option>
                      <option value="null">그룹 없음</option>
                      <!-- 그룹 옵션은 동적으로 추가됨 -->
                    </select>
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
        
        <!-- 대량 사용자 생성 모달 -->
        <div class="modal fade" id="bulk-create-modal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">대량 사용자 생성</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <div class="alert alert-info">
                  <p>여러 사용자를 동시에 생성합니다. 사용자 정보를 아래 형식에 맞게 입력하세요:</p>
                  <p><code>사용자ID,이름,비밀번호,레벨ID,그룹ID</code></p>
                  <p>예: <code>user1,홍길동,password123,2,1</code></p>
                  <p>레벨ID와 그룹ID는 선택 사항입니다. 빈칸으로 두면 기본값이 적용됩니다.</p>
                </div>
                <div class="mb-3">
                  <label for="bulk-create-data" class="form-label">사용자 데이터 (줄바꿈으로 구분)</label>
                  <textarea class="form-control" id="bulk-create-data" rows="10" placeholder="user1,홍길동,password123,2,1
  user2,김철수,pass456,,1
  user3,이영희,pwd789,3,"></textarea>
                </div>
                <div id="bulk-results" style="display: none;">
                  <h6>처리 결과:</h6>
                  <div class="table-responsive">
                    <table class="table table-sm">
                      <thead>
                        <tr>
                          <th>사용자 ID</th>
                          <th>이름</th>
                          <th>결과</th>
                        </tr>
                      </thead>
                      <tbody id="bulk-results-list"></tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">닫기</button>
                <button type="button" class="btn btn-primary" id="bulk-create-submit-btn">대량 생성</button>
              </div>
            </div>
          </div>
        </div>
      `;

        // 이벤트 리스너 등록
        this.container.querySelector('#create-user-btn').addEventListener('click', () => this.showCreateUserModal());
        this.container.querySelector('#save-user-btn').addEventListener('click', () => this.saveUser());
        this.container.querySelector('#search-btn').addEventListener('click', () => this.filterUsers());
        this.container.querySelector('#filter-btn').addEventListener('click', () => this.filterUsers());
        this.container.querySelector('#user-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.filterUsers();
        });
        this.container.querySelector('#edit-user-btn').addEventListener('click', () => {
            if (this.currentUser) {
                this.showEditUserModal(this.currentUser);
            }
        });
        this.container.querySelector('#reset-password-btn').addEventListener('click', () => {
            if (this.currentUser) {
                this.resetUserPassword(this.currentUser.id);
            }
        });
        this.container.querySelector('#change-level-btn').addEventListener('click', () => {
            if (this.currentUser) {
                this.showChangeLevelModal(this.currentUser.id);
            }
        });
        this.container.querySelector('#change-group-btn').addEventListener('click', () => {
            if (this.currentUser) {
                this.showChangeGroupModal(this.currentUser.id);
            }
        });
        this.container.querySelector('#save-level-btn').addEventListener('click', () => this.saveUserLevel());
        this.container.querySelector('#save-group-btn').addEventListener('click', () => this.saveUserGroup());
        this.container.querySelector('#bulk-create-btn').addEventListener('click', () => this.showBulkCreateModal());
        this.container.querySelector('#bulk-create-submit-btn').addEventListener('click', () => this.submitBulkCreate());
    },

    // 사용자 목록 로드
    async loadUsers(page = 1, filters = {}) {
        try {
            this.currentPage = page;

            // 로딩 표시
            this.container.querySelector('#users-list').innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-4">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">로딩 중...</span>
              </div>
            </td>
          </tr>
        `;

            // 검색어 및 필터 적용
            const searchInput = this.container.querySelector('#user-search');
            const groupFilter = this.container.querySelector('#group-filter');
            const levelFilter = this.container.querySelector('#level-filter');

            const params = {
                page: this.currentPage,
                limit: this.pageSize,
                search: filters.search !== undefined ? filters.search : searchInput.value,
                group_id: filters.group_id !== undefined ? filters.group_id : groupFilter.value,
                level_id: filters.level_id !== undefined ? filters.level_id : levelFilter.value
            };

            // 사용자 목록 가져오기
            const response = await API.user.list(params);

            this.renderUsersList(response.users);

            // 페이지네이션 업데이트
            this.totalPages = response.pagination.total_pages;
            this.renderPagination();
        } catch (error) {
            console.error('사용자 목록 로드 오류:', error);
            UTILS.showAlert('사용자 목록을 불러오는 중 오류가 발생했습니다.', 'danger');

            this.container.querySelector('#users-list').innerHTML = `
          <tr>
            <td colspan="8" class="text-center text-danger py-4">
              데이터를 불러오는 중 오류가 발생했습니다.
            </td>
          </tr>
        `;
        }
    },

    // 레벨 목록 로드
    async loadLevels() {
        try {
            const response = await API.level.list();

            if (response && response.levels) {
                this.levels = response.levels;
                this.updateLevelSelects();
            }
        } catch (error) {
            console.error('레벨 목록 로드 오류:', error);
        }
    },

    // 그룹 목록 로드
    async loadGroups() {
        try {
            const response = await API.group.list({ limit: 100 });

            if (response && response.groups) {
                this.groups = response.groups;
                this.updateGroupSelects();
            }
        } catch (error) {
            console.error('그룹 목록 로드 오류:', error);
        }
    },

    // 레벨 선택 상자 업데이트
    updateLevelSelects() {
        const levelSelects = [
            this.container.querySelector('#user-level'),
            this.container.querySelector('#level-filter'),
            this.container.querySelector('#new-level')
        ];

        levelSelects.forEach(select => {
            if (!select) return;

            // 기존 옵션 유지
            const firstOption = select.querySelector('option:first-child');
            const nullOption = select.querySelector('option[value="null"]');

            // 선택된 값 저장
            const selectedValue = select.value;

            // 옵션 초기화
            select.innerHTML = '';

            // 첫 번째 옵션 복원
            if (firstOption) {
                select.appendChild(firstOption);
            }

            // null 옵션 복원
            if (nullOption) {
                select.appendChild(nullOption);
            }

            // 레벨 옵션 추가
            this.levels.forEach(level => {
                const option = document.createElement('option');
                option.value = level.id;
                option.textContent = level.level_name;
                select.appendChild(option);
            });

            // 이전 선택 복원
            if (selectedValue) {
                select.value = selectedValue;
            }
        });
    },

    // 그룹 선택 상자 업데이트
    updateGroupSelects() {
        const groupSelects = [
            this.container.querySelector('#user-group'),
            this.container.querySelector('#group-filter'),
            this.container.querySelector('#new-group')
        ];

        groupSelects.forEach(select => {
            if (!select) return;

            // 기존 옵션 유지
            const firstOption = select.querySelector('option:first-child');
            const nullOption = select.querySelector('option[value="null"]');

            // 선택된 값 저장
            const selectedValue = select.value;

            // 옵션 초기화
            select.innerHTML = '';

            // 첫 번째 옵션 복원
            if (firstOption) {
                select.appendChild(firstOption);
            }

            // null 옵션 복원
            if (nullOption) {
                select.appendChild(nullOption);
            }

            // 그룹 옵션 추가
            this.groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.group_name;
                select.appendChild(option);
            });

            // 이전 선택 복원
            if (selectedValue) {
                select.value = selectedValue;
            }
        });
    },

    // 사용자 목록 렌더링
    renderUsersList(users) {
        const tbody = this.container.querySelector('#users-list');

        if (!users || users.length === 0) {
            tbody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-4">
              사용자가 없습니다.
            </td>
          </tr>
        `;
            return;
        }

        tbody.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');

            // 날짜 포맷팅
            const createdAt = user.created_at ? new Date(user.created_at).toLocaleDateString() : '-';
            const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString() : '로그인 없음';

            row.innerHTML = `
          <td>${user.id}</td>
          <td>${user.user_id}</td>
          <td>${user.username}</td>
          <td>${user.level_name || '-'}</td>
          <td>${user.group_name || '-'}</td>
          <td>${createdAt}</td>
          <td>${lastLogin}</td>
          <td>
            <button class="btn btn-sm btn-info view-btn" data-id="${user.id}">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-sm btn-primary edit-btn" data-id="${user.id}">
              <i class="fas fa-edit"></i>
            </button>
          </td>
        `;

            // 상세 보기 버튼 이벤트
            row.querySelector('.view-btn').addEventListener('click', () => this.viewUserDetails(user.id));

            // 수정 버튼 이벤트
            row.querySelector('.edit-btn').addEventListener('click', () => this.editUser(user.id));

            tbody.appendChild(row);
        });
    },

    // 페이지네이션 렌더링
    renderPagination() {
        const paginationContainer = this.container.querySelector('#users-pagination');

        UTILS.renderPagination(
            paginationContainer,
            this.currentPage,
            this.totalPages,
            (page) => {
                this.loadUsers(page);
            }
        );
    },

    // 사용자 필터링
    filterUsers() {
        const searchInput = this.container.querySelector('#user-search');
        const groupFilter = this.container.querySelector('#group-filter');
        const levelFilter = this.container.querySelector('#level-filter');

        const filters = {
            search: searchInput.value,
            group_id: groupFilter.value,
            level_id: levelFilter.value
        };

        this.loadUsers(1, filters);
    },

    // 새 사용자 생성 모달 표시
    showCreateUserModal() {
        // 모달 초기화
        const modal = this.container.querySelector('#user-modal');
        const form = this.container.querySelector('#user-form');
        form.reset();

        // 모달 제목 설정
        this.container.querySelector('#user-modal-title').textContent = '새 사용자 생성';

        // 사용자 ID 필드 활성화
        this.container.querySelector('#user-user-id').disabled = false;

        // 사용자 ID 초기화
        this.container.querySelector('#user-id').value = '';

        // 비밀번호 필드 표시
        this.container.querySelectorAll('.edit-hide').forEach(el => el.style.display = '');
        this.container.querySelectorAll('.edit-show').forEach(el => el.style.display = 'none');

        // 모달 표시
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    },

    // 사용자 수정 모달 표시
    async editUser(userId) {
        try {
            // 사용자 정보 로드
            const user = await this.getUserDetails(userId);

            if (!user) {
                UTILS.showAlert('사용자 정보를 불러올 수 없습니다.', 'danger');
                return;
            }

            this.showEditUserModal(user);
        } catch (error) {
            console.error('사용자 정보 로드 오류:', error);
            UTILS.showAlert('사용자 정보를 불러오는 중 오류가 발생했습니다.', 'danger');
        }
    },

    // 사용자 수정 모달 표시
    showEditUserModal(user) {
        // 모달 초기화
        const modal = this.container.querySelector('#user-modal');
        const form = this.container.querySelector('#user-form');
        form.reset();

        // 사용자 정보 설정
        this.container.querySelector('#user-id').value = user.id;
        this.container.querySelector('#user-user-id').value = user.user_id;
        this.container.querySelector('#user-username').value = user.username;

        // 사용자 ID 필드 비활성화 (수정 불가)
        this.container.querySelector('#user-user-id').disabled = true;

        // 레벨 및 그룹 설정
        if (user.level_id) {
            this.container.querySelector('#user-level').value = user.level_id;
        }

        if (user.group_id) {
            this.container.querySelector('#user-group').value = user.group_id;
        }

        // 비밀번호 필드 안내 표시
        this.container.querySelectorAll('.edit-hide').forEach(el => el.style.display = 'none');
        this.container.querySelectorAll('.edit-show').forEach(el => el.style.display = '');

        // 모달 제목 설정
        this.container.querySelector('#user-modal-title').textContent = '사용자 수정';

        // 모달 표시
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    },

    // 사용자 저장
    async saveUser() {
        try {
            // 폼 데이터 가져오기
            const userId = this.container.querySelector('#user-id').value;
            const userUserId = this.container.querySelector('#user-user-id').value;
            const username = this.container.querySelector('#user-username').value;
            const password = this.container.querySelector('#user-password').value;
            const levelId = this.container.querySelector('#user-level').value || null;
            const groupId = this.container.querySelector('#user-group').value || null;

            // 필수 필드 검증
            if (!userUserId || !username) {
                UTILS.showAlert('사용자 ID와 이름은 필수 입력 항목입니다.', 'danger');
                return;
            }

            // 새 사용자 생성 시 비밀번호 필수
            if (!userId && !password) {
                UTILS.showAlert('비밀번호는 필수 입력 항목입니다.', 'danger');
                return;
            }

            // 사용자 데이터 준비
            const userData = {
                user_id: userUserId,
                username,
                level_id: levelId === 'null' ? null : levelId,
                group_id: groupId === 'null' ? null : groupId
            };

            // 비밀번호가 있는 경우에만 포함
            if (password) {
                userData.password = password;
            }

            // 저장 버튼 비활성화
            const saveButton = this.container.querySelector('#save-user-btn');
            const originalText = saveButton.textContent;
            saveButton.disabled = true;
            saveButton.textContent = '저장 중...';

            let response;

            if (userId) {
                // 사용자 수정
                response = await API.user.update(userId, userData);
            } else {
                // 새 사용자 생성
                response = await API.user.create(userData);
            }

            // 저장 버튼 복원
            saveButton.disabled = false;
            saveButton.textContent = originalText;

            if (response && (response.user || response.message)) {
                // 모달 닫기
                const modal = this.container.querySelector('#user-modal');
                bootstrap.Modal.getInstance(modal).hide();

                // 알림 표시
                UTILS.showAlert(
                    userId ? '사용자가 성공적으로 수정되었습니다.' : '새 사용자가 생성되었습니다.',
                    'success'
                );

                // 사용자 목록 다시 로드
                this.loadUsers(this.currentPage);
            } else {
                UTILS.showAlert('사용자 저장 중 오류가 발생했습니다.', 'danger');
            }
        } catch (error) {
            console.error('사용자 저장 오류:', error);
            UTILS.showAlert(error.message || '사용자 저장 중 오류가 발생했습니다.', 'danger');

            // 저장 버튼 복원
            const saveButton = this.container.querySelector('#save-user-btn');
            saveButton.disabled = false;
            saveButton.textContent = '저장';
        }
    },

    // 사용자 상세 정보 가져오기
    async getUserDetails(userId) {
        try {
            // 사용자 정보 가져오기
            const user = await API.user.get(userId);
            return user && user.user ? user.user : null;
        } catch (error) {
            console.error('사용자 상세 정보 로드 오류:', error);
            return null;
        }
    },

    // 사용자 상세 정보 보기
    async viewUserDetails(userId) {
        try {
            // 로딩 표시
            this.container.querySelector('#user-detail-content').innerHTML = `
          <div class="d-flex justify-content-center">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">로딩 중...</span>
            </div>
          </div>
        `;

            // 모달 표시
            const modal = this.container.querySelector('#user-detail-modal');
            const modalInstance = new bootstrap.Modal(modal);
            modalInstance.show();

            // 사용자 정보 로드
            const user = await this.getUserDetails(userId);

            if (!user) {
                this.container.querySelector('#user-detail-content').innerHTML = `
            <div class="alert alert-danger">
              사용자 정보를 불러올 수 없습니다.
            </div>
          `;
                return;
            }

            this.currentUser = user;

            // 사용자 상세 정보 렌더링
            this.container.querySelector('#user-detail-title').textContent = `사용자 상세 정보: ${user.username}`;

            // 날짜 포맷팅
            const createdAt = user.created_at ? new Date(user.created_at).toLocaleString() : '-';
            const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString() : '로그인 없음';

            // 최근 활동 가져오기
            let recentActivity = '<p class="text-muted">최근 활동 정보를 불러오는 중...</p>';
            let recentStats = {
                tracks: 0,
                minutes: 0
            };

            try {
                // 최근 청취 기록 로드
                const recentData = await API.listening.getRecent(5, userId);

                if (recentData && recentData.data && recentData.data.length > 0) {
                    recentActivity = `
              <div class="table-responsive">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th>트랙</th>
                      <th>아티스트</th>
                      <th>재생 시간</th>
                      <th>들은 시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${recentData.data.map(track => `
                      <tr>
                        <td>${track.title}</td>
                        <td>${track.artist || '-'}</td>
                        <td>${track.listened_at ? new Date(track.listened_at).toLocaleString() : '-'}</td>
                        <td>${track.actual_duration_seconds ? Math.floor(track.actual_duration_seconds / 60) + '분 ' + (track.actual_duration_seconds % 60) + '초' : '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `;
                } else {
                    recentActivity = '<p class="text-muted">최근 활동 내역이 없습니다.</p>';
                }

                // 최근 30일 통계 로드
                const today = new Date();
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(today.getDate() - 30);

                const statsData = await API.stats.getDaily(
                    UTILS.formatDate(thirtyDaysAgo),
                    UTILS.formatDate(today),
                    userId
                );

                if (statsData && statsData.stats) {
                    recentStats = {
                        tracks: statsData.stats.reduce((sum, day) => sum + day.total_tracks, 0),
                        minutes: statsData.stats.reduce((sum, day) => sum + day.total_minutes, 0)
                    };
                }
            } catch (error) {
                console.error('최근 활동 로드 오류:', error);
                recentActivity = '<p class="text-danger">최근 활동 정보를 불러오는 중 오류가 발생했습니다.</p>';
            }

            this.container.querySelector('#user-detail-content').innerHTML = `
          <div class="row mb-4">
            <div class="col-md-6">
              <h6>기본 정보</h6>
              <table class="table table-sm">
                <tr>
                  <th width="120">사용자 ID</th>
                  <td>${user.id}</td>
                </tr>
                <tr>
                  <th>로그인 ID</th>
                  <td>${user.user_id}</td>
                </tr>
                <tr>
                  <th>이름</th>
                  <td>${user.username}</td>
                </tr>
                <tr>
                  <th>레벨</th>
                  <td>${user.level_name || '-'}</td>
                </tr>
                <tr>
                  <th>그룹</th>
                  <td>${user.group_name || '-'}</td>
                </tr>
                <tr>
                  <th>생성일</th>
                  <td>${createdAt}</td>
                </tr>
                <tr>
                  <th>마지막 로그인</th>
                  <td>${lastLogin}</td>
                </tr>
              </table>
            </div>
            <div class="col-md-6">
              <h6>최근 30일 통계</h6>
              <div class="row text-center">
                <div class="col-6 mb-3">
                  <div class="p-3 bg-light rounded">
                    <h3>${recentStats.tracks}</h3>
                    <p class="mb-0 text-muted">들은 곡</p>
                  </div>
                </div>
                <div class="col-6 mb-3">
                  <div class="p-3 bg-light rounded">
                    <h3>${UTILS.formatMinutes(recentStats.minutes)}</h3>
                    <p class="mb-0 text-muted">청취 시간</p>
                  </div>
                </div>
              </div>
              <div class="d-grid gap-2 mt-2">
                <a href="#" class="btn btn-sm btn-outline-primary" onclick="window.open('stats.html?user_id=${user.id}', '_blank')">
                  <i class="fas fa-chart-line"></i> 상세 통계 보기
                </a>
              </div>
            </div>
          </div>
          
          <div class="row">
            <div class="col-12">
              <h6>최근 활동</h6>
              ${recentActivity}
            </div>
          </div>
        `;
        } catch (error) {
            console.error('사용자 상세 정보 로드 오류:', error);

            this.container.querySelector('#user-detail-content').innerHTML = `
          <div class="alert alert-danger">
            사용자 상세 정보를 불러오는 중 오류가 발생했습니다.
          </div>
        `;
        }
    },

    // 사용자 비밀번호 초기화
    async resetUserPassword(userId) {
        try {
            if (!confirm('정말 이 사용자의 비밀번호를 초기화하시겠습니까?')) {
                return;
            }

            // 비밀번호 초기화 요청
            const response = await API.user.resetPassword(userId);

            if (response && response.message) {
                UTILS.showAlert('비밀번호가 성공적으로 초기화되었습니다.', 'success');

                // 임시 비밀번호 표시
                alert(`임시 비밀번호: ${response.temp_password}\n\n사용자에게 이 비밀번호를 전달하세요.`);
            } else {
                UTILS.showAlert('비밀번호 초기화 중 오류가 발생했습니다.', 'danger');
            }
        } catch (error) {
            console.error('비밀번호 초기화 오류:', error);
            UTILS.showAlert('비밀번호 초기화 중 오류가 발생했습니다.', 'danger');
        }
    },

    // 레벨 변경 모달 표시
    showChangeLevelModal(userId) {
        // 모달 초기화
        const modal = this.container.querySelector('#change-level-modal');

        // 사용자 ID 설정
        this.container.querySelector('#level-change-user-id').value = userId;

        // 현재 레벨 설정 (있는 경우)
        if (this.currentUser && this.currentUser.level_id) {
            this.container.querySelector('#new-level').value = this.currentUser.level_id;
        }

        // 모달 표시
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    },

    // 그룹 변경 모달 표시
    showChangeGroupModal(userId) {
        // 모달 초기화
        const modal = this.container.querySelector('#change-group-modal');

        // 사용자 ID 설정
        this.container.querySelector('#group-change-user-id').value = userId;

        // 현재 그룹 설정 (있는 경우)
        if (this.currentUser && this.currentUser.group_id) {
            this.container.querySelector('#new-group').value = this.currentUser.group_id;
        } else {
            this.container.querySelector('#new-group').value = 'null';
        }

        // 모달 표시
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    },

    // 사용자 레벨 저장
    async saveUserLevel() {
        try {
            const userId = this.container.querySelector('#level-change-user-id').value;
            const levelId = this.container.querySelector('#new-level').value;

            if (!userId || !levelId) {
                UTILS.showAlert('사용자 ID와 레벨은 필수 항목입니다.', 'danger');
                return;
            }

            // 저장 버튼 비활성화
            const saveButton = this.container.querySelector('#save-level-btn');
            const originalText = saveButton.textContent;
            saveButton.disabled = true;
            saveButton.textContent = '저장 중...';

            // 레벨 변경 요청
            const response = await API.user.changeLevel(userId, levelId);

            // 저장 버튼 복원
            saveButton.disabled = false;
            saveButton.textContent = originalText;

            if (response && response.message) {
                // 모달 닫기
                const modal = this.container.querySelector('#change-level-modal');
                bootstrap.Modal.getInstance(modal).hide();

                // 알림 표시
                UTILS.showAlert('사용자 레벨이 성공적으로 변경되었습니다.', 'success');

                // 현재 사용자 정보가 있는 경우 업데이트
                if (this.currentUser) {
                    this.currentUser.level_id = levelId;
                    this.currentUser.level_name = this.levels.find(l => l.id == levelId)?.level_name || '알 수 없음';
                }

                // 사용자 목록 다시 로드
                this.loadUsers(this.currentPage);
            } else {
                UTILS.showAlert('레벨 변경 중 오류가 발생했습니다.', 'danger');
            }
        } catch (error) {
            console.error('레벨 변경 오류:', error);
            UTILS.showAlert('레벨 변경 중 오류가 발생했습니다.', 'danger');

            // 저장 버튼 복원
            const saveButton = this.container.querySelector('#save-level-btn');
            saveButton.disabled = false;
            saveButton.textContent = '저장';
        }
    },

    // 사용자 그룹 저장
    async saveUserGroup() {
        try {
            const userId = this.container.querySelector('#group-change-user-id').value;
            const groupId = this.container.querySelector('#new-group').value;

            if (!userId) {
                UTILS.showAlert('사용자 ID는 필수 항목입니다.', 'danger');
                return;
            }

            // 저장 버튼 비활성화
            const saveButton = this.container.querySelector('#save-group-btn');
            const originalText = saveButton.textContent;
            saveButton.disabled = true;
            saveButton.textContent = '저장 중...';

            // 그룹 변경 요청 (null은 그룹 없음)
            const response = await API.user.changeGroup(userId, groupId === 'null' ? null : groupId);

            // 저장 버튼 복원
            saveButton.disabled = false;
            saveButton.textContent = originalText;

            if (response && response.message) {
                // 모달 닫기
                const modal = this.container.querySelector('#change-group-modal');
                bootstrap.Modal.getInstance(modal).hide();

                // 알림 표시
                UTILS.showAlert('사용자 그룹이 성공적으로 변경되었습니다.', 'success');

                // 현재 사용자 정보가 있는 경우 업데이트
                if (this.currentUser) {
                    this.currentUser.group_id = groupId === 'null' ? null : groupId;
                    this.currentUser.group_name = groupId === 'null' ? null :
                        this.groups.find(g => g.id == groupId)?.group_name || '알 수 없음';
                }

                // 사용자 목록 다시 로드
                this.loadUsers(this.currentPage);
            } else {
                UTILS.showAlert('그룹 변경 중 오류가 발생했습니다.', 'danger');
            }
        } catch (error) {
            console.error('그룹 변경 오류:', error);
            UTILS.showAlert('그룹 변경 중 오류가 발생했습니다.', 'danger');

            // 저장 버튼 복원
            const saveButton = this.container.querySelector('#save-group-btn');
            saveButton.disabled = false;
            saveButton.textContent = '저장';
        }
    },

    // 대량 사용자 생성 모달 표시
    showBulkCreateModal() {
        // 모달 초기화
        const modal = this.container.querySelector('#bulk-create-modal');
        const textarea = this.container.querySelector('#bulk-create-data');
        textarea.value = '';

        // 결과 숨기기
        this.container.querySelector('#bulk-results').style.display = 'none';

        // 모달 표시
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    },

    // 대량 사용자 생성 제출
    async submitBulkCreate() {
        try {
            const data = this.container.querySelector('#bulk-create-data').value;

            if (!data.trim()) {
                UTILS.showAlert('사용자 데이터를 입력하세요.', 'danger');
                return;
            }

            // 데이터 파싱
            const lines = data.split('\n').filter(line => line.trim());
            const users = [];

            for (const line of lines) {
                const parts = line.split(',').map(part => part.trim());

                if (parts.length < 3) {
                    continue; // 최소 사용자ID, 이름, 비밀번호는 필요
                }

                users.push({
                    user_id: parts[0],
                    username: parts[1],
                    password: parts[2],
                    level_id: parts[3] ? parseInt(parts[3]) : null,
                    group_id: parts[4] ? parseInt(parts[4]) : null
                });
            }

            if (users.length === 0) {
                UTILS.showAlert('유효한 사용자 데이터가 없습니다.', 'danger');
                return;
            }

            // 제출 버튼 비활성화
            const submitButton = this.container.querySelector('#bulk-create-submit-btn');
            const originalText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = '처리 중...';

            // 대량 생성 요청
            const response = await API.user.bulkCreate(users);

            // 제출 버튼 복원
            submitButton.disabled = false;
            submitButton.textContent = originalText;

            if (response) {
                // 결과 표시
                const resultsList = this.container.querySelector('#bulk-results-list');
                resultsList.innerHTML = '';

                const successList = response.success || [];
                const errorList = response.errors || [];

                // 성공 항목 추가
                successList.forEach(user => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
              <td>${user.user_id}</td>
              <td>${user.username}</td>
              <td class="text-success">성공</td>
            `;
                    resultsList.appendChild(row);
                });

                // 오류 항목 추가
                errorList.forEach(error => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
              <td>${error.user_id}</td>
              <td>-</td>
              <td class="text-danger">${error.error}</td>
            `;
                    resultsList.appendChild(row);
                });

                // 결과 섹션 표시
                this.container.querySelector('#bulk-results').style.display = 'block';

                // 알림 표시
                UTILS.showAlert(`${successList.length}명의 사용자가 생성되었습니다. ${errorList.length}건의 오류가 발생했습니다.`, 'success');

                // 사용자 목록 다시 로드
                this.loadUsers(this.currentPage);
            } else {
                UTILS.showAlert('대량 사용자 생성 중 오류가 발생했습니다.', 'danger');
            }
        } catch (error) {
            console.error('대량 사용자 생성 오류:', error);
            UTILS.showAlert('대량 사용자 생성 중 오류가 발생했습니다.', 'danger');

            // 제출 버튼 복원
            const submitButton = this.container.querySelector('#bulk-create-submit-btn');
            submitButton.disabled = false;
            submitButton.textContent = '대량 생성';
        }
    }
};