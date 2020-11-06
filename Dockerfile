FROM node:lts-alpine

WORKDIR /promegram
COPY . .

RUN npm install .
EXPOSE 8088

CMD node index.js