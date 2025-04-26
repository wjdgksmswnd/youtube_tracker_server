// dashboard.js - 대시보드 탭
const DashboardTab = {
    // 초기화
    initialize(container) {
      this.container = container;
      this.chartInstance = null;
      this.currentPeriodType = 'monthly'; // 'monthly', 'weekly', 'daily'
      this.currentPeriod = this.getCurrentPeriod('monthly');
  
      this.render();
      this.loadData();
  
      // 주기적 데이터 갱신
      this.refreshTimer = setInterval(() => {
        this.loadData();
      }, CONFIG.DASHBOARD_REFRESH_INTERVAL);
    },
  
    // 정리
    destroy() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
  
      if (this.chartInstance) {
        this.chartInstance.destroy();
        this.chartInstance = null;
      }
    },
  
    // 현재 날짜 기반 기간 계산
    getCurrentPeriod(periodType) {
      const today = new Date();
  
      switch (periodType) {
        case 'monthly':
          return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
        case 'weekly':
          const firstDayOfWeek = UTILS.getFirstDayOfWeek(today);
          return UTILS.formatDate(firstDayOfWeek);
  
        case 'daily':
          return UTILS.formatDate(today);
  
        default:
          return UTILS.formatDate(today);
      }
    },
  
    // 렌더링
    render() {
      this.container.innerHTML = `
        <div class="row">
          <div class="col-md-4">
            <div class="card stat-card">
              <div class="stat-value" id="today-tracks-count">0</div>
              <div class="stat-label">오늘 들은 노래</div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card stat-card">
              <div class="stat-value" id="today-minutes">0분</div>
              <div class="stat-label">오늘 청취 시간</div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card stat-card">
              <div class="stat-value" id="total-minutes">0분</div>
              <div class="stat-label">총 누적 청취 시간</div>
            </div>
          </div>
        </div>
  
        <!-- 월간 목표 프로그레스 바 -->
        <div class="card mt-4">
          <div class="card-header">월간 목표</div>
          <div class="card-body">
            <div class="progress-container">
              <div class="progress-header">
                <span>목표 달성률: <span id="monthly-goal-percent">0%</span></span>
                <span><span id="monthly-goal-current">0</span>/<span id="monthly-goal-target">0</span>분</span>
              </div>
              <div class="progress">
                <div class="progress-bar" id="monthly-goal-progress" role="progressbar" style="width: 0%"></div>
              </div>
            </div>
            <div class="d-flex justify-content-between mt-2">
              <small class="text-muted">최소 목표: <span id="monthly-min-goal">0</span>분</small>
              <small class="text-muted">최대 인정: <span id="monthly-max-goal">0</span>분</small>
            </div>
          </div>
        </div>
  
        <!-- 차트 영역 -->
        <div class="card mt-4">
          <div class="card-header">
            <div class="d-flex justify-content-between align-items-center">
              <span>청취 시간 분석</span>
              <div class="btn-group">
                <button class="btn btn-sm btn-primary" data-period="monthly">월간</button>
                <button class="btn btn-sm btn-outline-primary" data-period="weekly">주간</button>
                <button class="btn btn-sm btn-outline-primary" data-period="daily">일간</button>
              </div>
            </div>
          </div>
          <div class="card-body">
            <div class="row mb-3">
              <div class="col">
                <select class="form-select" id="period-selector"></select>
              </div>
            </div>
            <div class="chart-container">
              <canvas id="listening-chart"></canvas>
            </div>
          </div>
        </div>
  
        <!-- 최근 스트리밍 기록 -->
        <div class="card mt-4">
          <div class="card-header">
            <div class="d-flex justify-content-between align-items-center">
              <span>최근 스트리밍 기록</span>
              <a href="#history" class="btn btn-sm btn-outline-primary">전체 기록 보기</a>
            </div>
          </div>
          <div class="card-body p-0">
            <div class="track-list" id="recent-tracks">
              <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">로딩 중...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
  
      // 기간 버튼 이벤트 리스너
      const periodButtons = this.container.querySelectorAll('[data-period]');
      periodButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          const period = e.target.dataset.period;
          this.changePeriodType(period);
        });
      });
  
      // 기간 선택기 이벤트 리스너
      const periodSelector = this.container.querySelector('#period-selector');
      periodSelector.addEventListener('change', (e) => {
        this.currentPeriod = e.target.value;
        this.loadChartData();
      });
    },
  
    // 데이터 로드
    async loadData() {
      try {
        // 요약 통계 로드
        await this.loadSummaryData();
  
        // 그룹 목표 로드
        await this.loadGoalData();
  
        // 차트 데이터 로드
        await this.loadChartData();
  
        // 최근 스트리밍 기록 로드
        await this.loadRecentTracks();
      } catch (error) {
        console.error('대시보드 데이터 로드 오류:', error);
        UTILS.showAlert('데이터 로드 중 오류가 발생했습니다.', 'danger');
      }
    },
  
    // 요약 통계 로드
    async loadSummaryData() {
      try {
        const data = await API.stats.getSummary();
  
        // 통계 업데이트
        this.container.querySelector('#today-tracks-count').textContent = data.today.tracks;
        this.container.querySelector('#today-minutes').textContent = UTILS.formatMinutes(data.today.minutes);
        this.container.querySelector('#total-minutes').textContent = UTILS.formatMinutes(data.all_time.minutes);
      } catch (error) {
        console.error('요약 통계 로드 오류:', error);
        throw error;
      }
    },
  
    // 그룹 목표 로드
    async loadGoalData() {
      try {
        // 사용자 그룹 ID 가져오기
        const userInfo = JSON.parse(localStorage.getItem(CONFIG.USER_INFO_KEY) || '{}');
        const groupId = userInfo.group_id;
  
        if (!groupId) {
          console.log('그룹 ID가 없습니다.');
          return;
        }
  
        // 그룹 정보 로드
        const groupData = await API.group.get(groupId);
  
        if (!groupData || !groupData.group) {
          console.log('그룹 정보가 없습니다.');
          return;
        }
  
        // 월간 통계 로드
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
  
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(UTILS.getDaysInMonth(year, month - 1)).padStart(2, '0')}`;
  
        const statsData = await API.stats.getDaily(startDate, endDate);
  
        if (!statsData || !statsData.stats) {
          console.log('월간 통계 데이터가 없습니다.');
          return;
        }
  
        // 월간 총 재생 시간
        const totalMinutes = statsData.stats.reduce((sum, item) => sum + item.total_minutes, 0);
  
        // 목표 진행 상황 업데이트
        const monthlyGoal = groupData.group.monthly_goal_minutes || 0;
        const monthlyMin = groupData.group.monthly_min_minutes || 0;
        const monthlyMax = groupData.group.daily_max_minutes * UTILS.getDaysInMonth(year, month - 1) || 0;
  
        // 목표 값 표시
        this.container.querySelector('#monthly-goal-target').textContent = monthlyGoal;
        this.container.querySelector('#monthly-goal-current').textContent = totalMinutes;
        this.container.querySelector('#monthly-min-goal').textContent = monthlyMin;
        this.container.querySelector('#monthly-max-goal').textContent = monthlyMax;
  
        // 진행율 계산 (최대 100%)
        const progressPercent = monthlyGoal > 0
          ? Math.min(Math.round((totalMinutes / monthlyGoal) * 100), 100)
          : 0;
  
        this.container.querySelector('#monthly-goal-percent').textContent = progressPercent + '%';
        this.container.querySelector('#monthly-goal-progress').style.width = progressPercent + '%';
  
        // 목표 달성 상태에 따라 색상 변경
        const progressBar = this.container.querySelector('#monthly-goal-progress');
  
        if (totalMinutes >= monthlyGoal) {
          progressBar.className = 'progress-bar bg-success';
        } else if (totalMinutes >= monthlyMin) {
          progressBar.className = 'progress-bar bg-warning';
        } else {
          progressBar.className = 'progress-bar bg-danger';
        }
        console.log('그룹 목표 로드 완료');
      } catch (error) {
        console.error('목표 데이터 로드 오류:', error);
        throw error;
      }
    },
  
    // 기간 유형 변경
    changePeriodType(periodType) {
      // 이미 같은 기간 유형이면 무시
      if (this.currentPeriodType === periodType) return;
  
      this.currentPeriodType = periodType;
  
      // 버튼 활성화 상태 업데이트
      const buttons = this.container.querySelectorAll('[data-period]');
      buttons.forEach(button => {
        if (button.dataset.period === periodType) {
          button.classList.remove('btn-outline-primary');
          button.classList.add('btn-primary');
        } else {
          button.classList.remove('btn-primary');
          button.classList.add('btn-outline-primary');
        }
      });
  
      // 현재 기간 업데이트
      this.currentPeriod = this.getCurrentPeriod(periodType);
  
      // 선택기 옵션 업데이트
      this.updatePeriodSelector();
  
      // 차트 데이터 로드
      this.loadChartData();
    },
  
    // 기간 선택기 업데이트
    updatePeriodSelector() {
      const selector = this.container.querySelector('#period-selector');
      selector.innerHTML = '';
  
      let options = [];
  
      switch (this.currentPeriodType) {
        case 'monthly':
          // 최근 12개월 옵션
          for (let i = 0; i < 12; i++) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const label = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  
            options.push({ value: yearMonth, label });
          }
          break;
  
        case 'weekly':
          // 최근 8주 옵션
          for (let i = 0; i < 8; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (i * 7));
            const weekStarting = UTILS.getFirstDayOfWeek(date);
            const weekStart = UTILS.formatDate(weekStarting);
  
            const weekEndDate = new Date(weekStarting);
            weekEndDate.setDate(weekEndDate.getDate() + 6);
  
            const label = `${UTILS.formatDateDot(weekStarting)} ~ ${UTILS.formatDateDot(weekEndDate)}`;
  
            options.push({ value: weekStart, label });
          }
          break;
  
        case 'daily':
          // 최근 30일 옵션
          for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayDate = UTILS.formatDate(date);
            const label = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  
            options.push({ value: dayDate, label });
          }
          break;
      }
  
      options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.value;
        optionEl.textContent = option.label;
        selector.appendChild(optionEl);
      });
  
      // 첫 번째 옵션 선택
      if (options.length > 0) {
        this.currentPeriod = options[0].value;
        selector.value = this.currentPeriod;
      }
    },
  
    // 차트 데이터 로드
    async loadChartData() {
      try {
        let endpoint = '';
        let timePeriod = '';
  
        switch (this.currentPeriodType) {
          case 'monthly':
            const [year, month] = this.currentPeriod.split('-');
            const daysInMonth = UTILS.getDaysInMonth(parseInt(year), parseInt(month) - 1);
            const startDate = `${this.currentPeriod}-01`;
            const endDate = `${this.currentPeriod}-${daysInMonth.toString().padStart(2, '0')}`;
  
            const dailyData = await API.stats.getDaily(startDate, endDate);
            this.updateChart(dailyData.stats, 'daily');
            break;
  
          case 'weekly':
            const weekStartDate = new Date(this.currentPeriod);
            const weekEndDate = new Date(weekStartDate);
            weekEndDate.setDate(weekEndDate.getDate() + 6);
  
            const weeklyData = await API.stats.getDaily(
              UTILS.formatDate(weekStartDate),
              UTILS.formatDate(weekEndDate)
            );
            this.updateChart(weeklyData.stats, 'daily');
            break;
  
          case 'daily':
            const hourlyData = await API.stats.getHourly(this.currentPeriod);
            this.updateChart(hourlyData.stats, 'hourly');
            break;
        }
      } catch (error) {
        console.error('차트 데이터 로드 오류:', error);
        throw error;
      }
    },
  
    // 최근 스트리밍 기록 로드
    async loadRecentTracks() {
      try {
        const data = await API.listening.getRecent(10);
  
        const tracksContainer = this.container.querySelector('#recent-tracks');
        tracksContainer.innerHTML = '';
  
        if (!data.data || data.data.length === 0) {
          tracksContainer.innerHTML = '<div class="p-4 text-center text-muted">기록이 없습니다.</div>';
          return;
        }
  
        data.data.forEach(track => {
          const trackItem = document.createElement('div');
          trackItem.className = 'track-item p-3';
  
          // 재생 시간 형식화
          const duration = UTILS.formatTime(track.duration_seconds);
          const actualDuration = track.actual_duration_seconds ? UTILS.formatTime(track.actual_duration_seconds) : duration;
  
          // 재생 시작 시간 형식화
          const listenedAt = UTILS.formatDateTime(track.listened_at);
  
          trackItem.innerHTML = `
            <div class="track-title">${track.title}</div>
            <div class="track-artist">${track.artist}</div>
            <div class="track-meta">
              <span><i class="fas fa-calendar"></i> ${listenedAt}</span>
              <span><i class="fas fa-play"></i> ${actualDuration}/${duration}</span>
            </div>
          `;
  
          tracksContainer.appendChild(trackItem);
        });
      } catch (error) {
        console.error('최근 트랙 로드 오류:', error);
        throw error;
      }
    },
  
    // 차트 업데이트
    updateChart(statsData, dataType) {
      // 기존 차트 제거
      if (this.chartInstance) {
        this.chartInstance.destroy();
      }
  
      // 데이터 준비
      let labels = [];
      let dataset = [];
  
      if (dataType === 'daily') {
        // 일별 데이터 준비
        const dateMap = {};
  
        // 통계 데이터 맵 생성
        statsData.forEach(stat => {
          const date = new Date(stat.date);
          const day = date.getDate();
          dateMap[day] = stat.total_minutes || 0;
        });
  
        // 선택된 기간에 맞는 날짜 목록 생성
        let startDate, endDate;
  
        if (this.currentPeriodType === 'monthly') {
          const [year, month] = this.currentPeriod.split('-');
          const daysInMonth = UTILS.getDaysInMonth(parseInt(year), parseInt(month) - 1);
  
          startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
          endDate = new Date(parseInt(year), parseInt(month) - 1, daysInMonth);
        } else { // weekly
          startDate = new Date(this.currentPeriod);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 6);
        }
  
        // 날짜별 라벨 및 데이터 생성
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const day = d.getDate();
          labels.push(day + '일');
          dataset.push(dateMap[day] || 0);
        }
      } else {
        // 시간별 데이터 준비
        const hourMap = {};
  
        // 통계 데이터 맵 생성
        statsData.forEach(stat => {
          hourMap[stat.hour] = stat.total_minutes || 0;
        });
  
        // 24시간 목록 생성
        for (let i = 0; i < 24; i++) {
          const hour = i.toString().padStart(2, '0') + ':00';
          labels.push(hour);
          dataset.push(hourMap[i] || 0);
        }
      }
  
      // 차트 생성
      const ctx = this.container.querySelector('#listening-chart').getContext('2d');
      this.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: '청취 시간 (분)',
            data: dataset,
            borderColor: CONFIG.CHART_COLORS.primary,
            backgroundColor: CONFIG.CHART_COLORS.light,
            tension: 0.3,
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
              display: false
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  return context.formattedValue + '분';
                }
              }
            }
          }
        }
      });
    }
  };