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


Simplify list virtualization by precomputing each message's line count? Then each list item's size can be defined up-front and passed to our virtualization library.



# Rough priorities

- Fix to maximum line length

- Render datetimes as datetimes (in the local timezone?)
- Searching
    - Linear scan?
    - https://www.cockroachlabs.com/docs/stable/trigram-indexes
    - https://en.wikipedia.org/wiki/Compressed_suffix_array
    - https://github.com/bvaughn/js-search
    - https://github.blog/2023-02-06-the-technology-behind-githubs-new-code-search/

- Show full log details in sidebar

- Filtering, e.g. by message or date

- Native format imports
- Better validation

- Linting

- Column reordering (drag and drop)
- Customize extra and hidden columns

- Re-exporting

- Reboot markers

- "X hours ago" tooltips on dates
- Adjustable timezones

- Fix horizontal scrolling somehow
    - Scrollbar too dynamic as virtualized cells go in and out of view
        - Expand window?
        - Precompute max scroll size?
    - Very long horizontal scrolling may not be what people actually want, e.g. for log lines that are long English text
        - Global text wrap toggle?
            - How do we calculate the element heights then? Implement a reflow algorithm in JS?

- Bug: If you change to a second file, the reference to the first one gets yanked and a bunch of components error out because they try to re-render but they can't access it anymore. I guess.


- Keyboard shortcuts
    Search: focus search bar, jump to next result, jump to prev result
