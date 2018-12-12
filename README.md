Apps required:

HTTP Server powered by Apache - Tautvydas Andrikys - config on Huawei
TermUX

For now, just use WebDAV as the store.

Login: Enter your HSAC membership number, or your full name
Logout: clear the DAV connection

TODO:

Configure digest login on Apache server

Store lists as CSV files

Nitrox

Loans

Event {
  date_time: Date
  lender: string, (login)
  lendee: string,
  description: string,
  id: string,
  donation_received: number,
  returned: Date
}

Functions
  Check lender authorised - login?
  Check lendee trainee/trained (record instructor?)
  Check donation
  Alert return date
  Alert overdue returns
  Search for entry

Compressor Use

Event {
  who: string, (login)
  temperature: number, degC
  humidity: number, %
  runtime: number, minutes
  date_time: number
}
Functions
  Filter life remaining
  Alerts - do not use, change filters now, inspect filters, change oil

Inventory
{
  item: string,
  container: string,
  borrower: string (validate)
  date_time: number (last update)
}
Functions
  Move item
  Out on loan
  Crosscheck loan book

UI:
  Standard display, show menu of functions:
  Compressor / Loan Book / Inventory / Manager
  Compressor and Loan Book both require login - apache basic auth?

Compressor use:
  Capture data, add event to server

Loan book
  
Server:
  Login (basic auth)
  Add compressor event
  List compressor events
  
  List inventory
  Update inventory

  List loan book history
  Add loan book items
  Check loan book items

