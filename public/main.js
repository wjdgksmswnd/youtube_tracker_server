// main.js - 메인 애플리케이션 스크립트
document.addEventListener('DOMContentLoaded', function() {
    // 앱 상태
    const state = {
      currentTab: null,
      user: null,
      tabModules: {},
      accessibleTabs: []
    };
    
    // 초기화
    init();
    
    // 초기화 함수
    async function init() {
      try {
        UTILS.showLoading();
        
        // 토큰 확인
        const token = localStorage.getItem(CONFIG.TOKEN_KEY);
        if (!token) {
          window.location.href = '/index.html';
          return;
        }
        
        // 토큰 검증
        await verifyToken();
        
        // 접근 가능한 탭 로드
        await loadAccessibleTabs();
        
        // 네비게이션 바 초기화
        initNavbar();
        
        // 로그아웃 버튼 이벤트 리스너
        document.getElementById('logout-btn').addEventListener('click', handleLogout);
        
        // URL 해시에서 탭 확인
        const hashTab = window.location.hash.substring(1);
        let initialTab = null;
        
        if (hashTab && state.accessibleTabs.includes(hashTab)) {
          initialTab = hashTab;
        } else {
          // 기본 탭 찾기 (첫 번째 접근 가능한 탭)
          initialTab = state.accessibleTabs[0] || 'dashboard';
        }
        
        // 초기 탭 활성화
        switchTab(initialTab);
        
        // URL 해시 변경 이벤트 리스너
        window.addEventListener('hashchange', function() {
          const newTab = window.location.hash.substring(1);
          if (newTab && state.accessibleTabs.includes(newTab)) {
            switchTab(newTab);
          }
        });
        
        UTILS.hideLoading();
      } catch (error) {
        console.error('초기화 오류:', error);
        UTILS.showAlert('초기화 중 오류가 발생했습니다: ' + error.message, 'danger');
        UTILS.hideLoading();
        
        // 오류 발생 시 로그인 페이지로 이동
        setTimeout(() => {
          window.location.href = '/index.html';
        }, 2000);
      }
    }
    
    // 토큰 검증
    async function verifyToken() {
      try {
        const response = await API.user.verify();
        
        if (response && response.user) {
          state.user = response.user;
          
          // 사용자 이름 표시
          document.getElementById('username-display').textContent = state.user.username;
          
          // 사용자 정보 로컬 스토리지에 저장
          localStorage.setItem(CONFIG.USER_INFO_KEY, JSON.stringify(state.user));
          
          return true;
        }
        
        return false;
      } catch (error) {
        console.error('토큰 검증 오류:', error);
        throw error;
      }
    }
    
    // 접근 가능한 탭 로드
    async function loadAccessibleTabs() {
      try {
        // 서버에서 접근 가능한 탭 목록 가져오기
        const response = await API.tabs.getAccessible();
        
        if (response && response.tabs) {
          state.accessibleTabs = response.tabs.map(tab => tab.id);
        } else {
          // 기본 탭만 접근 허용
          state.accessibleTabs = ['dashboard', 'history'];
        }
        
        return state.accessibleTabs;
      } catch (error) {
        console.error('탭 로드 오류:', error);
        
        // 오류 시 기본 탭만 허용
        state.accessibleTabs = ['dashboard', 'history'];
        return state.accessibleTabs;
      }
    }
    
    // 네비게이션 바 초기화
    function initNavbar() {
      const navTabsContainer = document.getElementById('nav-tabs');
      UTILS.emptyElement(navTabsContainer);
      
      // 설정된 탭 목록 순회
      CONFIG.TABS.forEach(tab => {
        // 접근 권한 확인
        if (state.accessibleTabs.includes(tab.id)) {
          const li = document.createElement('li');
          li.className = 'nav-item';
          
          const a = document.createElement('a');
          a.className = 'nav-link';
          a.href = `#${tab.id}`;
          a.dataset.tab = tab.id;
          
          if (tab.icon) {
            a.innerHTML = `<i class="${tab.icon} me-1"></i> ${tab.title}`;
          } else {
            a.textContent = tab.title;
          }
          
          li.appendChild(a);
          navTabsContainer.appendChild(li);
        }
      });
    }
    
    // 탭 전환
    function switchTab(tabId) {
      // 현재 탭과 같으면 무시
      if (state.currentTab === tabId) return;
      
      // 모든 탭 링크 비활성화
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
      });
      
      // 선택한 탭 링크 활성화
      const tabLink = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
      if (tabLink) {
        tabLink.classList.add('active');
      }
      
      // 탭 컨텐츠 로드
      loadTabContent(tabId);
      
      // 현재 탭 업데이트
      state.currentTab = tabId;
      
      // URL 해시 업데이트
      if (window.location.hash !== `#${tabId}`) {
        history.pushState(null, null, `#${tabId}`);
      }
    }
    
    // 탭 컨텐츠 로드
    function loadTabContent(tabId) {
      const contentContainer = document.getElementById('main-content');
      UTILS.emptyElement(contentContainer);
      
      // 각 탭에 해당하는 모듈 로드
      try {
        switch (tabId) {
          case 'dashboard':
            DashboardTab.initialize(contentContainer);
            break;
            
          case 'history':
            HistoryTab.initialize(contentContainer);
            break;
            
          case 'group':
            GroupTab.initialize(contentContainer);
            break;
            
          case 'group-admin':
            GroupAdminTab.initialize(contentContainer);
            break;
            
          case 'user-admin':
            UserAdminTab.initialize(contentContainer);
            break;
            
          case 'stats':
            StatsTab.initialize(contentContainer);
            break;
            
          case 'playlist-admin':
            PlaylistAdminTab.initialize(contentContainer);
            break;
            
          default:
            // 알 수 없는 탭의 경우 대시보드로 이동
            DashboardTab.initialize(contentContainer);
            break;
        }
      } catch (error) {
        console.error(`${tabId} 탭 로드 오류:`, error);
        contentContainer.innerHTML = `
          <div class="alert alert-danger my-4">
            <h4 class="alert-heading">오류</h4>
            <p>탭을 로드하는 중 오류가 발생했습니다: ${error.message}</p>
          </div>
        `;
      }
    }
    
    // 로그아웃 처리
    async function handleLogout() {
      try {
        UTILS.showLoading();
        
        // 세션 종료 요청
        const sessionId = localStorage.getItem(CONFIG.SESSION_KEY);
        if (sessionId) {
          try {
            await API.request('/session', {
              method: 'DELETE',
              headers: {
                'X-Session-ID': sessionId
              }
            });
          } catch (error) {
            console.error('세션 종료 오류:', error);
          }
        }
        
        // 로컬 스토리지 정리
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem(CONFIG.SESSION_KEY);
        localStorage.removeItem(CONFIG.USER_INFO_KEY);
        
        // 로그인 페이지로 이동
        window.location.href = '/index.html';
      } catch (error) {
        console.error('로그아웃 오류:', error);
        UTILS.hideLoading();
        UTILS.showAlert('로그아웃 중 오류가 발생했습니다.', 'danger');
      }
    }
  });