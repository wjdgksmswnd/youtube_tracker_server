// src/controllers/admin.js - 관리자 컨트롤러
const path = require('path');
const db = require('../db');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * 슈퍼유저 생성 - localhost에서만 접근 가능
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
async function createSuperUser(req, res, next) {
  const client = await db.getClient();
  
  try {
    const { user_id, username, password } = req.body;
    
    logger.info('슈퍼유저 생성 요청:', { user_id, username, body_type: typeof req.body });
    
    // 필수 필드 확인
    if (!user_id || !username || !password) {
      return res.redirect('/api/admin/su?error=사용자 ID, 이름, 비밀번호가 필요합니다');
    }
    
    await client.query('BEGIN');
    
    // 사용자 ID 중복 확인
    const userCheck = await client.query('SELECT uuid FROM "user" WHERE user_id = $1', [user_id]);
    if (userCheck.rows.length > 0) {
      return res.redirect(`/api/admin/su?error=이미 사용 중인 사용자 ID입니다: ${user_id}`);
    }
    
    // 최고 관리자 레벨 ID 조회
    const levelQuery = await client.query('SELECT id FROM "level" WHERE level_name = $1', ['최고 관리자']);
    const levelId = levelQuery.rows.length > 0 ? levelQuery.rows[0].id : 1; // 기본값 1
    
    // PostgreSQL 내장 함수로 비밀번호 암호화 및 슈퍼유저 생성
    const result = await client.query(`
      INSERT INTO "user" (user_id, username, password, level_id)
      VALUES ($1, $2, crypt($3, gen_salt('bf', 10)), $4)
      RETURNING uuid, user_id, username, level_id, created_at
    `, [user_id, username, password, levelId]);
    
    await client.query('COMMIT');
    
    // JSON 요청인 경우 (API 호출)
    if (req.get('content-type') === 'application/json') {
      return res.status(201).json({
        message: '슈퍼유저가 생성되었습니다',
        user: result.rows[0]
      });
    }
    
    // 폼 제출인 경우 (웹 브라우저)
    return res.redirect(`/api/admin/su?success=true&user_id=${user_id}`);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('슈퍼유저 생성 오류:', err);
    
    let errorMsg = '서버 오류가 발생했습니다';
    if (err.code === '23505') { // 중복 키 오류
      errorMsg = '이미 사용 중인 ID입니다';
    }
    
    // JSON 요청인 경우 (API 호출)
    if (req.get('content-type') === 'application/json') {
      return next(new AppError(errorMsg, err.code === '23505' ? 409 : 500));
    }
    
    // 폼 제출인 경우 (웹 브라우저)
    return res.redirect(`/api/admin/su?error=${encodeURIComponent(errorMsg)}`);
  } finally {
    client.release();
  }
}

/**
 * 슈퍼유저 관리 페이지 제공 - localhost에서만 접근 가능
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 */
const getSuperUserPage = (req, res) => {
// HTML 형식으로 슈퍼유저 생성 페이지 제공 (단순화된 버전)
res.send(`
  <!DOCTYPE html>
  <html lang="ko">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>슈퍼유저 관리</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      h1 {
        color: #4285f4;
      }
      .form-group {
        margin-bottom: 15px;
      }
      label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
      }
      input {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-sizing: border-box;
      }
      button {
        background-color: #4285f4;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 4px;
        cursor: pointer;
      }
      button:hover {
        background-color: #3367d6;
      }
      .message {
        margin-top: 20px;
        padding: 15px;
        border-radius: 4px;
      }
      .success {
        background-color: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
      }
      .error {
        background-color: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
      }
    </style>
  </head>
  <body>
    <h1>슈퍼유저 생성</h1>
    <p>이 페이지는 localhost에서만 접근할 수 있습니다.</p>
    
    ${req.query.success ? 
      `<div class="message success">
        <h3>슈퍼유저가 성공적으로 생성되었습니다!</h3>
        <p>사용자 ID: ${req.query.user_id || ''}</p>
       </div>` 
      : ''}
      
    ${req.query.error ? 
      `<div class="message error">
        <h3>오류가 발생했습니다</h3>
        <p>${req.query.error}</p>
       </div>` 
      : ''}
    
    <form method="POST" action="/api/admin/su/create">
      <div class="form-group">
        <label for="user_id">사용자 ID</label>
        <input type="text" id="user_id" name="user_id" required>
      </div>
      
      <div class="form-group">
        <label for="username">이름</label>
        <input type="text" id="username" name="username" required>
      </div>
      
      <div class="form-group">
        <label for="password">비밀번호</label>
        <input type="password" id="password" name="password" required>
      </div>
      
      <button type="submit">슈퍼유저 생성</button>
    </form>
    
    <p style="margin-top: 20px;">
      <a href="/api/admin">← 관리자 홈으로 돌아가기</a>
    </p>
  </body>
  </html>
`);
};

module.exports = {
  createSuperUser,
  getSuperUserPage
};