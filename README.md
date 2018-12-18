# HSAC Sheds

Custom application for managing the HSAC sheds. Browser application that
stores data on a WebDAV server.

## Data server
HTTP Server powered by Apache - Tautvydas Andrikys - config on TermUX,
set up DAV

	<Location /webdav>
		Dav On
		AuthType Basic
		AuthName "Login required"

		AuthUserFile "/var/www/html/webdav/.passwd"
		Require valid-user
	</Location>

## Nitrox computations

Real Gas nitrox calculations using Van der Waals equation of state.

## Loans

Database of loans with complete editable history.

## Compressor

Database of compressor events with tracking of filter usage.

## Inventory

Search the latest inventory for equipment locations.

## Apache
Run server on 0.0.0.0:8000
Site is at 12.0.0.1/HSAC
Webdav is at 12.0.0.1:8000/DAV

## Whereis?
All searches return Kit Pool,Count,Location

Computer
  ID,Make,Model

Cylinder
  ID,Size,Colour,Serial #,Make

BCD
  ID,Make,Model,Size,Colour,Serial #

Regulators
  ID,Location

Fins
  Type,Make,From size,To size

RIB
  Description

O2
  Description

Life Jackets
  ID,Make,Model

Miscellany
  Description