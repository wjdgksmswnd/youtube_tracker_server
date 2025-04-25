FROM node:16

WORKDIR /app

# 의존성 파일 복사 및 설치
COPY package*.json ./
RUN npm install

# 소스 코드 복사
COPY . .

# 포트 설정
EXPOSE 8080
ENV PORT=8080

# 실행 명령
CMD ["node", "server.js"]