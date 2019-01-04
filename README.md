# Sheds

Custom application for managing a dive club's resources. The application was
written specifically for use by Hartford Sub-Aqua Club, and reflects the way
we organise and manage our resources.

The application comprises three parts:
1. A browser application
2. A WebDAV server
3. An online database of read-only data

* [Browser Application](#Browser_Application)
 * [Compressor](#Browser_Application_Compressor)
 * [Loans](#Browser_Application_Loans)
 * [Inventory](#Browser_Application_Inventory)
 * [Nitrox](#Browser_Application_Nitrox)
* [WebDAV Server](#WebDAV_Server)
 * [Capturing data](#WebDAV_Server_Capturing_data)
* [Read-only Database](#Read_only_Database)
 * [Index](#Read_only_Database_Index)
 * [Roles](#Read_only_Database_Roles)
 * [Inventory](#Read_only_Database_Inventory)
 * [Setting up the database](#Read_only_Database_Setting_up_the_database)

<a name="Browser_Application"></a>
## Browser Application

The application is written to use a standard browser. This provides a
high degree of portability and openness. The browser application
presents a tab interface, where each tab offers a particular service:

1. Compressor - recording compressor usage with tracking of filter lifetime
2. Loans - recording of equipment loans with complete editable history and cross-links to inventory
3. Inventory - equipment records
4. Nitrox - nitrox blending calculations

<a name="Browser_Application_Compressor"></a>
### Compressor
Compressor usage is recorded with the intake air temperature. Filter
performance degrades significantly at higher temperatures, so the app
uses this information to maintain a running estimate of remaining
lifetime. Filter performance degradation follows a curve published by
compressor manufacturers, which is modelled by a symmetric sigmoidal
curve `y = d + (a - d) / (1 + (x / c) ^ b)` where x is the
temperature, y is a degradation factor, and a, b, c and d are
constants. The default constants are derived from the data provided by
Coltri for an MCH 16/ET, using http://mycurvefit.com, for a maximum lifetime of 40 hours at 20&deg;C, though you can
provide your own coefficients to match your compressor/filters in the settings (accessed using the gear icon on the
top right).

<a name="Browser_Application_Loans"></a>
### Loans
Outgoing loans are recorded by selection from the inventory. Loan returns
are recorded aginst the name of the person receiving back the kit. The
`Inventory` tab is automatically updated to reflect kit that is out on
loan.
<a name="Browser_Application_Inventory"></a>
### Inventory
The inventory tab provides a way to quickly look up and find the location of equipment.
<a name="Browser_Application_Nitrox"></a>
### Nitrox
The calculations necessary for simple nitrox fills are performed using
[Van der Waal's real gas equation](https://en.wikipedia.org/wiki/Van_der_Waals_equation) to make accurate predictions on the gas needed for different fills, for use only by trained nitrox blenders.
<a name="WebDAV_Server"></a>
## WebDAV Server
Persistant storage for the app is provided by using a WebDAV
server. Data files from the read-only database are cached in the
WebDAV server, which allows the app to work even when an internet
connection is not available. Use of a WebDAV server also allows other
mobile devices to read and write the cache. Note that the WebDAV server must support CORS.

It's easy to set up a WebDAV server, even on a mobile device. We
recommend lighttpd on platforms that support it. On mobile devices,
HTTP Server powered by Apache by Tautvydas Andrikys is easy to set up
and configure.

For example, you might configure the server as follows:
```
DavLockDB /var/www/html/webdav/DavLockDB

# CORS
Header always set Access-Control-Allow-Origin "*"
# These are just the methods used by Sheds
Header always set Access-Control-Allow-Methods "GET, OPTIONS, PUT, PROPFIND, MKCOL"
Header always set Access-Control-Max-Age "1000"
Header always set Access-Control-Allow-Headers "x-requested-with, Content-Type, origin, authorization, accept, client-security-token, depth"

# Add a rewrite to respond with a 200 SUCCESS on every OPTIONS request.
RewriteEngine On
RewriteCond %{REQUEST_METHOD} OPTIONS
RewriteRule ^(.*)$ $1 [R=200,L]

<Location /webdav>
	Dav On
	AuthType Basic
	AuthName "Login required"

	AuthUserFile "/var/www/html/webdav/.passwd"
	Require valid-user
</Location>
```

You will need to provide the URL of your WebDAV server to the app.
<a name="WebDAV_Server_Capturing_data"></a>
### Capturing data

Collected data (the loan history and compressor log) is stored as .csv
files in the webdav server. These files can be accessed via webdav for
further analysis (e.g. download, or upload to Google Drive)
<a name="Read_only_Database"></a>
## Read-only Database

The basic database for the application is read-only data that is
accessible through URLs that point to CSV documents. Access to the
database is via a single `index` URL which has to be manually provided
to the user interface. The app doesn't care how you manage the data in
the database, all it requires is access to CSV.
<a name="Read_only_Database_Index"></a>
### Index
This is the URL of a CSV document that contains two columns, headed
`sheet` and `url`. The `sheet` column has two entries, `roles` and
`inventory`, each of which has a corresponding entry in the URL
column.
```
sheet, url
roles,http://address-of-roles.csv
inventory,http://address_of_inventory.csv
```
<a name="Read_only_Roles"></a>
### Roles
The `roles` URL points to a CSV document that provides a number of
lists of club members, one per column. The column headers provide the name
of the role, and there must be at least the following columns:
1. members - a list of club members who are permitted to borrow equipment
2. operators - a list of qualified compressor operators

Other lists may be provided in additional columns for future use. Example:
```
members,operators,trainees
Freddie Mercury,Linus Torvalds,Freddie Mercury
Abraham Lincoln,Nikola Tesla,Johann Bach
Johann Bach,,Linus Torvalds
Nikola Tesla,,
Linus Torvalds,,
```

<a name="Read_only_Inventory"></a>
### Inventory
The `inventory` entry in the index is the URL of another CSV document that has
`sheet` and `url` columns. This time the rows correspond to a tab in
the inventory, and the URL is of another sheet that provides the
columns for that tab. For example,
```
sheet,url
Cylinders,http://url-of-cylinders.csv
Regulators,http://url-of-rgeulators-csv
```
It's up to what columns you put in your inventory. An example for a
`Cylinders` sheet might be:
```
ID,Description,Location,Kit Pool
01,Yellow 12L,Cage,Training,
04,Blue pony 3,Cage,Qualified
```
Two columns are special in these sheets, `Location` and `Kit
Pool`. These columns are included in the top-level `Inventory` tab but
are ignored in the inventory pick dialog on the `Loans` tab.
<a name="Read_only_Database_Setting_up_the_database"></a>
### Setting up the database
There are a number of ways you can manage the database. The simplest
would be to have a number of CSV format files that you manually
edit. Slightly more functional is to publish sheets from spreadsheets
in Google Drive. Or you could create an application (e.g. using PHP)
that would serve the required CSV from your existing database.

Hartford Sub-Aqua Club uses Google Drive. We use proxy spreadsheets to
extract data from the core databases (which are themselves spreadsheets)
using `IMPORTRANGE`. The proxy sheets are then published as CSV. This
approach gives us fine-grained control over what data enters the public
domain.
