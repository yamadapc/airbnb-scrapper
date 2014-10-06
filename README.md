airbnb-scrapper
===============
A command-line tool for scrapping AirBNB postings.

Given a list of AirBNB URLs, this tool:
- Downloads the postings pages
- Extracts relevant information
- Outputs them in CSV form

(You can obviously just give it one URL)

## Usage
```
$ airbnb-scrapper --verbose https://airbnb.com/rooms/:some_id
Downloading posting for `some_id`...
Extracting information for `some_id`...
title,host_name,host_profile_url,n_guests,posting_type,price_per_night,price_per_week,url,google_maps_url,
```
