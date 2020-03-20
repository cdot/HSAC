#!/bin/sh
# Set the date from an http request to another network node
# (in this case, port 8000 on 192.168.1.64)
date=`curl -s -i 192.168.1.64:8000 | grep Date:| sed -e 's/Date: //'`
date -s "$date"
