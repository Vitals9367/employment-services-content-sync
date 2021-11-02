# employment-services-content-sync

## Related repositories
- [Drupal employment services](https://github.com/City-of-Helsinki/drupal-employment-services)
- [React UI](https://github.com/City-of-Helsinki/employment-services-ui)
## Setup

Copy `.env.example` to `.env`.

## Local development flow

Elasticsearch and content sync functions can be built and run with Docker. See `Dockerfile and docker-compose`.

Steps:
- Define `.env` in project root.
- Run docker containers `docker-compose up -d`
- Update containers `docker-compose up -d --build`

Run only content sync functions with the following commands in project root:

```
nvm use

# install dependencies
npm install

# start syncing
npm start
```
