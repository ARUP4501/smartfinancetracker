# Deployment Guide

## Environment

Set these variables in production:

```text
SECRET_KEY=<strong random secret>
JWT_SECRET_KEY=<strong random jwt secret>
SQLITE_DATABASE=<absolute sqlite path, or finance.sqlite3>
FLASK_ENV=production
ADMIN_EMAIL=<admin email>
```

## Gunicorn

For Linux hosting:

```bash
gunicorn "run:app" --workers 3 --bind 0.0.0.0:8000
```

Put Nginx or your hosting platform's reverse proxy in front of Gunicorn and terminate HTTPS there.

## SQLite Storage

For a single-server project demo, SQLite is enough. Use a persistent disk path for `SQLITE_DATABASE` in production-style hosting.

## Production Checklist

- Replace development secrets.
- Enable HTTPS so secure JWT cookies can be used.
- Configure verified email delivery for password reset.
- Back up the SQLite database file regularly.
- Use platform logs and error monitoring.
- Run `python -m compileall app config.py run.py` before deployment.
