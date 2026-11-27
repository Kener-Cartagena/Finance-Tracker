#!/bin/sh
set -e

# Aplica migraciones al arrancar (desactivar con DJANGO_MIGRATE=0, p. ej. si se
# lanzan varias réplicas y las migraciones se corren en un paso aparte).
if [ "${DJANGO_MIGRATE:-1}" = "1" ]; then
    python manage.py migrate --noinput
fi

exec "$@"
