# Dive Club Resources

Custom application for managing a dive club's resources. The application was
created specifically for use by
[Hartford Sub-Aqua Club (HSAC)](http://hartfordscuba.co.uk), and reflects
the way we organise and manage our resources - training kit, compressor, and oxygen bank.

The application comprises two parts:
1. A [browser application](app/README.md)
3. A [sensor package](sensors/README.md)

HSAC members can get [information on our specific configuration](https://docs.google.com/document/d/13a0xBhF8_AJsvffOMFLHleUT0XIu8TSBcTyFuffQ9EQ)

## Browser Application

The browser application provides a user interface designed to be run in a web
browser, either in a device specifically allocated for the purpose or in
a mobile phone or tablet. The application supports a number of services:

1. Compressor - recording fixed compressor usage with tracking of filter lifetime, optionally monitoring compressor performance using electronic sensors with the sensor package.
2. Nitrox - nitrox blending calculations

Optionally enabled services (edit `index.html` to enable):

3. Portable compressor - like fixed compressor but tuned for a portable
4. Inventory - equipment records
5. Loans - recording of equipment loans with complete editable history
and cross-links to inventory

Help information is readily available throughout the application through the
info buttons.

See [Browser application](app/README.md) for more information.

## Sensor package

The sensor package is designed to run on a Raspberry Pi that interfaces to a number
of electronic sensors on the compressor.

See [Sensor package](sensors/README.md) for more information. The sensors package
can be run without any connected sensors for debugging the web application.

## About
Sheds was written by Crawford Currie http://c-dot.co.uk and is licensed
under MIT license terms.
