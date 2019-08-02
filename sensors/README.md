# Sensors

The application in this directory is designed to be run as a service
on a Raspberry Pi with DHT11 and DS18B20 sensors attached to GPIO.

The service polls the sensors according to a predefined schedule and
appends the samples to a file on a WebDAV server.

The pinout for the sensors is as shown in `RPi pinout.svg`

The Pi is designed to be run headless (without an attached monitor). It can
be initially configured via USB and SSH by following:

https://www.thepolyglotdeveloper.com/2016/06/connect-raspberry-pi-zero-usb-cable-ssh/

## DHT11 sensor

This sensor is used to measure the temperature and humidity of the
intake air drawn into the compressor.

Accessing this sensor is handled by the `node-dht-sensor` npm package.

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
Expect to see devices such as 28-0316027f81ff.

# Configuring the service
The sampling program is run as follows:
```
$ cd sensors/js
$ node sensors.js
```
The program reads its configuration from `config.json`. This file must
contain the following configuration information:
* sensors - list of sensor configurations
* url - the base URL for the WebDAV folder where samples will be stored
* user - the username for WebDAV
* pass - the password for WebDAV

Each sensor configuration has at least:
* age_limit - the maximum age for samples, in seconds. Samples older
  than this will be discarded from the sample file.
* delay - how long to wait between samples, in milliseconds

DHTxx sensors also have:
* type - the type of the DHT sensor, either 11 or 22
* gpio - the GPIO pin for DHT11 data
* temperature_id: the id to use to record temperature readings
* humidity_id: the id to use to record temperature readings

DS18x20 sensors have:
* sensor_id - the ID of the DS18B20 sensor
* sample_id - the ID to use to record samples

```
an example `config.json` is:
```
{
 "sensors": [
  {
   "class": "DHTxx",
   "type": 11,
   "gpio": 14,
   "temperature_id": "intake_temperature",
   "humidity_id": "intake_humidity",
   "age_limit": 86400,
   "delay": 60000
  },
  {
   "class": "DS18x20",
   "sensor_id": "28-0316027f81ff",
   "sample_id": "internal_temperature",
   "age_limit": 86400,
   "delay": 30000
  }
 ],
 "url": "http://192.168.1.22/DAV",
 "path": "sensors.csv",
 "user": "test",
 "pass": "test",
 }
```
This will record DHT11 samples read from GPIO 14 to "intake_temperature.csv" and "intake_humidity.csv", and seamples read from 28-0316027f81ff to "internal_temperature.csv". The DHT11 will be polled every 60 seconds, while the DS18x20 will be polled every 30 seconds. Samples will be kept a maximum of 24 hours. Sample files are in the format:
```
Date,Sample
```
where Date is in epoch milliseconds, and Sample is the sample value.

## Running the application
The sensors service needs to be started on boot, by `/etc/init.d/sensors.sh`
- you will need to create this file. Assuming the code is checked out to
`/home/pi/HSAC`:

```
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
    node /home/pi/HSAC/sensors/js/sensors.js > /var/log/sensors.log 2>&1 &
    ;;
  stop)
    pid=`ps -Af | grep "sensors/js/sensors.js" | grep -v grep | sed -e 's/^[^0-9]*//;s/\s.*//'
`
    if [ "$pid"!="" ]; then
	( echo "Service stopping $pid"; kill -9 $pid ) 2>&1 \
	  >> /var/log/sensors.log
    fi
    ;;
esac
```
You will then need to:
```
$ sudo update-rc.d sensors.sh defaults
```
The service should start on the next boot. To start / stop / restart the service from
the command line:
```
$ sudo service sensors.sh start
```

Note that if none of the specified sensors can be read the service will exit.