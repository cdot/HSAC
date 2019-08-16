# Databases
Two databases are used, a read-write cache database, and a read-only database that shadows
data on Google Drive.

## Local Cache (WebDAV) database

The local cache DB contains a cached copy of the Online DB, and is also used to
store data such as compressor records.

Included in the distribution is an interface suitable for using a
WebDAV server as the cache server. It would be easy to write an
interface to a different store provider, should you want to do so.

Click <b>Update Cache From Web</b> to update the cache server from the online database
(requires that the machine running the application is currently connected to the internet.)

### Using a WebDAV server
It's easy to set up a WebDAV server, even on a mobile device. See
[WebDAV](WebDAV.md) for more information.

### Capturing data

Collected data (the loan history and compressor log) is stored as .csv
files in the webdav server. These files can be accessed via webdav for
further analysis (e.g. download, or upload to Google Drive)

## Read-only Database

Access to the database is via a single <b>The Online DB (Google Drive) index</b> URL
which has to be manually provided
to the user interface. The app doesn't care how you manage the data in
the database, all it requires is access to CSV. The remote DB is only referenced when
it is required to update the local cache copy.

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