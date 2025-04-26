// history.js - 청취 기록 탭
const HistoryTab = {
    // 초기화
    initialize(container) {
      this.container = container;
      this.currentPage = 1;
      this.totalPages = 1;
      this.pageSize = 20;
      
      // 현재 날짜 기준 월 설정
      const today = new Date();
      this.currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      
      this.render();
      this.loadData();
    },
    
    // 렌더링
    render() {
      this.container.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div class="d-flex justify-content-between align-items-center">
              <span>청취 기록</span>
              <div class="d-flex gap-2">
                <input type="month" class="form-control form-control-sm" id="history-month" value="${this.currentMonth}">
                <button class="btn btn-sm btn-primary" id="history-search">검색</button>
              </div>
            </div>
          </div>
          <div class="card-body p-0">
            <div id="track-list-container">
              <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">로딩 중...</span>
                </div>
              </div>
            </div>
            <div class="d-flex justify-content-center py-3">
              <nav>
                <ul class="pagination" id="history-pagination"></ul>
              </nav>
            </div>
          </div>
        </div>
      `;
      
      // 이벤트 리스너 설정
      this.container.querySelector('#history-search').addEventListener('click', () => {
        this.currentMonth = this.container.querySelector('#history-month').value;
        this.currentPage = 1;
        this.loadData();
      });
    },
    
    // 데이터 로드
    async loadData() {
      try {
        // 로딩 표시
        this.container.querySelector('#track-list-container').innerHTML = `
          <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">로딩 중...</span>
            </div>
          </div>
        `;
        
        // 월 기간 계산
        const [year, month] = this.currentMonth.split('-');
        const daysInMonth = UTILS.getDaysInMonth(parseInt(year), parseInt(month) - 1);
        
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-${daysInMonth.toString().padStart(2, '0')}`;
        
        // 청취 기록 불러오기
        const response = await API.listening.getHistory({
          start_date: startDate,
          end_date: endDate,
          page: this.currentPage,
          limit: this.pageSize
        });
        
        // 데이터 렌더링
        this.renderTrackList(response.tracks);
        
        // 페이지네이션 업데이트
        this.totalPages = response.total_pages || 1;
        this.renderPagination();
      } catch (error) {
        console.error('청취 기록 로드 오류:', error);
        
        this.container.querySelector('#track-list-container').innerHTML = `
          <div class="alert alert-danger m-3">
            데이터를 불러오는 중 오류가 발생했습니다: ${error.message}
          </div>
        `;
      }
    },
    
    // 트랙 목록 렌더링
    renderTrackList(tracks) {
      const container = this.container.querySelector('#track-list-container');
      
      // 컨테이너 초기화
      container.innerHTML = '';
      
      if (!tracks || tracks.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-muted">해당 기간에 기록이 없습니다.</div>';
        return;
      }
      
      // 테이블 생성
      const table = document.createElement('table');
      table.className = 'table table-hover';
      
      // 테이블 헤더
      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr>
          <th>제목</th>
          <th>아티스트</th>
          <th>재생 시간</th>
          <th>재생 시작</th>
          <th>실제 재생</th>
        </tr>
      `;
      
      // 테이블 바디
      const tbody = document.createElement('tbody');
      
      tracks.forEach(track => {
        // 재생 시간 계산
        const duration = UTILS.formatTime(track.duration_seconds);
        const actualDuration = track.actual_duration_seconds 
          ? UTILS.formatTime(track.actual_duration_seconds) 
          : duration;
        
        // 재생 시작 시간 형식화
        const listenedAt = UTILS.formatDateTime(track.listened_at);
        
        // 행 생성
        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="text-truncate" style="max-width: 200px;">${track.title}</td>
          <td>${track.artist || '-'}</td>
          <td>${duration}</td>
          <td>${listenedAt}</td>
          <td>${actualDuration}</td>
        `;
        
        tbody.appendChild(row);
      });
      
      // 테이블 조립
      table.appendChild(thead);
      table.appendChild(tbody);
      container.appendChild(table);
    },
    
    // 페이지네이션 렌더링
    renderPagination() {
      const paginationContainer = this.container.querySelector('#history-pagination');
      
      // 페이지네이션 렌더링
      UTILS.renderPagination(
        paginationContainer,
        this.currentPage,
        this.totalPages,
        (page) => {
          this.currentPage = page;
          this.loadData();
          
          // 스크롤 맨 위로
          window.scrollTo(0, 0);
        }
      );
    }
  };