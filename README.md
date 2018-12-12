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

## Loans

## Compressor events


