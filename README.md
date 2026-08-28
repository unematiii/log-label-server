# LabelLog Server

## Run with Docker

Copy `.env.example` to `.env`, replace every placeholder, then run:

```sh
docker compose up -d --build
```

The API is available to the host at `127.0.0.1:3000`; PostgreSQL is only
available inside the Compose network. Database migrations run when the server
starts.

Add an email to the allowlist after the containers are running:

```sh
docker compose exec app node dist/database/whitelist.js user@example.com
```

## Authentication

Request and verify a one-time email code:

```text
POST /auth/code/request  { "email": "user@example.com" }
POST /auth/code/verify   { "email": "user@example.com", "code": "123456" }
POST /auth/token/refresh { "refreshToken": "..." }
```

Successful verification returns an access token valid for 15 minutes and a
rotating refresh token valid for 30 days. Call protected routes with:

```text
Authorization: Bearer <access-token>
```

`GET /health` and `/auth/*` are public. `POST /ocr/extract` requires an access
token.
