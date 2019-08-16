# Sheds

Custom application for managing a dive club's resources. The application was
written specifically for use by Hartford Sub-Aqua Club, and reflects the way
we organise and manage our resources.

The application comprises three parts:
1. A browser application
2. A read-write cache server
3. An online database of read-only data

## Browser Application

The application user interface is written to use a standard
browser. This provides a high degree of portability and openness. The
browser application presents a tab interface, where each tab offers a
particular service:

1. Compressor - recording fixed and portable compressor usage with tracking of filter lifetime
2. Loans - recording of equipment loans with complete editable history
and cross-links to inventory
3. Inventory - equipment records
4. Nitrox - nitrox blending calculations

Help information is readily available throughout the application through the
<span class="fas fa-info-circle"></span> buttons.

### Compressor
Compressor support includes tracking and predicting filter life, and monitoring
compressor performance using digital sensors.

See [Compressor](Compressor.md) for more detailed information.

The Sheds application supports recording the temperature and humidity with
the runtime, either using electronic sensors or manual data entry. See
<a href="#Sensors">Sensors</a> for more.

### Loans
Outgoing loans are recorded by selection from the inventory. Loan
returns are recorded aginst the name of the person receiving back the
kit. The `Inventory` tab is automatically updated to reflect kit that
is out on loan.

### Inventory
The inventory tab provides a way to quickly look up and find the
location of equipment.

### Nitrox
The calculations necessary for simple nitrox fills are performed using
an ideal gas approximation (there is support for real gas approximation, but
it is significantly more complex and makes little difference to the final
computations for Nitrox).

## Databases

See [Databases](Databases.md) for details of the database organisation and configuration.

## Sensors
The Sheds app is designed to capture environmental information to
assist in filter life prediction. This can be done interactively, or
can be done using digital sensors attached to a microcontroller. The
app can refer to a file stored in WebDAV to obtain sensor data. This
file is a CSV file with fields `Sensor ID,Date,Sample` and contains
one line for each sample point. The file's URL and the requisite
Sensor ID's are configured in the app settings dialog.

In HSAC we use a Raspberry Pi Zero to capture sensor data from DHT11
and DS18B20 one-wire sensors and write it to the WebDAV server. The
code is all provided - see the sensors [README](sensors/README.md) for
more.

## About
Sheds was written by Crawford Currie http://c-dot.co.uk and is licensed
under MIT license terms.