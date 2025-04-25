// utils.js - 유틸리티 함수
const UTILS = {
    // 날짜 형식 포맷팅 (YYYY-MM-DD)
    formatDate(date) {
      if (!date) return '';
      
      if (typeof date === 'string') {
        date = new Date(date);
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    },
    
    // 날짜 형식 포맷팅 (YYYY.MM.DD)
    formatDateDot(date) {
      if (!date) return '';
      
      if (typeof date === 'string') {
        date = new Date(date);
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}.${month}.${day}`;
    },
    
    // 날짜 및 시간 형식 포맷팅 (YYYY-MM-DD HH:MM)
    formatDateTime(dateTime) {
      if (!dateTime) return '';
      
      if (typeof dateTime === 'string') {
        dateTime = new Date(dateTime);
      }
      
      const year = dateTime.getFullYear();
      const month = String(dateTime.getMonth() + 1).padStart(2, '0');
      const day = String(dateTime.getDate()).padStart(2, '0');
      const hours = String(dateTime.getHours()).padStart(2, '0');
      const minutes = String(dateTime.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    },
    
    // 시간 형식 포맷팅 (MM:SS)
    formatTime(seconds) {
      if (!seconds || isNaN(seconds)) return '00:00';
      
      const minutes = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      
      return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    },
    
    // 분 형식화 (시간:분)
    formatMinutes(minutes) {
      if (!minutes || isNaN(minutes)) return '0분';
      
      if (minutes < 60) {
        return `${minutes}분`;
      } else {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
      }
    },
    
    // 현재 월의 첫날
    getFirstDayOfMonth() {
      const date = new Date();
      return new Date(date.getFullYear(), date.getMonth(), 1);
    },
    
    // 현재 월의 마지막날
    getLastDayOfMonth() {
      const date = new Date();
      return new Date(date.getFullYear(), date.getMonth() + 1, 0);
    },
    
    // n일 전 날짜
    getDaysAgo(days) {
      const date = new Date();
      date.setDate(date.getDate() - days);
      return date;
    },
    
    // 해당 월의 일수
    getDaysInMonth(year, month) {
      return new Date(year, month + 1, 0).getDate();
    },
    
    // 주의 첫날
    getFirstDayOfWeek(date = new Date()) {
      const day = date.getDay(); // 0: 일요일, 6: 토요일
      const diff = date.getDate() - day;
      return new Date(date.setDate(diff));
    },
    
    // 알림 표시
    showAlert(message, type = 'success', duration = 3000) {
      const alertContainer = document.getElementById('alert-container');
      const alertContent = document.getElementById('alert-content');
      
      // 알림 설정
      alertContent.textContent = message;
      alertContent.className = `alert alert-${type}`;
      
      // 알림 표시
      alertContainer.style.display = 'block';
      
      // 일정 시간 후 알림 숨기기
      setTimeout(() => {
        alertContainer.style.display = 'none';
      }, duration);
    },
    
    // 로딩 표시
    showLoading() {
      document.getElementById('loading-overlay').style.display = 'flex';
    },
    
    // 로딩 숨기기
    hideLoading() {
      document.getElementById('loading-overlay').style.display = 'none';
    },
    
    // HTML 문자열을 DOM 요소로 변환
    createElementFromHTML(htmlString) {
      const div = document.createElement('div');
      div.innerHTML = htmlString.trim();
      return div.firstChild;
    },
    
    // 요소 비우기
    emptyElement(element) {
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
    },
    
    // 페이지네이션 렌더링
    renderPagination(container, currentPage, totalPages, onPageChange) {
      this.emptyElement(container);
      
      if (totalPages <= 1) return;
      
      const ul = document.createElement('ul');
      ul.className = 'pagination';
      
      // 이전 버튼
      const prevLi = document.createElement('li');
      prevLi.className = `page-item ${currentPage <= 1 ? 'disabled' : ''}`;
      
      const prevLink = document.createElement('a');
      prevLink.className = 'page-link';
      prevLink.href = '#';
      prevLink.setAttribute('aria-label', '이전');
      prevLink.innerHTML = '<span aria-hidden="true">&laquo;</span>';
      
      if (currentPage > 1) {
        prevLink.addEventListener('click', (e) => {
          e.preventDefault();
          onPageChange(currentPage - 1);
        });
      }
      
      prevLi.appendChild(prevLink);
      ul.appendChild(prevLi);
      
      // 페이지 번호
      const maxPages = 5; // 표시할 최대 페이지 수
      const halfMaxPages = Math.floor(maxPages / 2);
      
      let startPage = Math.max(1, currentPage - halfMaxPages);
      let endPage = Math.min(totalPages, startPage + maxPages - 1);
      
      if (endPage - startPage + 1 < maxPages) {
        startPage = Math.max(1, endPage - maxPages + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
        
        const pageLink = document.createElement('a');
        pageLink.className = 'page-link';
        pageLink.href = '#';
        pageLink.textContent = i;
        
        if (i !== currentPage) {
          pageLink.addEventListener('click', (e) => {
            e.preventDefault();
            onPageChange(i);
          });
        }
        
        pageLi.appendChild(pageLink);
        ul.appendChild(pageLi);
      }
      
      // 다음 버튼
      const nextLi = document.createElement('li');
      nextLi.className = `page-item ${currentPage >= totalPages ? 'disabled' : ''}`;
      
      const nextLink = document.createElement('a');
      nextLink.className = 'page-link';
      nextLink.href = '#';
      nextLink.setAttribute('aria-label', '다음');
      nextLink.innerHTML = '<span aria-hidden="true">&raquo;</span>';
      
      if (currentPage < totalPages) {
        nextLink.addEventListener('click', (e) => {
          e.preventDefault();
          onPageChange(currentPage + 1);
        });
      }
      
      nextLi.appendChild(nextLink);
      ul.appendChild(nextLi);
      
      container.appendChild(ul);
    },
    
    // URL 쿼리 파라미터 추출
    getQueryParams() {
      const params = {};
      const queryString = window.location.search.substring(1);
      const pairs = queryString.split('&');
      
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i].split('=');
        if (pair[0]) {
          params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
        }
      }
      
      return params;
    },
    
    // 달력 월 이름
    getMonthNames() {
      return ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    },
    
    // 달력 요일 이름
    getDayNames() {
      return ['일', '월', '화', '수', '목', '금', '토'];
    },
    
    // 텍스트 줄임표
    truncateText(text, maxLength) {
      if (!text) return '';
      
      if (text.length <= maxLength) {
        return text;
      }
      
      return text.substring(0, maxLength) + '...';
    },
    
    // 권한 확인 (로컬 권한 체크)
    hasPermission(permission) {
      try {
        const userInfo = JSON.parse(localStorage.getItem(CONFIG.USER_INFO_KEY) || '{}');
        
        if (!userInfo || !userInfo.permissions || !Array.isArray(userInfo.permissions)) {
          return false;
        }
        
        return userInfo.permissions.includes(permission);
      } catch (e) {
        console.error('권한 확인 오류:', e);
        return false;
      }
    },
    
    // CSV 파일 다운로드
    downloadCSV(data, filename = 'download.csv') {
      const csvContent = 'data:text/csv;charset=utf-8,' + data;
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    
    // 객체 배열에서 CSV 생성
    objectToCSV(objArray) {
      if (objArray.length === 0) return '';
      
      const fields = Object.keys(objArray[0]);
      const header = fields.join(',');
      
      const rows = objArray.map(obj => {
        return fields.map(field => {
          const value = obj[field] === null || obj[field] === undefined ? '' : obj[field];
          // 쉼표, 줄바꿈, 쌍따옴표 처리
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',');
      });
      
      return [header, ...rows].join('\n');
    }
  };