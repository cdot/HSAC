# WebDAV
Most web server implementations include a WebDAV module (though note that your server must
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

Note that we only support Basic Auth.