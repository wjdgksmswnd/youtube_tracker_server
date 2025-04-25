// config.js - 환경 설정 및 상수
const CONFIG = {
    // API 서버 URL (개발/프로덕션 환경)
    API_URL: location.hostname === 'localhost' ? 'http://localhost:8080/api' : 'https://odo.ist/api',
    
    // 앱 버전
    VERSION: '2.0.0',
    
    // 디버그 모드
    DEBUG: false,
    
    // 토큰 저장소 키
    TOKEN_KEY: 'token',
    
    // 세션 키
    SESSION_KEY: 'sessionId',
    
    // 사용자 정보 키
    USER_INFO_KEY: 'user_info',
    
    // 권한 정의
    PERMISSIONS: {
      // 대시보드
      DASHBOARD_VIEW: 'dashboard.view',
      
      // 청취 기록
      HISTORY_VIEW: 'history.view',
      
      // 그룹
      GROUP_VIEW: 'group.view',
      GROUP_REPORT: 'group.report',
      GROUP_USER_MANAGE: 'group.user.manage',
      
      // 그룹 관리
      GROUP_ADMIN: 'group.admin',
      GROUP_CREATE: 'group.create',
      GROUP_EDIT: 'group.edit',
      
      // 사용자 관리
      USER_ADMIN: 'user.admin',
      USER_CREATE: 'user.create',
      USER_LEVEL: 'user.level',
      USER_GROUP: 'user.group',
      
      // 통계
      STATS_VIEW: 'stats.view',
      STATS_EXPORT: 'stats.export',
      
      // 플레이리스트 관리
      PLAYLIST_ADMIN: 'playlist.admin',
      PLAYLIST_CREATE: 'playlist.create',
      PLAYLIST_EDIT: 'playlist.edit',
      PLAYLIST_DELETE: 'playlist.delete'
    },
    
    // 탭 정의
    TABS: [
      {
        id: 'dashboard',
        title: '대시보드',
        permission: 'dashboard.view',
        icon: 'fas fa-home',
        default: true
      },
      {
        id: 'history',
        title: '청취 기록',
        permission: 'history.view',
        icon: 'fas fa-history'
      },
      {
        id: 'group',
        title: '그룹',
        permission: 'group.view',
        icon: 'fas fa-users'
      },
      {
        id: 'group-admin',
        title: '그룹 관리',
        permission: 'group.admin',
        icon: 'fas fa-user-cog'
      },
      {
        id: 'user-admin',
        title: '사용자 관리',
        permission: 'user.admin',
        icon: 'fas fa-user-shield'
      },
      {
        id: 'stats',
        title: '통계',
        permission: 'stats.view',
        icon: 'fas fa-chart-bar'
      },
      {
        id: 'playlist-admin',
        title: '플레이리스트 관리',
        permission: 'playlist.admin',
        icon: 'fas fa-music'
      }
    ],
    
    // 대시보드 새로고침 간격 (밀리초)
    DASHBOARD_REFRESH_INTERVAL: 60 * 1000, // 1분
    
    // 차트 색상
    CHART_COLORS: {
      primary: '#4285f4',
      secondary: '#34a853',
      warning: '#fbbc05',
      danger: '#ea4335',
      light: 'rgba(66, 133, 244, 0.1)'
    }
  };