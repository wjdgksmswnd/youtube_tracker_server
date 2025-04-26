// login.js - 로그인 페이지 스크립트
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM 로드됨');
  // DOM 요소
  const loginForm = document.getElementById('login-form');
  console.log('loginForm:', loginForm);
  const loginAlert = document.getElementById('login-alert');
  const loadingOverlay = document.getElementById('loading-overlay');
  console.log('loadingOverlay:', loadingOverlay);
  const devModeToggle = document.getElementById('dev-mode-toggle');
  
  // 초기화
  console.log('초기화 시작');
  init();
  
  function init() {
    console.log('init 함수 시작');
    // 로딩 숨기기
    hideLoading();
    console.log('hideLoading 완료');
    
    // 개발 모드 설정 로드
    loadDevModeSetting();
    console.log('개발 모드 설정 로드 완료');
    
    // 이미 로그인된 경우 대시보드로 이동
    checkLoginStatus();
    console.log('로그인 상태 확인 완료');
    
    // 이벤트 리스너 설정
    loginForm.addEventListener('submit', handleLogin);
    // devModeToggle.addEventListener('change', toggleDevMode);
    console.log('이벤트 리스너 설정 완료');
  }
    
    // 로그인 상태 확인
    function checkLoginStatus() {
      const token = localStorage.getItem(CONFIG.TOKEN_KEY);
      if (token) {
        // 토큰 검증 후 대시보드로 이동
        verifyToken(token);
      }
    }
    
    // 토큰 검증
    async function verifyToken(token) {
      try {
        showLoading();
        
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/user/verify`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          // 토큰이 유효하면 대시보드로 이동
          window.location.href = 'dashboard.html';
        } else {
          // 토큰이 유효하지 않으면 제거
          localStorage.removeItem(CONFIG.TOKEN_KEY);
          localStorage.removeItem(CONFIG.SESSION_KEY);
          hideLoading();
        }
      } catch (error) {
        console.error('토큰 검증 오류:', error);
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem(CONFIG.SESSION_KEY);
        hideLoading();
      }
    }
    
    // 로그인 처리
    async function handleLogin(e) {
      e.preventDefault();
      
      const userId = document.getElementById('userId').value;
      const password = document.getElementById('password').value;
      
      if (!userId || !password) {
        showLoginError('아이디와 비밀번호를 모두 입력해주세요.');
        return;
      }
      
      try {
        showLoading();
        
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ user_id: userId, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // 토큰 저장
          localStorage.setItem(CONFIG.TOKEN_KEY, data.token);
          
          // 사용자 정보 저장
          if (data.user) {
            localStorage.setItem(CONFIG.USER_INFO_KEY, JSON.stringify(data.user));
          }
          
          // 세션 생성 요청
          await createSession(data.token);
          
          // 대시보드로 이동
          window.location.href = 'dashboard.html';
        } else {
          hideLoading();
          showLoginError(data.error || '로그인에 실패했습니다.');
        }
      } catch (error) {
        console.error('로그인 오류:', error);
        hideLoading();
        showLoginError('서버 연결에 실패했습니다.');
      }
    }
    
    // 세션 생성
    async function createSession(token) {
      try {
        // 기기 정보 수집
        const deviceInfo = {
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        };
        
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ device_info: deviceInfo })
        });
        
        const data = await response.json();
        
        if (response.ok && data.sessionId) {
          localStorage.setItem(CONFIG.SESSION_KEY, data.sessionId);
          console.log('세션 생성 성공:', data.sessionId);
        }
      } catch (error) {
        console.error('세션 생성 오류:', error);
      }
    }
    
    // 개발 모드 설정 로드
    function loadDevModeSetting() {
      const devMode = localStorage.getItem('dev_mode') === 'false'? false : true;
      // devModeToggle.checked = devMode;
      console.log('개발 모드:', devMode ? '활성화' : '비활성화');
    }
    
    // 개발 모드 토글
    function toggleDevMode() {
      const enabled = devModeToggle.checked;
      localStorage.setItem('dev_mode', enabled);
      console.log('개발 모드 변경:', enabled ? '활성화' : '비활성화');
    }
    
    // API URL 가져오기
    function getApiUrl() {
      const devMode = localStorage.getItem('dev_mode') === 'false'? false : true;
      return devMode ? 'http://localhost:8080/api' : 'https://odo.ist/api';
    }
    
    // 로그인 오류 표시
    function showLoginError(message) {
      loginAlert.textContent = message;
      loginAlert.style.display = 'block';
      
      // 3초 후 오류 메시지 숨기기
      setTimeout(() => {
        loginAlert.style.display = 'none';
      }, 3000);
    }
    
    // 로딩 표시
    function showLoading() {
      // loadingOverlay.style.display = 'flex';
    }
    
    // 로딩 숨기기
    function hideLoading() {
      // loadingOverlay.style.display = 'none';
    }
  });