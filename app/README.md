# Browser Application
This is the browser app for the Sheds framework.

The application is written to run in a standard web
browser. This provides a high degree of portability and openness. The
browser application presents a tab interface, where each tab offers a
particular service:

1. [Compressor](app/Compressor.md)
2. Nitrox - nitrox blending calculations - the calculations necessary for nitrox fills from a bank of cylinders are performed using an ideal gas approximation (there is support for real gas approximation, but it is significantly more complex and makes little difference to the results).
3. Portable compressor - like fixed compressor but tuned for a portable
4. Inventory - equipment records. The inventory tab provides a way to quickly look up and find the location of equipment.
5. Loans - recording of equipment loans with complete editable history and cross-links to inventory. Outgoing loans are recorded by selection from the inventory. Loan returns are recorded aginst the name of the person receiving back the kit. The `Inventory` tab is automatically updated to reflect kit that is out on loan.

## Databases

See [Databases](Databases.md) for details of the database organisation and configuration.

# Development

The browser application is written entirely in Javascript, and should run
on most modern browsers.

[node.js](https://nodejs.org/en/) is required for installation.
The `scripts` field of `package.json` is used to run development tasks.
Available targets are:
```
$ npm run lint # run eslint on source code
$ npm run update # run ncu-u to update npm dependencies
$ npm run test # use mocha to run all unit tests
```
To simplify app development, the sensors package can be run
even when no hardware sensors are available. See the
[sensors documentation](sensors/README.md) for more.
