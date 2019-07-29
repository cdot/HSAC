# Sensors

The application in this directory is designed to be run on a Raspberry Pi Zero
with DHT11 and DS18B20 sensors attached to GPIO.

The application polls the sensors according to a predefined schedule and
appends the samples to a file on a WebDAV server.

The pinout for the sensors is as shown in `RPi pinout.svg`

The Pi is designed to be run headless (without an attached monitor). It was
initially configured (network set up and SSH enabled) via USB by following:

https://www.thepolyglotdeveloper.com/2016/06/connect-raspberry-pi-zero-usb-cable-ssh/

## DHT11 sensor

This sensor is used to measure the temperature and humidity of the intake air drawn into the compressor.

Accessing this sensor is handled by the `node-dht-sensor` npm package.

## DS18b20 sensor

This sensor is used to measure the temperature of the 3rd stage head in the
compressor.

The standard one-wire support built in to the RPi was configured to read
GPIO pin 18 by adding to `/boot/config.txt`, thus:
```
# 1-wire settings
dtoverlay=w1-gpio,gpiopin=18
```
After a reboot you can see what sensors are connected using 
```
ls /sys/bus/w1/devices/w1_bus_master1
```
Expect to see devices such as 28-0316027f81ff.

# Configuring the program
The sampling program is run as follows:
```
$ cd sensors/js
$ node main.js
```
The program reads its configuration from `config.json`. This file must
contain the following configuration information:
* sensors - list of sensor configurations
* URL - the base URL for the WebDAV service
* PATH - the pathname for the sample file on WebDAV e.g. 'sensors.csv'
* USER - the username for WebDAV
* PASS - the password for WebDAV
Each sensor configuration has at least:

DHT_TYPE - the type of the DHT sensor, either 11 or 22
* DHT_GPIO - the GPIO pin for DHT11 data
* DHT_PREFIX - the prefix for the sensor IDs to used for DHT temperature and humidity readings
* DHT_HUMIDITY - the sensor ID to used for DHT humidity readings
* DS18_ID - the ID of the DS18B20 sensor
* AGE_LIMIT - the maximum age for samples, in seconds. Samples older than this will be discarded from the sample file.
* DELAY - the maximum sampling frequency, in milliseconds
```
an example `config.json` is:
```
{
 "sensors": [
  {
   "class": "DHTxx",
   "type": 11,
   "gpio": 14,
   "prefix", "DHT_"
   "age_limit": 86400
   "delay": 60000
  },
  {
   "class": "DS18x20",
   "id": "28-0316027f81ff"
   "age_limit": 86400
   "delay": 60000
  }
 ],
 "url": "http://192.168.43.1:8000/DAV",
 "path": "sensors.csv",
 "user": "test",
 "pass": "test",
 }
```
Samples are recorded to the sample file in the format:
```
ID,Date,Sample
```
where ID is the sensor ID, Date is in epoch milliseconds, and Sample is the sample value.