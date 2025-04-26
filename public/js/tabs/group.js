// group.js - 그룹 탭
const GroupTab = {
    // 초기화
    initialize(container) {
      this.container = container;
      this.render();
      this.loadData();
    },
    
    // 렌더링
    render() {
      this.container.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div class="d-flex justify-content-between align-items-center">
              <span>그룹 정보</span>
            </div>
          </div>
          <div class="card-body" id="group-info-container">
            <div class="text-center py-4">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">로딩 중...</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="card mt-4">
          <div class="card-header">
            <div class="d-flex justify-content-between align-items-center">
              <span>그룹 구성원</span>
            </div>
          </div>
          <div class="card-body p-0" id="group-members-container">
            <div class="text-center py-4">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">로딩 중...</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="card mt-4">
          <div class="card-header">
            <div class="d-flex justify-content-between align-items-center">
              <span>월간 통계</span>
              <div class="d-flex gap-2">
                <input type="month" class="form-control form-control-sm" id="stats-month">
                <button class="btn btn-sm btn-primary" id="stats-search">검색</button>
              </div>
            </div>
          </div>
          <div class="card-body" id="group-stats-container">
            <div class="text-center py-4">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">로딩 중...</span>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // 현재 월 설정
      const today = new Date();
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      this.container.querySelector('#stats-month').value = currentMonth;
      
      // 이벤트 리스너 설정
      this.container.querySelector('#stats-search').addEventListener('click', () => {
        const month = this.container.querySelector('#stats-month').value;
        this.loadGroupStats(month);
      });
    },
    
    // 데이터 로드
    async loadData() {
      try {
        // 사용자 정보에서 그룹 ID 가져오기
        const userInfo = JSON.parse(localStorage.getItem(CONFIG.USER_INFO_KEY) || '{}');
        const groupId = userInfo.group_id;
        
        if (!groupId) {
          this.showNoGroupMessage();
          return;
        }
        
        // 그룹 정보 로드
        await this.loadGroupInfo(groupId);
        
        // 그룹 구성원 로드
        await this.loadGroupMembers(groupId);
        
        // 현재 월 기준 통계 로드
        const today = new Date();
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        await this.loadGroupStats(currentMonth);
      } catch (error) {
        console.error('그룹 데이터 로드 오류:', error);
        UTILS.showAlert('데이터를 불러오는 중 오류가 발생했습니다.', 'danger');
      }
    },
    
    // 그룹 없음 메시지 표시
    showNoGroupMessage() {
      const infoContainer = this.container.querySelector('#group-info-container');
      const membersContainer = this.container.querySelector('#group-members-container');
      const statsContainer = this.container.querySelector('#group-stats-container');
      
      infoContainer.innerHTML = '<div class="alert alert-info">소속된 그룹이 없습니다.</div>';
      membersContainer.innerHTML = '<div class="p-3 text-center text-muted">그룹에 속해 있지 않습니다.</div>';
      statsContainer.innerHTML = '<div class="text-center text-muted">그룹에 속해 있지 않습니다.</div>';
    },
    
    // 그룹 정보 로드
    async loadGroupInfo(groupId) {
      try {
        const data = await API.group.get(groupId);
        
        if (!data || !data.group) {
          throw new Error('그룹 정보를 찾을 수 없습니다.');
        }
        
        const group = data.group;
        const infoContainer = this.container.querySelector('#group-info-container');
        
        infoContainer.innerHTML = `
          <div class="row mb-4">
            <div class="col-md-6">
              <h5 class="mb-3">${group.group_name}</h5>
              <p>${group.description || '설명이 없습니다.'}</p>
            </div>
            <div class="col-md-6">
              <div class="card bg-light">
                <div class="card-body p-3">
                  <h6 class="card-title">목표 정보</h6>
                  <ul class="list-unstyled mb-0">
                    <li>일일 목표: ${group.daily_goal_minutes || 0}분</li>
                    <li>월간 목표: ${group.monthly_goal_minutes || 0}분</li>
                    <li>일일 최대 인정: ${group.daily_max_minutes || 0}분</li>
                    <li>월간 최소 필요: ${group.monthly_min_minutes || 0}분</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        `;
      } catch (error) {
        console.error('그룹 정보 로드 오류:', error);
        const infoContainer = this.container.querySelector('#group-info-container');
        infoContainer.innerHTML = '<div class="alert alert-danger">그룹 정보를 불러오는 중 오류가 발생했습니다.</div>';
        throw error;
      }
    },
    
    // 그룹 구성원 로드
    async loadGroupMembers(groupId) {
      try {
        const data = await API.group.getUsers(groupId);
        
        const membersContainer = this.container.querySelector('#group-members-container');
        
        if (!data.users || data.users.length === 0) {
          membersContainer.innerHTML = '<div class="p-3 text-center text-muted">그룹 구성원이 없습니다.</div>';
          return;
        }
        
        // 테이블 생성
        const table = document.createElement('table');
        table.className = 'table table-hover';
        
        // 테이블 헤더
        const thead = document.createElement('thead');
        thead.innerHTML = `
          <tr>
            <th>이름</th>
            <th>레벨</th>
            <th>최근 30일</th>
            <th>가입일</th>
          </tr>
        `;
        
        // 테이블 바디
        const tbody = document.createElement('tbody');
        
        data.users.forEach(user => {
          // 행 생성
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.level_name || '-'}</td>
            <td>${user.recent_stats ? `${user.recent_stats.minutes}분, ${user.recent_stats.tracks}곡` : '-'}</td>
            <td>${UTILS.formatDate(user.created_at)}</td>
          `;
          
          tbody.appendChild(row);
        });
        
        // 테이블 조립
        table.appendChild(thead);
        table.appendChild(tbody);
        
        // 컨테이너 초기화 후 테이블 추가
        membersContainer.innerHTML = '';
        membersContainer.appendChild(table);
      } catch (error) {
        console.error('그룹 구성원 로드 오류:', error);
        const membersContainer = this.container.querySelector('#group-members-container');
        membersContainer.innerHTML = '<div class="alert alert-danger m-3">구성원 정보를 불러오는 중 오류가 발생했습니다.</div>';
        throw error;
      }
    },
    
    // 그룹 통계 로드
    async loadGroupStats(monthStr) {
      try {
        const statsContainer = this.container.querySelector('#group-stats-container');
        
        // 로딩 표시
        statsContainer.innerHTML = `
          <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">로딩 중...</span>
            </div>
          </div>
        `;
        
        // 사용자 정보에서 그룹 ID 가져오기
        const userInfo = JSON.parse(localStorage.getItem(CONFIG.USER_INFO_KEY) || '{}');
        const groupId = userInfo.group_id;
        
        if (!groupId) {
          statsContainer.innerHTML = '<div class="alert alert-info">소속된 그룹이 없습니다.</div>';
          return;
        }
        
        // 월 기간 계산
        const [year, month] = monthStr.split('-');
        const daysInMonth = UTILS.getDaysInMonth(parseInt(year), parseInt(month) - 1);
        
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-${daysInMonth.toString().padStart(2, '0')}`;
        
        // 그룹 통계 로드
        const data = await API.group.getStats(groupId, {
          start_date: startDate,
          end_date: endDate
        });
        
        if (!data || !data.stats) {
          statsContainer.innerHTML = '<div class="alert alert-info">해당 기간의 통계 데이터가 없습니다.</div>';
          return;
        }
        
        // 월간 통계 요약
        const totalMinutes = data.stats.reduce((sum, day) => sum + (day.total_minutes || 0), 0);
        const totalTracks = data.stats.reduce((sum, day) => sum + (day.total_tracks || 0), 0);
        const avgUsers = Math.round(data.stats.reduce((sum, day) => sum + (day.total_unique_users || 0), 0) / data.stats.length);
        
        // 차트 및 요약 표시
        statsContainer.innerHTML = `
          <div class="row mb-4">
            <div class="col-md-4">
              <div class="card stat-card">
                <div class="stat-value">${totalMinutes}</div>
                <div class="stat-label">총 청취 시간(분)</div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="card stat-card">
                <div class="stat-value">${totalTracks}</div>
                <div class="stat-label">총 청취 곡 수</div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="card stat-card">
                <div class="stat-value">${avgUsers}</div>
                <div class="stat-label">일 평균 참여 인원</div>
              </div>
            </div>
          </div>
          
          <div class="chart-container">
            <canvas id="group-stats-chart"></canvas>
          </div>
        `;
        
        // 차트 데이터 준비
        const labels = data.stats.map(day => day.date.split('-')[2] + '일');
        const minutesData = data.stats.map(day => day.total_minutes || 0);
        const usersData = data.stats.map(day => day.total_unique_users || 0);
        
        // 차트 생성
        const ctx = statsContainer.querySelector('#group-stats-chart').getContext('2d');
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [
              {
                label: '청취 시간 (분)',
                data: minutesData,
                backgroundColor: CONFIG.CHART_COLORS.primary,
                borderColor: CONFIG.CHART_COLORS.primary,
                yAxisID: 'y'
              },
              {
                label: '참여 인원',
                data: usersData,
                backgroundColor: CONFIG.CHART_COLORS.secondary,
                borderColor: CONFIG.CHART_COLORS.secondary,
                type: 'line',
                yAxisID: 'y1'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: '청취 시간 (분)'
                }
              },
              y1: {
                beginAtZero: true,
                position: 'right',
                title: {
                  display: true,
                  text: '참여 인원'
                },
                grid: {
                  drawOnChartArea: false
                }
              }
            }
          }
        });
      } catch (error) {
        console.error('그룹 통계 로드 오류:', error);
        const statsContainer = this.container.querySelector('#group-stats-container');
        statsContainer.innerHTML = '<div class="alert alert-danger">통계 데이터를 불러오는 중 오류가 발생했습니다.</div>';
      }
    }
  };