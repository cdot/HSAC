# Sensors

The application in this directory runs an ultra-light web server
on a Raspberry Pi with DHT11 and DS18B20 sensors attached to GPIO.

On receipt of an AJAX request the server reads a sensor and reports the
value read.

The pinout for the sensors is as shown in `RPi pinout.svg`

# Hardware Configuration

## DHT11 sensor

This sensor is used to measure the temperature and humidity of the
intake air drawn into the compressor.

Accessing this sensor is handled by the `node-dht-sensor` npm package. We use GPIO 14 for this sensor.

## DS18b20 sensor

This sensor is used to measure the temperature of the 3rd stage head
in the compressor. The standard one-wire support built in to the RPi
was configured to read GPIO pin 18 by adding to `/boot/config.txt`,
thus:
```
# 1-wire settings
dtoverlay=w1-gpio,gpiopin=18
```
After a reboot you can see what sensors are connected using 
```
ls /sys/bus/w1/devices/w1_bus_master1
```
Expect to see devices such as `28-0316027f81ff`

# Server Configuration
You will need to install node.js and npm.

Install the server software from github.
```
$ cd ~
$ git clone https://github.com/cdot/HSAC.git
$ cd HSAC/sensors
$ npm install
```
The server is then run as follows:
```
$ node ~/HSAC/sensors/js/sensors.js -c <configuration file>
```
The configuration file is a list of sensors. Each sensor has
at least:
* class - the name of a class that implements an interface to the sensor
* name - the name of the sensor. This will be used to create an AJAX
entry point.

DHTxx sensors also have:
* type - the type of the DHT sensor, either 11 or 22
* gpio - the GPIO pin for DHT11 data
* field - the field (either temperature or humidity) of the sensor result
  required

DS18x20 sensors have:
* sensor_id - the ID of the DS18B20 sensor

an example configuration file:
```
[
  {
   "name": "internal_temperature",
   "class": "DS18x20",
   "sensor_id": "28-0316027f81ff"
  },
  {
   "name": "intake_temperature",
   "class": "DHTxx",
   "type": 11,
   "gpio": 14,
   "field": "temperature"
  },
  {
   "name": "intake_humidity",
   "class": "DHTxx",
   "type": 11,
   "gpio": 14,
   "field": "humidity"
  }
]
```
The server has a number of command-line options that can be explored
using the `--help` option.

## Running the Server
The server needs to be started on boot, by `/etc/init.d/sensors.sh`
- you will need to create this file. Assuming the code is checked out to
`/home/pi/HSAC`:

```
$ sudo nano /etc/init.d/sensors.sh
#!/bin/sh
# sensors.sh
### BEGIN INIT INFO
# Provides:          sensors
# Required-Start:    $local_fs
# Required-Stop:
# Default-Start:     1 2 3 4 5 6
# Default-Stop:      
# Short-Description: Sensors init script
# Description:       Start the sensors server
### END INIT INFO

#
case "$1" in
  start)
    node /home/pi/HSAC/sensors/js/sensors.js -p 8000 -c /home/pi/HSAC/sensors.cfg > /var/log/sensors.log 2>&1 &
    ;;
  stop)
    pid=`ps -Af | grep "sensors/js/sensors.js" | grep -v grep | sed -e 's/^[^0-9]*//;s/\s.*//'
`
    if [ "$pid"!="" ]; then
	( echo "Service stopping $pid"; kill -9 $pid ) 2>&1 \
	  >> /var/log/sensors.log
    fi
    ;;
  restart)
    $0 stop
    $0 start
    ;;
esac
$ sudo chmod 755 /etc/init.d/sensors.sh
$ sudo update-rc.d sensors.sh defaults
```
The service should start on the next boot. To start the service from
the command line:
```
$ sudo service sensors.sh start
```
Sensors must be attached and available when the server is started, or they will
not be detected by the service. The server can be restarted at any time using
```
$ sudo service sensors.sh restart
```
When the service is running you can use HTTP requests to query the sensors e.g.
```
$ curl http://192.168.1.24:8000/internal_temperature
```
The Sheds app uses these queries to update the UI.
