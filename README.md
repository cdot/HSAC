# Sheds

Custom application for managing a dive club's resources. The application was
written specifically for use by Hartford Sub-Aqua Club, and reflects the way
we organise and manage our resources.

The application comprises three parts:
1. A browser application
2. A read-write cache server
3. An online database of read-only data

<ul data-toc data-toc-headings="h2,h3,h4"></ul>

## Browser Application

The application user interface is written to use a standard
browser. This provides a high degree of portability and openness. The
browser application presents a tab interface, where each tab offers a
particular service:

1. Compressor - recording static and portable compressor usage with tracking of filter lifetime
2. Loans - recording of equipment loans with complete editable history
and cross-links to inventory
3. Inventory - equipment records
4. Nitrox - nitrox blending calculations

Help information is readily available throughout the application through the <span class="fas fa-info-circle"></span> buttons.

### Compressor
Compressor manufacturers usually publish guidelines for the expected lifetime
of the filters in their compressors. This normally includes a predicted
lifetime for the filter when the compressor is run at a typical temperature
(e.g. 20&deg;C). Compressor filter performance degrades significantly at higher
temperatures (and generally improves slightly at lower temperatures), so
manufacturers usually publish a curve indicating expected lifetime at
different temperatures. This is normally an exponential curve that can be
modelled using a symmetric sigmoidal curve
`F = D + (A - D) / (1 + (T / C) ^ B)` where T is the
temperature, F is a lifetime degradation factor, and A, B, C and D are
constants. We can apply this to the predicted lifetime Lp to obtain a
predicted lifetime at that temperature in hours `Lpt = F * Lp`. For a runtime of dT hours, we can then obtain an estimate of "filter lifetime used" `Flu = dT / Lpt`. We then subtract that from `Lp` to get a new filter life prediction. 

(Note: an improvement might be to make the prediction based on the average temperature of the last 5 runs, rather than the ideal temperature)

The Sheds application supports recording the temperature and humidity with
the runtime, either using electronic sensors or manual data entry. See <a href="#Sensors">Sensors</a> for more.

The default constants for the static compressor prediction are derived from
data provided by Coltri for an MCH 16/ET, and for the portable compressor
by Bauer for a PE100, though you can provide your own
coefficients to match your compressor/filters in the settings
(accessed using the <span class="fas fa-sliders-h"></span> icon on the top
right) (http://www.mycurvefit.com provides a convenient way to fit a curve to a set of data points)

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

## Cache Server
Persistant storage is provided by using a cache server. Data files
from the read-only database are cached in this server. If the server
is hosted on the same network as the client, the user interface can
work even when an internet connection is not available. Use of a
network server also allows other mobile devices to read and write the
cache.

Included in the distribution is an interface suitable for using a
WebDAV server as the cache server. It would be easy to write an
interface to a different store provider, should you want to do so.

### Using a WebDAV server
It's easy to set up a WebDAV server, even on a mobile device. Most web server
implementations include a WebDAV module (though note that your server must
support CORS, and not all do). We use "HTTP Server powered by Apache" by
Tautvydas Andrikys, which is easy to set up and configure on Android.

For example, you might configure an Apache server on Linux as follows:
```
DavLockDB /var/www/html/webdav/DavLockDB

# Add a rewrite to respond with a 200 SUCCESS on every OPTIONS request.
RewriteEngine On
RewriteCond %{REQUEST_METHOD} OPTIONS
RewriteRule ^(.*)$ $1 [R=200,L]

<Location /webdav>
  # CORS
  Header always set Access-Control-Allow-Origin "*"
  # These are just the methods used by Sheds
  Header always set Access-Control-Allow-Methods "GET, OPTIONS, PUT, PROPFIND, MKCOL"
  Header always set Access-Control-Max-Age "1000"
  Header always set Access-Control-Allow-Headers "x-requested-with, Content-Type, origin, authorization, accept, client-security-token, depth, cache-control"

  Dav On
  AuthType Basic
  AuthName "Login required"

  AuthUserFile "/var/www/html/webdav/.passwd"
  Require valid-user
</Location>
```

You will need to provide the URL of your cache server to the user interface.

### Capturing data

Collected data (the loan history and compressor log) is stored as .csv
files in the webdav server. These files can be accessed via webdav for
further analysis (e.g. download, or upload to Google Drive)

## Read-only Database

The basic database for the application is read-only data that is
accessible through URLs that point to CSV documents. Access to the
database is via a single `index` URL which has to be manually provided
to the user interface. The app doesn't care how you manage the data in
the database, all it requires is access to CSV.

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

### Roles
The `roles` URL points to a CSV document with two columns, `role` and
`list`.  The `role` column gives the name of a role e.g. `member` and
the `list` column gives a comma-separated list of people who can
perform that role.  There must be at least the following columns:
1. member - club members who are permitted to borrow equipment
2. operator - qualified compressor operators

Other lists may be provided in additional columns for future use. Example:
```
role,list
member,"Freddie Mercury,Abraham Lincoln,Nikola Tesla,Sun Tzu"
operator,"Abraham Lincoln,Sun Tzu"
blender,"Sun Tzu"
trainee,"Freddie Mercury"
```

### Inventory
The `inventory` entry in the index is the URL of another CSV document
that has `sheet` and `url` columns. This time the rows correspond to a
tab in the inventory, and the URL is of another sheet that provides
the columns for that tab. For example,
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