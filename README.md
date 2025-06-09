# Cron-Mailer: Scheduled Email Reminder Service

**Cron-Mailer** is a robust, production-ready NestJS application that enables one-off and recurring email reminders. Designed for high reliability and scalability, it leverages PostgreSQL for persistence, Redis and BullMQ for job queuing, and the native NestJS scheduler for cron and timeout tasks. Whether you need a simple reminder or complex recurring schedules, Cron-Mailer has you covered.

---

## Table of Contents
1. [Key Features](#key-features)
2. [Project Structure](#project-structure)
3. [Quick Start](#quick-start)
4. [Docker Deployment](#docker-deployment)
5. [API Usage & Examples](#api-usage--examples)
6. [Reminder Patterns & Combinations](#reminder-patterns--combinations)
7. [Testing](#testing)
8. [Status Dashboard & Logs](#status-dashboard--logs)
9. [License & Contributing](#license--contributing)

---

## Key Features

- One-off Reminders: Schedule an email to be sent at a specific future date and time.
- Recurring Reminders: Support for daily, weekly, monthly, and yearly schedules via CRON expressions.
- Interval-Based: Send emails at arbitrary minute intervals (e.g., every 30 minutes).
- Persistent Storage: PostgreSQL (via Prisma ORM) stores reminder definitions and statuses.
- Reliable Queuing: BullMQ + Redis for long-delay and high-volume jobs, with retries and backoff.
- In-Memory Scheduling: NestJS SchedulerRegistry for short delays (timeouts) and cron jobs.
- Graceful Shutdown: Ensures no reminders are lost on service restart.
- Null-Stripped Responses: Clean API JSON output with only relevant fields.
- Dockerized: Ready-to-use Docker & Docker Compose setup for both development and production.

---

## Project Structure

```text
cron-mailer/
├── prisma/                  # Database schema & migrations (Prisma)
│   ├── migrations/          # Auto-generated migration files
│   └── schema.prisma        # Data model and enums
├── src/
│   ├── app.module.ts        # Root module configuration
│   ├── main.ts              # Application bootstrap
│   ├── mailer/              # Email transport module (Nodemailer)
│   │   ├── mailer.module.ts
│   │   └── mailer.service.ts
│   ├── reminders/           # Reminder domain and API
│   │   ├── dto/             # Data Transfer Objects & validation
│   │   │   └── create-reminder.dto.ts
│   │   ├── utils/           # Reusable utilities (assert, strip-null)
│   │   ├── schedulers/      # Cron & timeout scheduling logic
│   │   ├── reminders.consumer.ts   # BullMQ worker for queued jobs
│   │   ├── reminders-manager.service.ts  # Orchestration: persist → schedule
│   │   ├── reminders.service.ts      # CRUD operations (Prisma)
│   │   ├── reminders.controller.ts   # REST API endpoints
│   │   └── reminders.module.ts       # Feature module
│   └── prisma.module.ts     # Prisma client injection
├── Dockerfile               # Multi-stage build for production
├── docker-compose.yml       # Compose for Postgres, Redis, and App
├── .dockerignore            # Files to exclude from Docker context
├── README.md                # Project documentation
├── package.json             # NPM scripts & dependencies
├── tsconfig.json            # TypeScript configuration
├── LICENSE            # MIT License
├── .env.example            # Example of the required environment variables
└── .env                     # Environment variables (create this on your own. Use the '.env.example' as your guide.)
```

---

## Quick Start

### Prerequisites
- Node.js v22+ (LTS preferrably)
- Docker and Docker Compose
- PostgreSQL and Redis (local or via Docker)

### Clone & Install

```bash
git clone https://github.com/kxng0109/cron-mailer.git
cd cron-mailer
npm install
```

### Environment Configuration

Copy and edit the example `.env.example` file:

```env
DATABASE_URL=postgres[ql]://[username[:password]@][host[:port],]/database[?parameter_list]
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
REDIS_HOST=
REDIS_PORT=
MAIL_HOST=
MAIL_PORT=
MAIL_USERNAME=
MAIL_PASSWORD=
```
<b>Note: username, password and database should be the same value as POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_DB respectively.</b> 

### Run Locally (Non-Docker)

```bash
# Start Postgres and Redis manually or via Docker:
docker-compose up -d postgres redis

# Run database migrations
npx prisma migrate deploy

# Start the app in development mode
npm run start:dev

# Or to run the app normally
npm run build
npm run start
```

API available at: `http://localhost:3000`
<b>Note: The base url for all endpoints is `http://localhost:3000/api/`</b>

---

## Docker Deployment

Start everything using Docker Compose:

```bash
docker-compose up -d --build
```

Services:
- App: `http://localhost:3000`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

To view logs:

```bash
docker-compose logs -f app
```

---

## API Usage & Examples

### One-Off Reminder

```http
POST /reminders
Content-Type: application/json
{
  "email": "john@doe.com",
  "message": "Time to check your quarterly report!",
  "pattern" : "once",
  "sendAt": "2025-06-10T10:00:00Z"
}
```

### Every N Minutes

```http
POST /reminders
{
  "email": "john@doe.com",
  "message": "Your every 40th minute of the hour reminder",
  "pattern": "every_n_minutes",
  "interval": 40,
}
```

```http
POST /reminders
{
  "email": "john@doe.com",
  "message": "Your every 40th minute of the hour reminder",
  "pattern": "every_n_minutes",
  "time": "00:40"
}
```

### Daily Reminder

```http
POST /reminders
{
  "email": "joe@doe.com",
  "message": "Daily standup check-in",
  "pattern": "daily",
  "time": "09:00"
}
```

### Hourly Reminder

```http
POST /reminders
{
  "email": "joe@doe.com",
  "message": "Daily standup check-in",
  "pattern": "hourly",
  "time": "09:00"
}
```

### Weekly Reminder

```http
POST /reminders
{
  "email": "john@doe.com",
  "message": "Weekly standup check-in",
  "pattern": "weekly",
  "time": "10:00",
  "daysOfWeek": [1,3,5]
}
```

### Monthly Reminder

```http
POST /reminders
{
  "email": "john@doe.com",
  "message": "Monthly standup check-in",
  "pattern": "monthly",
  "time": "10:00",
  "dayOfMonth": 10
}
```
### Yearly Reminders

```http
POST /reminders
{
  "email": "john@doe.com",
  "message": "Yearly standup check-in",
  "pattern": "yearly",
  "time": "10:00",
  "dayOfMonth": 10,
  "month": 6
}
```

---

## Reminder Patterns & Combinations

### once
- Sends a one-time email at the `sendAt` timestamp.

### every_n_minutes
- Requires `interval` (in minutes) and `time` (start time of day).
- Repeats every N minutes from the specified start time.

### hourly
- Requires `minute` field (e.g., 15 for every hour at :15).

### daily
- Requires `time` (e.g., "14:30").
- Sends every day at that time.

### weekly
- Requires `time` and `daysOfWeek` (0=Sun...6=Sat).
- Sends weekly on specified days.

### monthly
- Requires `dayOfMonth` (1–31) and `time`.
- Sends on the specified day every month.

### yearly
- Requires `month` (1–12), `dayOfMonth`, and `time`.
- Sends yearly on that date.

> Combinations are validated at the DTO layer. Missing or conflicting fields will return a 400 error.

> Subject and message fields are optional, though recommended. If not provided, the default field "Your scheduled reminder from Cron-Mailer" and "You have a reminder." will be used for subject and message field, respectively.

---

## Testing

### Unit Tests

* **Framework**: Jest
* **Scope**: Isolate services, mock dependencies (SchedulerRegistry, Queue)
* **Location**: `*.spec.ts` files alongside source modules

### End-to-End Tests

* **Framework**: Jest + PactumJS
* **Scope**: Full HTTP → DB → scheduling → job queue flow
* **Setup**: Starts Nest application on port `3001`, clears Redis, executes HTTP calls

```bash
npm run test        # run all unit tests
npm run test:e2e    # run E2E tests
```

<b>Note: Create a `.env.test` files for your test environment variables. A separate database and redis server is used for tests. Check `docker.compose.yaml` file to get an idea. </b>

---


## Status Dashboard & Logs

- List pending reminders: `GET /reminders?status=pending`
- List all reminders: `GET /reminders`
- Cancel a reminder: `DELETE /reminders/:id`

Logs use NestJS(logger) with clear metadata for status, source (timeout/cron/queue), and timestamps.

---

## License & Contributing

This project is MIT-licensed. Contributions and feedback are welcome!
