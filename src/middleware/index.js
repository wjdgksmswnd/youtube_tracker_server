// src/middleware/index.js - 미들웨어 통합 모듈
const { notFound, errorHandler } = require('./error');
const { checkPermission } = require('./permission');
const { ipRestrict } = require('./ipRestrict');

module.exports = {
  notFound,
  errorHandler,
  checkPermission,
  ipRestrict
};