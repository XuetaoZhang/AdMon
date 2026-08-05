FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY contracts/package.json contracts/package.json
COPY web/package.json web/package.json
COPY mcp-server/package.json mcp-server/package.json
COPY vendor/moss-core/package.json vendor/moss-core/package.json
COPY moss-adapter/package.json moss-adapter/package.json
RUN npm ci

COPY . .
RUN npm run build --workspace @themoss/core \
  && npm run build --workspace @admon/moss-protocol \
  && npm run build --workspace @admon/web

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/contracts/package.json contracts/package.json
COPY --from=build /app/web/package.json web/package.json
COPY --from=build /app/mcp-server/package.json mcp-server/package.json
COPY --from=build /app/vendor/moss-core/package.json vendor/moss-core/package.json
COPY --from=build /app/moss-adapter/package.json moss-adapter/package.json
RUN npm ci --omit=dev
COPY --from=build /app/web/.next web/.next
COPY --from=build /app/vendor/moss-core/dist vendor/moss-core/dist
COPY --from=build /app/moss-adapter/dist moss-adapter/dist

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@admon/web", "--", "-p", "3000"]
