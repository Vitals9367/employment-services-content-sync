FROM node:14

WORKDIR /usr/src/app

RUN chgrp -R 0 /usr/src/app && \
    chmod -R g=u /usr/src/app

COPY .env ./

COPY package.json ./
COPY package-lock.json ./

RUN npm install

COPY ./ ./

CMD ["npm", "start"]
