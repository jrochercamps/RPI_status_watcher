#!/bin/sh
. "$(dirname -- "$0")/common.sh"
# stop conserva los contenedores, la red y los volúmenes.
compose stop
