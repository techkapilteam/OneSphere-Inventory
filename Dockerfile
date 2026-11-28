# OneSphere Inventory (Native Federation remote) as a container: production build served by nginx.
#
#   docker build -t onesphere-inventory .
#   docker run -p 4203:80 onesphere-inventory
#
# The OneSphere shell loads it from <this origin>/remoteEntry.json (set CHIKITSALAYAM_URL / HRMS_URL / INVENTORY_URL
# on the shell container). It takes the API address from the shell's session, so it needs no settings of its own.

FROM node:24-bookworm-slim AS build
WORKDIR /src
# no CLI prompts / analytics in an unattended build
ENV CI=true NG_CLI_ANALYTICS=false
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# a build that hangs (e.g. a worker killed for lack of memory) fails after 15 minutes instead of waiting forever
RUN timeout 900 npx ng build --configuration production

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist/global-erp/browser /usr/share/nginx/html
EXPOSE 80
