# LabelLog Server

LabelLog Server is the backend for the
[LabelLog iOS app](https://github.com/unematiii/label-log). It handles
passwordless user authentication and turns OCR text from nutrition labels into
structured nutrition data using Mistral API.

This service is responsible only for authentication and LLM-powered label
extraction.

## Features

- Passwordless authentication with one-time email codes
- Email allowlist for controlling access
- Short-lived access tokens and rotating refresh tokens
- Rate-limited authentication endpoints
- Structured nutrition extraction through the Mistral API
- PostgreSQL persistence with automatic migrations
- Docker config

## Stack

- Node.js and TypeScript
- Fastify
- PostgreSQL and Drizzle ORM
- Mistral (`ministral-3b-latest`)
- SMTP for login-code delivery

## Run with Docker

Requirements:

- Docker with Docker Compose
- A Mistral API key
- Access to an SMTP server

Copy the example environment file and replace every placeholder:

```sh
cp .env.example .env
```

The two authentication secrets must each contain at least 32 characters and
should have different random values.

Build and start the API and PostgreSQL:

```sh
docker compose up -d --build
```

By default, the API is available at `http://127.0.0.1:8080`. PostgreSQL is
available only inside the Compose network. Database migrations run
automatically when the server starts.

To make the API reachable from another device on the local network, such as an
iPhone, set `APP_BIND_IP=0.0.0.0` in `.env` (NB! This will make the service listen on all interfaces).

Check that the service is running:

```sh
curl http://127.0.0.1:8080/health
```

## Whitelisting users

Only whitelisted email addresses can receive login codes. Add an address
after the containers are running:

```sh
docker compose exec app node dist/database/scripts/whitelist.js user@example.com
```

## Configuration

| Variable            | Purpose                                          | Default     |
| ------------------- | ------------------------------------------------ | ----------- |
| `APP_BIND_IP`       | Host interface on which Docker publishes the API | `127.0.0.1` |
| `POSTGRES_PASSWORD` | Password for the application database user       | Required    |
| `MISTRAL_API_KEY`   | API key used for nutrition extraction            | Required    |
| `AUTH_CODE_SECRET`  | Secret used to protect one-time login codes      | Required    |
| `JWT_SECRET`        | Secret used to sign access tokens                | Required    |
| `SMTP_HOST`         | SMTP server hostname                             | Required    |
| `SMTP_PORT`         | SMTP server port                                 | `587`       |
| `SMTP_SECURE`       | Whether SMTP uses an implicit TLS connection     | `false`     |
| `SMTP_USER`         | SMTP username                                    | Required    |
| `SMTP_PASSWORD`     | SMTP password                                    | Required    |
| `SMTP_FROM`         | Sender shown on login-code emails                | Required    |

## API

### Health check

```text
GET /health
```

Returns `{ "status": "ok" }` when the service is running.

### Authentication

Request and verify a one-time email code, or rotate a refresh token:

```text
POST /auth/code/request  { "email": "user@example.com" }
POST /auth/code/verify   { "email": "user@example.com", "code": "123456" }
POST /auth/token/refresh { "refreshToken": "..." }
```

Successful verification returns an access token valid for 15 minutes and a
rotating refresh token valid for 30 days.

### Nutrition extraction

```text
POST /ocr/extract
Authorization: Bearer <access-token>
```

The endpoint accepts OCR text and normalized line coordinates from the iOS app
and returns validated, structured nutrition values. It requires a valid access
token (see request schema in `src`).

`GET /health` and the authentication endpoints are public. Nutrition
extraction is protected.
