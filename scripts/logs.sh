#!/bin/sh
. "$(dirname -- "$0")/common.sh"
compose logs --tail=100 -f app
