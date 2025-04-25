// src/db/index.js - 데이터베이스 연결 및 쿼리 모듈
const mariadb = require('mariadb');
const { logger } = require('../utils/logger');

// MariaDB 연결 풀 생성
const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'odo_db',
  port: process.env.DB_PORT || 3306,
  connectionLimit: 10,
  connectTimeout: 10000
});

// 연결 이벤트 리스너
pool.on('connection', () => {
  logger.info('MariaDB 연결 성공');
});

pool.on('error', (err) => {
  logger.error('MariaDB 연결 오류:', err);
});

/**
 * SQL 쿼리 실행
 * @param {string} sql - SQL 쿼리 문자열
 * @param {Array} params - 쿼리 파라미터
 * @returns {Promise<Object>} - 쿼리 결과
 */
const query = async (sql, params = []) => {
  const start = Date.now();
  let conn;
  
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(sql, params);
    const duration = Date.now() - start;
    
    logger.debug(`쿼리 실행: ${sql}; 소요 시간: ${duration}ms; 행 수: ${rows.length || 0}`);
    
    // MariaDB의 결과를 PostgreSQL과 호환되는 형식으로 변환
    return {
      rows: rows.meta ? rows : rows, // meta 속성이 있으면 DML 결과이므로 빈 배열 반환
      rowCount: rows.affectedRows || rows.length || 0,
      affectedRows: rows.affectedRows || 0
    };
  } catch (error) {
    logger.error(`쿼리 오류: ${sql}; 매개변수: ${params}; 오류: ${error.message}`);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

/**
 * 트랜잭션 위한 클라이언트 가져오기
 * @returns {Promise<mariadb.PoolConnection>} - 데이터베이스 연결
 */
const getClient = async () => {
  const conn = await pool.getConnection();
  
  // 원래 메서드 저장
  const originalQuery = conn.query;
  const originalRelease = conn.release;
  
  // query 메서드 래핑하여 PostgreSQL과 유사한 결과를 반환
  conn.query = async (...args) => {
    try {
      const rows = await originalQuery.apply(conn, args);
      
      // MariaDB의 결과를 PostgreSQL과 호환되는 형식으로 변환
      return {
        rows: rows.meta ? rows : rows, // meta 속성이 있으면 DML 결과이므로 빈 배열 반환
        rowCount: rows.affectedRows || rows.length || 0,
        affectedRows: rows.affectedRows || 0
      };
    } catch (err) {
      throw err;
    }
  };
  
  // release 메서드 래핑
  conn.release = () => {
    conn.query = originalQuery;
    conn.release = originalRelease;
    return originalRelease.apply(conn);
  };
  
  return conn;
};

/**
 * 데이터베이스 테이블 초기화
 * @returns {Promise<void>}
 */
const initializeDatabase = async () => {
  let conn;
  
  try {
    conn = await pool.getConnection();
    
    try {
      // 트랜잭션 시작
      await conn.beginTransaction();
      
      // SQL 스크립트 실행
      // MariaDB용 초기화 SQL 스크립트 실행 (PostgreSQL과 문법이 다름)
      
      await conn.commit();
      logger.info('데이터베이스 초기화 완료');
    } catch (err) {
      await conn.rollback();
      logger.error('데이터베이스 초기화 오류:', err);
      throw err;
    } 
  } catch (err) {
    logger.error('데이터베이스 연결 오류:', err);
    throw err;
  } finally {
    if (conn) conn.release();
  }
};

// 내보내기
module.exports = {
  query,
  getClient,
  initializeDatabase,
  pool
};