FROM node:22-alpine AS base
WORKDIR /app

# ffmpeg for audio splitting, chromium for PDF export, psql for init.sql
RUN apk add --no-cache ffmpeg chromium nss freetype harfbuzz ca-certificates ttf-freefont postgresql-client
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Generate Prisma client (after all files are copied)
RUN npx prisma generate

# Development stage
FROM base AS development
RUN chmod +x /app/entrypoint.sh
CMD ["/app/entrypoint.sh"]

# Build stage
FROM base AS build
RUN npm run build

# Production stage
FROM node:22-alpine AS production
RUN apk add --no-cache postgresql-client
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/prisma ./prisma
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
