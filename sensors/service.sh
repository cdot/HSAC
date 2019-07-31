#!/bin/bash
# Invoked by init.d/sensors.sh, this script starts the sensors service

# Determine the directory this script is in
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Start the service
node $DIR/js/main.js 2>&1 > /var/log/sensors/service.log &
