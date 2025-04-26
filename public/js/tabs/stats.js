// js/tabs/stats.js - 통계 탭
const StatsTab = {
    // 초기화
    initialize(container) {
      this.container = container;
      this.chartInstances = {};
      this.currentPeriod = 'daily';
      this.currentView = 'user';
      
      // 오늘 날짜 기준 기간 설정
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      
      this.dateRange = {
        start: UTILS.formatDate(thirtyDaysAgo),
        end: UTILS.formatDate(today)
      };
      
      this.render();
      this.loadStats();
    },
    
    // 렌더링
    render() {
      this.container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h2>통계</h2>
          <div class="btn-group">
            <button id="export-btn" class="btn btn-outline-primary">
              <i class="fas fa-download"></i> 내보내기
            </button>
          </div>
        </div>
        
        <div class="card mb-4">
          <div class="card-body">
            <div class="row align-items-end">
              <div class="col-md-4 mb-3 mb-md-0">
                <label for="date-range" class="form-label">기간 선택</label>
                <div class="input-group">
                  <input type="date" id="start-date" class="form-control" value="${this.dateRange.start}">
                  <span class="input-group-text">~</span>
                  <input type="date" id="end-date" class="form-control" value="${this.dateRange.end}">
                </div>
              </div>
              <div class="col-md-3 mb-3 mb-md-0">
                <label for="period-type" class="form-label">집계 단위</label>
                <select class="form-select" id="period-type">
                  <option value="daily" selected>일별</option>
                  <option value="weekly">주별</option>
                  <option value="monthly">월별</option>
                </select>
              </div>
              <div class="col-md-3 mb-3 mb-md-0">
                <label for="view-type" class="form-label">보기 유형</label>
                <select class="form-select" id="view-type">
                  <option value="user" selected>내 통계</option>
                  ${UTILS.hasPermission('stats.group') ? '<option value="group">그룹 통계</option>' : ''}
                  ${UTILS.hasPermission('stats.admin') ? '<option value="global">전체 통계</option>' : ''}
                </select>
              </div>
              <div class="col-md-2">
                <button class="btn btn-primary w-100" id="apply-filter-btn">적용</button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 요약 카드 -->
        <div class="row mb-4" id="summary-cards">
          <div class="col-md-3 mb-3">
            <div class="card">
              <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 class="text-muted mb-1">총 청취 시간</h6>
                    <h4 id="total-time">0분</h4>
                  </div>
                  <div class="bg-primary bg-opacity-10 rounded-circle p-3">
                    <i class="fas fa-clock text-primary"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-3 mb-3">
            <div class="card">
              <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 class="text-muted mb-1">총 트랙 수</h6>
                    <h4 id="total-tracks">0</h4>
                  </div>
                  <div class="bg-success bg-opacity-10 rounded-circle p-3">
                    <i class="fas fa-music text-success"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-3 mb-3">
            <div class="card">
              <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 class="text-muted mb-1">일 평균 청취</h6>
                    <h4 id="avg-time-per-day">0분</h4>
                  </div>
                  <div class="bg-info bg-opacity-10 rounded-circle p-3">
                    <i class="fas fa-calendar-day text-info"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-3 mb-3">
            <div class="card">
              <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 class="text-muted mb-1">목표 달성률</h6>
                    <h4 id="goal-percentage">0%</h4>
                  </div>
                  <div class="bg-warning bg-opacity-10 rounded-circle p-3">
                    <i class="fas fa-bullseye text-warning"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 차트 -->
        <div class="row mb-4">
          <div class="col-md-8">
            <div class="card">
              <div class="card-header">
                <h5 class="card-title mb-0">청취 시간 추이</h5>
              </div>
              <div class="card-body">
                <div class="chart-container" style="height: 300px;">
                  <canvas id="time-chart"></canvas>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card">
              <div class="card-header">
                <h5 class="card-title mb-0">요일별 청취</h5>
              </div>
              <div class="card-body">
                <div class="chart-container" style="height: 300px;">
                  <canvas id="day-of-week-chart"></canvas>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 상세 데이터 -->
        <div class="row">
          <div class="col-md-6 mb-4">
            <div class="card">
              <div class="card-header">
                <h5 class="card-title mb-0">자주 들은 트랙</h5>
              </div>
              <div class="card-body p-0">
                <div class="table-responsive">
                  <table class="table table-hover">
                    <thead>
                      <tr>
                        <th>트랙</th>
                        <th>아티스트</th>
                        <th>재생 횟수</th>
                        <th>총 시간</th>
                      </tr>
                    </thead>
                    <tbody id="top-tracks">
                      <tr>
                        <td colspan="4" class="text-center py-4">
                          <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">로딩 중...</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-6 mb-4">
            <div class="card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="card-title mb-0">시간대별 청취</h5>
              </div>
              <div class="card-body">
                <div class="chart-container" style="height: 300px;">
                  <canvas id="hourly-chart"></canvas>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // 이벤트 리스너 설정
      this.container.querySelector('#apply-filter-btn').addEventListener('click', () => this.applyFilters());
      this.container.querySelector('#export-btn').addEventListener('click', () => this.exportStats());
      
      // 차트 초기화
      this.initCharts();
    },
    
    // 필터 적용
    applyFilters() {
      // 입력값 가져오기
      const startDate = this.container.querySelector('#start-date').value;
      const endDate = this.container.querySelector('#end-date').value;
      const periodType = this.container.querySelector('#period-type').value;
      const viewType = this.container.querySelector('#view-type').value;
      
      // 날짜 유효성 검사
      if (!startDate || !endDate) {
        UTILS.showAlert('시작일과 종료일을 모두 입력하세요.', 'danger');
        return;
      }
      
      if (new Date(startDate) > new Date(endDate)) {
        UTILS.showAlert('시작일은 종료일보다 이전이어야 합니다.', 'danger');
        return;
      }
      
      // 상태 업데이트
      this.dateRange.start = startDate;
      this.dateRange.end = endDate;
      this.currentPeriod = periodType;
      this.currentView = viewType;
      
      // 데이터 다시 로드
      this.loadStats();
    },
    
    // 통계 로드
    async loadStats() {
      try {
        // 로딩 표시
        this.showLoading();
        
        // 일별 통계 로드
        await this.loadDailyStats();
        
        // 인기 트랙 로드
        await this.loadTopTracks();
        
        // 시간대별 통계 로드
        await this.loadHourlyStats();
        
      } catch (error) {
        console.error('통계 로드 오류:', error);
        UTILS.showAlert('통계를 불러오는 중 오류가 발생했습니다.', 'danger');
      }
    },
    
    // 로딩 표시
    showLoading() {
      this.container.querySelector('#top-tracks').innerHTML = `
        <tr>
          <td colspan="4" class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">로딩 중...</span>
            </div>
          </td>
        </tr>
      `;
    },
    
    // 차트 초기화
    initCharts() {
      // 사용 색상 정의
      const chartColors = {
        primary: '#4285f4',
        secondary: '#34a853',
        warning: '#fbbc05',
        danger: '#ea4335',
        pastel: [
          'rgba(66, 133, 244, 0.7)',
          'rgba(52, 168, 83, 0.7)',
          'rgba(251, 188, 5, 0.7)',
          'rgba(234, 67, 53, 0.7)',
          'rgba(66, 133, 244, 0.5)',
          'rgba(52, 168, 83, 0.5)',
          'rgba(251, 188, 5, 0.5)'
        ]
      };
      
      // 시간 추이 차트
      const timeChartCtx = this.container.querySelector('#time-chart').getContext('2d');
      this.chartInstances.timeChart = new Chart(timeChartCtx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: '청취 시간 (분)',
            data: [],
            borderColor: chartColors.primary,
            backgroundColor: 'rgba(66, 133, 244, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'top'
            }
          }
        }
      });
      
      // 요일별 차트
      const dayOfWeekChartCtx = this.container.querySelector('#day-of-week-chart').getContext('2d');
      this.chartInstances.dayOfWeekChart = new Chart(dayOfWeekChartCtx, {
        type: 'bar',
        data: {
          labels: ['일', '월', '화', '수', '목', '금', '토'],
          datasets: [{
            label: '청취 시간 (분)',
            data: [0, 0, 0, 0, 0, 0, 0],
            backgroundColor: chartColors.pastel
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
      
      // 시간대별 차트
      const hourlyChartCtx = this.container.querySelector('#hourly-chart').getContext('2d');
      this.chartInstances.hourlyChart = new Chart(hourlyChartCtx, {
        type: 'bar',
        data: {
          labels: Array.from({ length: 24 }, (_, i) => `${i}시`),
          datasets: [{
            label: '청취 시간 (분)',
            data: Array(24).fill(0),
            backgroundColor: 'rgba(66, 133, 244, 0.7)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    },
    
    // 일별 통계 로드
    async loadDailyStats() {
      try {
        let endpoint = 'stats/daily';
        let params = {
          start_date: this.dateRange.start,
          end_date: this.dateRange.end
        };
        
        // 그룹 또는 전체 통계 보기
        if (this.currentView === 'group' && UTILS.hasPermission('stats.group')) {
          // 사용자 그룹 ID 가져오기
          const userInfo = JSON.parse(localStorage.getItem(CONFIG.USER_INFO_KEY) || '{}');
          if (userInfo.group_id) {
            endpoint = `stats/group/${userInfo.group_id}`;
          }
        } else if (this.currentView === 'global' && UTILS.hasPermission('stats.admin')) {
          endpoint = 'stats/global';
        }
        
        const response = await API.get(endpoint, params);
        
        if (!response || !response.stats) {
          throw new Error('통계 데이터를 불러올 수 없습니다.');
        }
        
        const stats = response.stats;
        
        // 요약 정보 업데이트
        this.updateSummary(stats);
        
        // 데이터 가공 (현재 집계 단위에 따라)
        let chartData;
        
        switch (this.currentPeriod) {
          case 'weekly':
            chartData = this.processWeeklyData(stats);
            break;
          case 'monthly':
            chartData = this.processMonthlyData(stats);
            break;
          case 'daily':
          default:
            chartData = this.processDailyData(stats);
            break;
        }
        
        // 차트 업데이트
        this.updateTimeChart(chartData);
        this.updateDayOfWeekChart(stats);
        
        // 목표 업데이트 (그룹 정보가 있는 경우)
        if (response.group) {
          this.updateGoal(response.group, stats);
        }
      } catch (error) {
        console.error('일별 통계 로드 오류:', error);
        throw error;
      }
    },
    
    // 인기 트랙 로드
    async loadTopTracks() {
      try {
        const response = await API.stats.getTrackStats({
          start_date: this.dateRange.start,
          end_date: this.dateRange.end,
          limit: 10
        });
        
        if (!response || !response.stats) {
          throw new Error('트랙 통계 데이터를 불러올 수 없습니다.');
        }
        
        this.updateTopTracks(response.stats);
      } catch (error) {
        console.error('인기 트랙 로드 오류:', error);
        this.container.querySelector('#top-tracks').innerHTML = `
          <tr>
            <td colspan="4" class="text-center text-danger py-4">
              인기 트랙 데이터를 불러오는 중 오류가 발생했습니다.
            </td>
          </tr>
        `;
      }
    },
    
    // 시간대별 통계 로드
    async loadHourlyStats() {
      try {
        // 시간대별 통계는 일별로만 조회 가능하므로 대표 날짜 사용
        // 날짜 범위의 중간 날짜를 사용
        const startDate = new Date(this.dateRange.start);
        const endDate = new Date(this.dateRange.end);
        const middleDate = new Date((startDate.getTime() + endDate.getTime()) / 2);
        
        const response = await API.stats.getHourly(UTILS.formatDate(middleDate));
        
        if (!response || !response.stats) {
          throw new Error('시간대별 통계 데이터를 불러올 수 없습니다.');
        }
        
        this.updateHourlyChart(response.stats);
      } catch (error) {
        console.error('시간대별 통계 로드 오류:', error);
        // 오류 시 빈 데이터로 차트 초기화
        this.updateHourlyChart([]);
      }
    },
    
    // 일별 데이터 처리
    processDailyData(stats) {
      return stats.map(day => ({
        date: day.date,
        label: new Date(day.date).toLocaleDateString(),
        value: day.total_minutes || 0
      }));
    },
    
    // 주별 데이터 처리
    processWeeklyData(stats) {
      const weeklyData = {};
      
      // 날짜별 데이터를 주별로 그룹화
      stats.forEach(day => {
        if (!day.date) return;
        
        const date = new Date(day.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // 일요일부터 시작하는 주
        
        const weekKey = UTILS.formatDate(weekStart);
        
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = {
            date: weekKey,
            label: `${weekStart.getMonth() + 1}/${weekStart.getDate()} 주`,
            value: 0
          };
        }
        
        weeklyData[weekKey].value += day.total_minutes || 0;
      });
      
      // 객체를 배열로 변환하고 날짜순 정렬
      return Object.values(weeklyData).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );
    },
    
    // 월별 데이터 처리
    processMonthlyData(stats) {
      const monthlyData = {};
      
      // 날짜별 데이터를 월별로 그룹화
      stats.forEach(day => {
        if (!day.date) return;
        
        const date = new Date(day.date);
        const year = date.getFullYear();
        const month = date.getMonth();
        
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            date: monthKey,
            label: `${year}년 ${month + 1}월`,
            value: 0
          };
        }
        
        monthlyData[monthKey].value += day.total_minutes || 0;
      });
      
      // 객체를 배열로 변환하고 날짜순 정렬
      return Object.values(monthlyData).sort((a, b) => a.date.localeCompare(b.date));
    },
    
    // 요약 정보 업데이트
    updateSummary(stats) {
      // 총 청취 시간
      const totalMinutes = stats.reduce((sum, day) => sum + (day.total_minutes || 0), 0);
      this.container.querySelector('#total-time').textContent = UTILS.formatMinutes(totalMinutes);
      
      // 총 트랙 수
      const totalTracks = stats.reduce((sum, day) => sum + (day.total_tracks || 0), 0);
      this.container.querySelector('#total-tracks').textContent = totalTracks.toLocaleString();
      
      // 일 평균 청취 시간
      const daysWithActivity = stats.filter(day => day.total_minutes > 0).length;
      const avgTimePerDay = daysWithActivity > 0 ? Math.round(totalMinutes / daysWithActivity) : 0;
      this.container.querySelector('#avg-time-per-day').textContent = UTILS.formatMinutes(avgTimePerDay);
    },
    
    // 목표 달성률 업데이트
    updateGoal(groupInfo, stats) {
      if (!groupInfo) return;
      
      // 월간 목표 (집계 기간이 한 달 이내인 경우)
      const startDate = new Date(this.dateRange.start);
      const endDate = new Date(this.dateRange.end);
      const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      
      let goal = 0;
      let totalMinutes = stats.reduce((sum, day) => sum + (day.total_minutes || 0), 0);
      
      // 날짜 범위가 한 달(31일) 이내인 경우 월간 목표 비례 계산
      if (daysDiff <= 31) {
        const monthlyGoal = groupInfo.monthly_goal_minutes || 0;
        const daysInMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
        
        // 기간에 비례한 목표
        goal = Math.round((monthlyGoal / daysInMonth) * daysDiff);
        
        // 달성률 계산 (최대 100%)
        const percentage = goal > 0 ? Math.min(Math.round((totalMinutes / goal) * 100), 100) : 0;
        
        this.container.querySelector('#goal-percentage').textContent = `${percentage}%`;
      } else {
        // 장기 기간인 경우 직접적인 목표 없음
        this.container.querySelector('#goal-percentage').textContent = '-';
      }
    },
    
    // 시간 추이 차트 업데이트
    updateTimeChart(data) {
      const chart = this.chartInstances.timeChart;
      
      chart.data.labels = data.map(item => item.label);
      chart.data.datasets[0].data = data.map(item => item.value);
      
      chart.update();
    },
    
    // 요일별 차트 업데이트
    updateDayOfWeekChart(data) {
      const chart = this.chartInstances.dayOfWeekChart;
      const dayOfWeekData = [0, 0, 0, 0, 0, 0, 0]; // 일, 월, 화, 수, 목, 금, 토
      
      // 요일별 데이터 집계
      data.forEach(day => {
        if (!day.date) return;
        
        const date = new Date(day.date);
        const dayOfWeek = date.getDay(); // 0: 일요일, 6: 토요일
        
        dayOfWeekData[dayOfWeek] += day.total_minutes || 0;
      });
      
      chart.data.datasets[0].data = dayOfWeekData;
      chart.update();
    },
    
    // 시간대별 차트 업데이트
    updateHourlyChart(data) {
      const chart = this.chartInstances.hourlyChart;
      const hourlyData = Array(24).fill(0);
      
      // 시간대별 데이터 집계
      data.forEach(hour => {
        if (hour.hour >= 0 && hour.hour < 24) {
          hourlyData[hour.hour] = hour.total_minutes || 0;
        }
      });
      
      chart.data.datasets[0].data = hourlyData;
      chart.update();
    },
    
    // 인기 트랙 목록 업데이트
    updateTopTracks(tracks) {
      const container = this.container.querySelector('#top-tracks');
      
      if (!tracks || tracks.length === 0) {
        container.innerHTML = `
          <tr>
            <td colspan="4" class="text-center py-4">
              표시할 데이터가 없습니다.
            </td>
          </tr>
        `;
        return;
      }
      
      container.innerHTML = '';
      
      tracks.forEach(track => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
          <td class="text-truncate" style="max-width: 200px;">${track.title || '-'}</td>
          <td>${track.artist || '-'}</td>
          <td>${track.play_count || 0}</td>
          <td>${UTILS.formatMinutes(track.total_minutes || 0)}</td>
        `;
        
        container.appendChild(row);
      });
    },
    
    // 통계 내보내기
    async exportStats() {
      try {
        const type = this.currentPeriod; // daily, weekly, monthly
        
        // 현재 사용자 또는 그룹 통계만 내보내기 가능
        const exportType = this.currentView === 'group' ? 'group' : 'user';
        
        await API.stats.export(
          exportType, 
          type, 
          this.dateRange.start, 
          this.dateRange.end
        );
        
        UTILS.showAlert('통계 데이터가 다운로드됩니다.', 'success');
      } catch (error) {
        console.error('통계 내보내기 오류:', error);
        UTILS.showAlert('통계 내보내기 중 오류가 발생했습니다.', 'danger');
      }
    }
  };