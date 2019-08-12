#include <wiringPi.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#define MAXTIMINGS	85
// GPIO 14 is WiringPi 15
#define DHTPIN		15

int dht11_dat[5] = { 0, 0, 0, 0, 0 };

void sample()   {
  uint8_t laststate	= HIGH;
  uint8_t counter	= 0;
  uint8_t j		= 0, i;

  dht11_dat[0] = dht11_dat[1] = dht11_dat[2] = dht11_dat[3] = dht11_dat[4] = 0;

  pinMode(DHTPIN, OUTPUT);
  digitalWrite(DHTPIN, LOW);
  delay( 18 );
  digitalWrite(DHTPIN, HIGH);
  delayMicroseconds(40);
  pinMode(DHTPIN, INPUT);

  for (i = 0; i < MAXTIMINGS; i++) {
    counter = 0;
    while (digitalRead(DHTPIN) == laststate) {
      counter++;
      delayMicroseconds(1);
      if (counter == 255)
        break;
    }
    laststate = digitalRead(DHTPIN);

    if ( counter == 255 )
      break;

    if ((i >= 4) && (i % 2 == 0)) {
      dht11_dat[j / 8] <<= 1;
      if (counter > 16)
        dht11_dat[j / 8] |= 1;
      j++;
    }
  }

  if ((j >= 40) &&
      (dht11_dat[4] == ((dht11_dat[0] + dht11_dat[1] + dht11_dat[2] + dht11_dat[3]) & 0xFF))) {
    printf("Humidity = %d.%d %% Temperature = %d.%d C\n",
           dht11_dat[0], dht11_dat[1], dht11_dat[2], dht11_dat[3]);
  } else {
    printf("Bad sample, skip and try again\n");
  }
}

int main( void ) {
  printf("Raspberry Pi wiringPi DHT11 test\n");

  if (wiringPiSetup() == -1)
    exit(1);

  while (1) {
    sample();
    delay(1000);
  }
}

