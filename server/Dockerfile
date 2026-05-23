# 后端 Dockerfile
FROM node:20-alpine

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json ./
RUN npm ci --production

# 复制源码
COPY . .

# 创建上传目录
RUN mkdir -p uploads/labels

EXPOSE 3001

CMD ["node", "index.js"]
