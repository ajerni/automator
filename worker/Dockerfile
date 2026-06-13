# Official Playwright image ships Chromium + all required OS libraries, which the
# native PaaS runtimes (Render/Railway/Fly) otherwise lack. Keep the version in
# sync with the "playwright" dependency in package.json.
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

# Install deps (incl. tsx, used to run the TS entrypoint). Browsers are already
# present in the base image, so skip the playwright-install postinstall script.
COPY package.json ./
RUN npm install --ignore-scripts

COPY . .

ENV NODE_ENV=production
# The app reads PORT from the environment (Render injects it).
EXPOSE 4000
CMD ["npm", "run", "start:prod"]
