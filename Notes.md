# Probable access patterns

Sort by most-recent or least-recent
Filter by syslog ID or unit
Filter by date ("hide all before this log" etc.)
Filter by severity
Search message text (basic or regex)
Search all fields by text (basic or regex)


Marking, commenting, and re-saving (if we can save files that big)


# Not probable access patterns

Sort by anything other than wall clock time or entry number




# To do

- Investigate RxDB, IndexedDB, PouchDB
- Optimize index by making it an int32 array--a log will probably not have more than 4 billion records.
- Figure out displaying many records, virtualization/bigtables
- Figure out indexing, filtering, sorting
