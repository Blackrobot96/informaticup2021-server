FROM node
COPY dist/ /app
ENTRYPOINT ["node", "/app/main.js"]
