# HSAC Sheds

Custom application for managing the HSAC sheds. Browser application that
stores data on a WebDAV server.

## Data server
For example HTTP Server powered by Apache - Tautvydas Andrikys -
config on TermUX,

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

The latest inventory for equipment locations.

# Architecture

## UI architecture

The application is organised into a set of top level tabs. Each of these tabs
are customised for their specific function.

## Storage architecture

The main storage used by the application is a webdav server, which
runs on the tablet in the Sheds. This webdav server stores plaintext
files in .csv and .json formats. Data collection for the compressor
and loan register is done this way.

Information about the club - member's lists and the inventory - are
stored in spreadsheets in Google Drive. However the app does not have
a permanent internet connection and cannot access these spreadsheets
on a day-to-day basis. So we use the webdav store to cache the data from
the sheets.

Using webdav this way means that several clients can connect to the
webdav server and update it. Thus a member with network access can
open the app and update webdav on the server in the sheds, or the
server can be taken offsite to a wifi location for an update. Note
however that there is no locking or merging support, so care must be
taken when multiple users may be accessing the store simultaneously.

### Caching data stored on Google Drive

For security we cannot permit access to spreadsheets on Drive. However
we want a subset of those sheets to be accessible without punitive
login restrictions. Extracting data from Drive without an explicit
login is challenging.

The "Committee/Equipment/Sheds folder" contains a number of sheets
that summarise information from Drive. The "Roles" sheet contains
columns for the member lists - at least members, operators and
blenders, and maybe more - extracted from the Member's database using
IMPORTRANGE. This sheet is then published as a CSV document, so care
must be taken not to include any more than member's names.
        
The "Inventory" sheet, contains a mapping from the name of each of the
inventory tabs to the CSV publishing URL of a sheet in
"Committee/Equipment/Sheds" that extracts the data for the tab from
"Committee/Equipment/Sheds/Equipment & Servicing Schedules". These CSV
links are downloaded and saved to webdav for the Sheds app to use to
populate the UI when offline.

## Uploading to Drive

Collected data (the loan history and compressor log) is stored as .csv
files by the webdav server. These files can be uploaded to Google Drive
at any time using Drive's import facilities.