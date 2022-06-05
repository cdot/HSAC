# Sheds

Custom application for managing a dive club's resources. The application was
written specifically for use by Hartford Sub-Aqua Club, and reflects the way
we organise and manage our resources. HSAC members can get [information on our specific configuration](https://docs.google.com/document/d/13a0xBhF8_AJsvffOMFLHleUT0XIu8TSBcTyFuffQ9EQ)

The application comprises three parts:
1. A browser application
2. A read-write cache server
3. An online database of read-only data

## Browser Application

`index.html` and subfolder `app`.

The application user interface is written to use a standard
browser. This provides a high degree of portability and openness. The
browser application presents a tab interface, where each tab offers a
particular service:

1. Compressor - recording fixed compressor usage with tracking of filter lifetime
2. Nitrox - nitrox blending calculations

Optionally enabled services (edit index.html to enable):

3. Portable compressor - like fixed compressor but tuned for a portable
4. Inventory - equipment records
5. Loans - recording of equipment loans with complete editable history
and cross-links to inventory

Help information is readily available throughout the application through the
info buttons.

### Compressor

Compressor support includes tracking and predicting filter life, and monitoring
compressor performance using electronic sensors.

See [Compressor](app/Compressor.md) for more detailed information.

### Nitrox
The calculations necessary for nitrox fills from a bank of cylinders are
performed using an ideal gas approximation (there is support for real gas
approximation, but it is significantly more complex and makes little
difference to the results).

### Loans
Outgoing loans are recorded by selection from the inventory. Loan
returns are recorded aginst the name of the person receiving back the
kit. The `Inventory` tab is automatically updated to reflect kit that
is out on loan.

### Inventory
The inventory tab provides a way to quickly look up and find the
location of equipment.

## Databases

See [Databases](Databases.md) for details of the database organisation and configuration.

## About
Sheds was written by Crawford Currie http://c-dot.co.uk and is licensed
under MIT license terms.
